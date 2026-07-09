use super::features::AudioFeatures;
use super::GenrePrediction;

/// A genre's "expected" feature profile, expressed as a target value +
/// tolerance per dimension. This is a hand-tuned v0 baseline, not a
/// trained model - it exists so genre tagging works offline out of the
/// box. Replace it by dropping a trained ONNX model at
/// `<app-data>/models/genre_classifier.onnx` (see tools/train_genre_model)
/// once one is available; `classify` already leaves room for that swap.
struct GenreProfile {
    name: &'static str,
    tempo: (f32, f32),
    centroid_hz: (f32, f32),
    rolloff_hz: (f32, f32),
    zcr: (f32, f32),
    bass_ratio: (f32, f32),
    rms_energy: (f32, f32),
}

const PROFILES: &[GenreProfile] = &[
    GenreProfile {
        name: "Electronic",
        tempo: (120.0, 30.0),
        centroid_hz: (3500.0, 1500.0),
        rolloff_hz: (6000.0, 2500.0),
        zcr: (0.10, 0.06),
        bass_ratio: (0.55, 0.2),
        rms_energy: (0.20, 0.10),
    },
    GenreProfile {
        name: "Hip-Hop",
        tempo: (90.0, 20.0),
        centroid_hz: (1800.0, 900.0),
        rolloff_hz: (3500.0, 1800.0),
        zcr: (0.07, 0.04),
        bass_ratio: (0.65, 0.15),
        rms_energy: (0.18, 0.10),
    },
    GenreProfile {
        name: "Rock",
        tempo: (125.0, 25.0),
        centroid_hz: (2500.0, 1200.0),
        rolloff_hz: (5000.0, 2200.0),
        zcr: (0.13, 0.06),
        bass_ratio: (0.45, 0.2),
        rms_energy: (0.20, 0.10),
    },
    GenreProfile {
        name: "Metal",
        tempo: (150.0, 30.0),
        centroid_hz: (3800.0, 1500.0),
        rolloff_hz: (6500.0, 2500.0),
        zcr: (0.20, 0.08),
        bass_ratio: (0.40, 0.2),
        rms_energy: (0.25, 0.10),
    },
    GenreProfile {
        name: "Pop",
        tempo: (115.0, 20.0),
        centroid_hz: (2600.0, 1000.0),
        rolloff_hz: (5000.0, 2000.0),
        zcr: (0.10, 0.05),
        bass_ratio: (0.50, 0.15),
        rms_energy: (0.18, 0.09),
    },
    GenreProfile {
        name: "Jazz",
        tempo: (100.0, 35.0),
        centroid_hz: (2000.0, 1000.0),
        rolloff_hz: (4000.0, 2000.0),
        zcr: (0.08, 0.05),
        bass_ratio: (0.45, 0.2),
        rms_energy: (0.12, 0.08),
    },
    GenreProfile {
        name: "Classical",
        tempo: (90.0, 40.0),
        centroid_hz: (1800.0, 1200.0),
        rolloff_hz: (3500.0, 2000.0),
        zcr: (0.05, 0.04),
        bass_ratio: (0.35, 0.2),
        rms_energy: (0.08, 0.06),
    },
    GenreProfile {
        name: "Ambient",
        tempo: (75.0, 30.0),
        centroid_hz: (1500.0, 1200.0),
        rolloff_hz: (3000.0, 2000.0),
        zcr: (0.04, 0.03),
        bass_ratio: (0.40, 0.25),
        rms_energy: (0.05, 0.05),
    },
];

fn score(profile: &GenreProfile, f: &AudioFeatures) -> f32 {
    let d_tempo = normalized_distance(f.tempo_bpm, profile.tempo.0, profile.tempo.1);
    let d_centroid = normalized_distance(
        f.spectral_centroid_hz,
        profile.centroid_hz.0,
        profile.centroid_hz.1,
    );
    let d_rolloff = normalized_distance(
        f.spectral_rolloff_hz,
        profile.rolloff_hz.0,
        profile.rolloff_hz.1,
    );
    let d_zcr = normalized_distance(f.zero_crossing_rate, profile.zcr.0, profile.zcr.1);
    let d_bass = normalized_distance(f.bass_ratio, profile.bass_ratio.0, profile.bass_ratio.1);
    let d_rms = normalized_distance(f.rms_energy, profile.rms_energy.0, profile.rms_energy.1);

    let total_distance = d_tempo + d_centroid + d_rolloff + d_zcr + d_bass + d_rms;
    1.0 / (1.0 + total_distance)
}

fn normalized_distance(value: f32, target: f32, tolerance: f32) -> f32 {
    ((value - target) / tolerance.max(1e-6)).abs()
}

pub fn classify_with_features(features: &AudioFeatures) -> GenrePrediction {
    let mut scored: Vec<(&str, f32)> = PROFILES
        .iter()
        .map(|p| (p.name, score(p, features)))
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let total: f32 = scored.iter().map(|(_, s)| s).sum::<f32>().max(1e-6);
    let (best_name, best_score) = scored[0];

    GenrePrediction {
        genre: best_name.to_string(),
        confidence: best_score / total,
        source: "local heuristic baseline (no trained model loaded)".to_string(),
    }
}
