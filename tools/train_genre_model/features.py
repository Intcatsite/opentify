"""Audio feature extraction mirroring src-tauri/src/ai/features.rs.

Keeping this in lock-step with the Rust implementation is what lets a
model trained here run correctly inside the Rust app: the app extracts
the same 6 numbers at inference time and feeds them into the trained
weights. If you change the math on one side, change it on the other.
"""

import numpy as np
import librosa

WINDOW_SIZE = 2048
HOP_SIZE = 1024
MAX_ANALYSIS_SECONDS = 120.0

FEATURE_NAMES = [
    "tempo_bpm",
    "spectral_centroid_hz",
    "spectral_rolloff_hz",
    "zero_crossing_rate",
    "rms_energy",
    "bass_ratio",
]


def _estimate_tempo(onset_envelope: np.ndarray, hop_seconds: float) -> float:
    if len(onset_envelope) < 4 or hop_seconds <= 0:
        return 0.0

    centered = onset_envelope - onset_envelope.mean()

    min_lag = round((60.0 / 180.0) / hop_seconds)  # 180 BPM upper bound
    max_lag = round((60.0 / 60.0) / hop_seconds)  # 60 BPM lower bound
    max_lag = min(max_lag, len(centered) - 1)

    if min_lag == 0 or min_lag >= max_lag:
        return 0.0

    best_lag, best_score = min_lag, -np.inf
    for lag in range(min_lag, max_lag + 1):
        score = float(np.dot(centered[: len(centered) - lag], centered[lag:]))
        if score > best_score:
            best_score, best_lag = score, lag

    return 60.0 / (best_lag * hop_seconds)


def extract_features(path: str) -> dict:
    mono, sample_rate = librosa.load(path, sr=None, mono=True, duration=MAX_ANALYSIS_SECONDS)
    if mono.size == 0:
        raise ValueError(f"decoded zero audio samples from {path}")

    window = np.hanning(WINDOW_SIZE)
    bin_hz = sample_rate / WINDOW_SIZE

    centroids, rolloffs, bass_ratios, onset_envelope = [], [], [], []

    pos = 0
    while pos + WINDOW_SIZE <= len(mono):
        frame = mono[pos : pos + WINDOW_SIZE] * window
        spectrum = np.fft.rfft(frame)
        magnitudes = np.abs(spectrum)[: WINDOW_SIZE // 2]
        total_energy = max(magnitudes.sum(), 1e-9)

        bins = np.arange(len(magnitudes))
        centroid = float((bins * bin_hz * magnitudes).sum() / total_energy)

        cumulative = np.cumsum(magnitudes)
        rolloff_bin = int(np.searchsorted(cumulative, 0.85 * total_energy))
        rolloff_bin = min(rolloff_bin, len(magnitudes) - 1)
        rolloff_hz = rolloff_bin * bin_hz

        bass_cutoff_bin = min(int(250.0 / bin_hz), len(magnitudes) - 1)
        bass_energy = magnitudes[: bass_cutoff_bin + 1].sum()

        centroids.append(centroid)
        rolloffs.append(rolloff_hz)
        bass_ratios.append(bass_energy / total_energy)
        onset_envelope.append(total_energy)

        pos += HOP_SIZE

    zero_crossing_rate = float(np.mean(np.abs(np.diff(np.signbit(mono).astype(np.int8)))))
    rms_energy = float(np.sqrt(np.mean(mono.astype(np.float64) ** 2)))
    hop_seconds = HOP_SIZE / sample_rate
    tempo_bpm = _estimate_tempo(np.array(onset_envelope), hop_seconds)

    return {
        "tempo_bpm": tempo_bpm,
        "spectral_centroid_hz": float(np.mean(centroids)) if centroids else 0.0,
        "spectral_rolloff_hz": float(np.mean(rolloffs)) if rolloffs else 0.0,
        "zero_crossing_rate": zero_crossing_rate,
        "rms_energy": rms_energy,
        "bass_ratio": float(np.mean(bass_ratios)) if bass_ratios else 0.0,
    }
