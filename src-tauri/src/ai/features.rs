use std::fs::File;
use std::path::Path;

use rustfft::{num_complex::Complex, FftPlanner};
use symphonia::core::audio::{AudioBufferRef, Signal};
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

const WINDOW_SIZE: usize = 2048;
const HOP_SIZE: usize = 1024;

/// Coarse audio-DSP features used by the heuristic baseline genre model.
/// These are intentionally simple (no MFCCs/mel-filterbanks) so they run
/// fast and without extra dependencies; swap in `local_onnx` once a real
/// trained model is available (see tools/train_genre_model).
#[derive(Debug, Clone, Default)]
pub struct AudioFeatures {
    pub tempo_bpm: f32,
    pub spectral_centroid_hz: f32,
    pub spectral_rolloff_hz: f32,
    pub zero_crossing_rate: f32,
    pub rms_energy: f32,
    pub bass_ratio: f32,
}

/// Decodes the file with symphonia, downmixes to mono, and computes
/// windowed spectral + time-domain features across the whole track.
pub fn extract(path: &Path) -> Result<AudioFeatures, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| e.to_string())?;
    let mut format = probed.format;

    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != symphonia::core::codecs::CODEC_TYPE_NULL)
        .ok_or("no decodable audio track found")?
        .clone();

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| e.to_string())?;
    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100) as f32;

    let mut mono: Vec<f32> = Vec::new();
    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(_) => break,
        };
        if packet.track_id() != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(_) => continue,
        };
        append_downmixed(&decoded, &mut mono);
        // Cap analysis to ~2 minutes of audio; plenty for stable averages
        // and keeps classification snappy on long tracks.
        if mono.len() as f32 / sample_rate > 120.0 {
            break;
        }
    }

    if mono.is_empty() {
        return Err("decoded zero audio samples".to_string());
    }

    Ok(compute_features(&mono, sample_rate))
}

fn append_downmixed(decoded: &AudioBufferRef, out: &mut Vec<f32>) {
    match decoded {
        AudioBufferRef::F32(buf) => downmix_planes(buf.planes().planes(), out),
        AudioBufferRef::U8(buf) => downmix_generic(buf, out),
        AudioBufferRef::U16(buf) => downmix_generic(buf, out),
        AudioBufferRef::U24(buf) => downmix_generic(buf, out),
        AudioBufferRef::U32(buf) => downmix_generic(buf, out),
        AudioBufferRef::S8(buf) => downmix_generic(buf, out),
        AudioBufferRef::S16(buf) => downmix_generic(buf, out),
        AudioBufferRef::S24(buf) => downmix_generic(buf, out),
        AudioBufferRef::S32(buf) => downmix_generic(buf, out),
        AudioBufferRef::F64(buf) => downmix_generic(buf, out),
    }
}

fn downmix_planes(planes: &[&[f32]], out: &mut Vec<f32>) {
    if planes.is_empty() {
        return;
    }
    let len = planes[0].len();
    for i in 0..len {
        let sum: f32 = planes.iter().map(|p| p[i]).sum();
        out.push(sum / planes.len() as f32);
    }
}

fn downmix_generic<S>(buf: &symphonia::core::audio::AudioBuffer<S>, out: &mut Vec<f32>)
where
    S: symphonia::core::sample::Sample + symphonia::core::conv::IntoSample<f32>,
{
    let channels = buf.spec().channels.count().max(1);
    let planes = buf.planes();
    let raw_planes = planes.planes();
    let len = buf.frames();
    for i in 0..len {
        let mut sum = 0f32;
        for ch in 0..channels {
            sum += symphonia::core::conv::IntoSample::<f32>::into_sample(raw_planes[ch][i]);
        }
        out.push(sum / channels as f32);
    }
}

