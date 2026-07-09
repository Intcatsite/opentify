use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::features::AudioFeatures;
use super::GenrePrediction;

/// A tiny softmax-regression genre classifier: `feature_mean`/`feature_std`
/// z-score the 6 DSP features from `features::extract`, then
/// `weights` (classes x features) + `biases` produce logits fed through
/// softmax. Trained by `tools/train_genre_model` and exported as JSON so
/// no ONNX runtime or other native inference dependency is needed - it's
/// a handful of floats and a matrix multiply.
#[derive(Debug, Deserialize)]
pub struct TrainedModel {
    classes: Vec<String>,
    feature_mean: [f32; 6],
    feature_std: [f32; 6],
    /// Row-major: one row of 6 weights per class.
    weights: Vec<[f32; 6]>,
    biases: Vec<f32>,
}

pub const MODEL_FILE_NAME: &str = "genre_classifier.json";

pub fn load(app_data_dir: &Path) -> Option<TrainedModel> {
    let path = app_data_dir.join("models").join(MODEL_FILE_NAME);
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn to_vector(f: &AudioFeatures) -> [f32; 6] {
    [
        f.tempo_bpm,
        f.spectral_centroid_hz,
        f.spectral_rolloff_hz,
        f.zero_crossing_rate,
        f.rms_energy,
        f.bass_ratio,
    ]
}

impl TrainedModel {
    pub fn classify(&self, features: &AudioFeatures) -> GenrePrediction {
        let raw = to_vector(features);
        let normalized: Vec<f32> = raw
            .iter()
            .zip(self.feature_mean.iter())
            .zip(self.feature_std.iter())
            .map(|((v, mean), std)| (v - mean) / std.max(1e-6))
            .collect();

        let logits: Vec<f32> = self
            .weights
            .iter()
            .zip(self.biases.iter())
            .map(|(row, bias)| {
                row.iter()
                    .zip(normalized.iter())
                    .map(|(w, x)| w * x)
                    .sum::<f32>()
                    + bias
            })
            .collect();

        let max_logit = logits.iter().cloned().fold(f32::MIN, f32::max);
        let exps: Vec<f32> = logits.iter().map(|l| (l - max_logit).exp()).collect();
        let sum: f32 = exps.iter().sum::<f32>().max(1e-9);
        let probs: Vec<f32> = exps.iter().map(|e| e / sum).collect();

        let (best_index, &best_prob) = probs
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or((0, &0.0));

        GenrePrediction {
            genre: self
                .classes
                .get(best_index)
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string()),
            confidence: best_prob,
            source: "local trained model (genre_classifier.json)".to_string(),
        }
    }
}
