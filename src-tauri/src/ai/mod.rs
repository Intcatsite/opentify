pub mod cloud_provider;
pub mod features;
pub mod local_classifier;
pub mod trained_classifier;

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::settings::AiProviderConfig;

#[derive(Debug, Clone, Serialize)]
pub struct GenrePrediction {
    pub genre: String,
    pub confidence: f32,
    /// Human-readable note on how this prediction was produced, e.g.
    /// "local heuristic model" or "cloud: gpt-4o-mini". Shown in the UI
    /// so users understand whether their audio left the machine.
    pub source: String,
}

pub async fn classify_genre(
    config: &AiProviderConfig,
    app_data_dir: &PathBuf,
    track_path: &str,
    title: &str,
    artist: &str,
) -> Result<GenrePrediction, String> {
    match config {
        AiProviderConfig::None => Err("AI features are disabled in settings".to_string()),
        AiProviderConfig::Local => {
            let features = features::extract(Path::new(track_path))?;
            match trained_classifier::load(app_data_dir) {
                Some(model) => Ok(model.classify(&features)),
                None => Ok(local_classifier::classify_with_features(&features)),
            }
        }
        AiProviderConfig::Cloud {
            endpoint,
            api_key,
            model,
        } => cloud_provider::classify_genre(endpoint, api_key, model, title, artist).await,
    }
}