fn compute_features(mono: &[f32], sample_rate: f32) -> AudioFeatures {
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(WINDOW_SIZE);

    let mut centroid_sum = 0f64;
    let mut rolloff_sum = 0f64;
    let mut bass_ratio_sum = 0f64;
    let mut window_count = 0u32;
    let mut onset_envelope: Vec<f32> = Vec::new();

    let mut pos = 0;
    while pos + WINDOW_SIZE <= mono.len() {
        let frame = &mono[pos..pos + WINDOW_SIZE];

        // Hann window to reduce spectral leakage before the FFT.
        let mut buffer: Vec<Complex<f32>> = frame
            .iter()
            .enumerate()
            .map(|(i, &s)| {
                let w = 0.5
                    - 0.5
                        * (2.0 * std::f32::consts::PI * i as f32 / (WINDOW_SIZE - 1) as f32).cos();
                Complex::new(s * w, 0.0)
            })
            .collect();
        fft.process(&mut buffer);

        let half = WINDOW_SIZE / 2;
        let magnitudes: Vec<f32> = buffer[..half].iter().map(|c| c.norm()).collect();
        let total_energy: f32 = magnitudes.iter().sum::<f32>().max(1e-9);

        let bin_hz = sample_rate / WINDOW_SIZE as f32;
        let centroid: f32 = magnitudes
            .iter()
            .enumerate()
            .map(|(i, &m)| i as f32 * bin_hz * m)
            .sum::<f32>()
            / total_energy;

        let rolloff_threshold = total_energy * 0.85;
        let mut cumulative = 0f32;
        let mut rolloff_bin = half - 1;
        for (i, &m) in magnitudes.iter().enumerate() {
            cumulative += m;
            if cumulative >= rolloff_threshold {
                rolloff_bin = i;
                break;
            }
        }
        let rolloff_hz = rolloff_bin as f32 * bin_hz;

        let bass_cutoff_bin = ((250.0 / bin_hz) as usize).min(half - 1);
        let bass_energy: f32 = magnitudes[..=bass_cutoff_bin].iter().sum();

        centroid_sum += centroid as f64;
        rolloff_sum += rolloff_hz as f64;
        bass_ratio_sum += (bass_energy / total_energy) as f64;
        onset_envelope.push(total_energy);
        window_count += 1;

        pos += HOP_SIZE;
    }

    let window_count = window_count.max(1);

    let zero_crossing_rate = {
        let crossings = mono
            .windows(2)
            .filter(|w| (w[0] >= 0.0) != (w[1] >= 0.0))
            .count();
        crossings as f32 / mono.len() as f32
    };

    let rms_energy = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();

    let hop_seconds = HOP_SIZE as f32 / sample_rate;
    let tempo_bpm = estimate_tempo(&onset_envelope, hop_seconds);

    AudioFeatures {
        tempo_bpm,
        spectral_centroid_hz: (centroid_sum / window_count as f64) as f32,
        spectral_rolloff_hz: (rolloff_sum / window_count as f64) as f32,
        zero_crossing_rate,
        rms_energy,
        bass_ratio: (bass_ratio_sum / window_count as f64) as f32,
    }
}

/// Estimates tempo by autocorrelating the onset-strength envelope and
/// picking the strongest periodicity within a plausible musical tempo
/// range (60-180 BPM), a common lightweight approach to beat tracking.
fn estimate_tempo(onset_envelope: &[f32], hop_seconds: f32) -> f32 {
    if onset_envelope.len() < 4 || hop_seconds <= 0.0 {
        return 0.0;
    }

    let mean = onset_envelope.iter().sum::<f32>() / onset_envelope.len() as f32;
    let centered: Vec<f32> = onset_envelope.iter().map(|v| v - mean).collect();

    let min_lag = ((60.0 / 180.0) / hop_seconds).round() as usize; // 180 BPM upper bound
    let max_lag = ((60.0 / 60.0) / hop_seconds).round() as usize; // 60 BPM lower bound
    let max_lag = max_lag.min(centered.len().saturating_sub(1));

    if min_lag == 0 || min_lag >= max_lag {
        return 0.0;
    }

    let mut best_lag = min_lag;
    let mut best_score = f32::MIN;
    for lag in min_lag..=max_lag {
        let score: f32 = centered
            .iter()
            .zip(centered.iter().skip(lag))
            .map(|(a, b)| a * b)
            .sum();
        if score > best_score {
            best_score = score;
            best_lag = lag;
        }
    }

    60.0 / (best_lag as f32 * hop_seconds)
}
