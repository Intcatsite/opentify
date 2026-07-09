# Training the local genre classifier

Opentify's "Local model" AI provider ships with a hand-tuned heuristic
baseline (`src-tauri/src/ai/local_classifier.rs`) so genre detection works
offline out of the box, with no dataset or training step required. This
folder lets you replace that baseline with a real trained micro-model.

The model is intentionally tiny: a softmax (multinomial logistic)
regression over 6 audio features - tempo, spectral centroid, spectral
rolloff, zero-crossing rate, RMS energy, and a bass-energy ratio. That's a
few dozen floats total, so the Rust app can run inference with a plain
dot product (`src-tauri/src/ai/trained_classifier.rs`) - no ONNX runtime
or other native ML dependency needed.

## 1. Get a labeled dataset

Any folder of audio files organized as `<genre>/<file>` works, e.g. the
classic [GTZAN](https://www.kaggle.com/datasets/andradaolteanu/gtzan-dataset-music-genre-classification)
layout:

```
dataset/
  blues/blues.00000.wav
  classical/classical.00000.wav
  ...
```

GTZAN and similar datasets have their own licenses - download and use them
under their own terms; they are not bundled with this repo.

## 2. Install dependencies

```
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Extract features

```
python extract_dataset.py --dataset-dir dataset --out features.csv
```

This computes the same 6 features the Rust app computes at inference
time (see `features.py` - kept in lock-step with
`src-tauri/src/ai/features.rs`). If you ever change the feature math,
change it in both places or the trained weights won't line up with what
the app extracts at runtime.

## 4. Train and export

```
python train.py --features features.csv --out genre_classifier.json
```

Prints train/test accuracy and writes `genre_classifier.json`.

## 5. Install the model into the app

Copy `genre_classifier.json` into the app's data directory, under a
`models/` subfolder:

- Linux: `~/.local/share/com.opentify.app/models/genre_classifier.json`
- macOS: `~/Library/Application Support/com.opentify.app/models/genre_classifier.json`
- Windows: `%APPDATA%\com.opentify.app\models\genre_classifier.json`

Restart Opentify. When "Local model" is selected in Settings, the app
loads this file automatically and uses it instead of the heuristic
baseline - `classify_track_genre`'s `source` field will say
`local trained model (genre_classifier.json)` once it's active.

## Notes on accuracy

Six hand-picked DSP features and a linear classifier are not going to
match a deep audio model - this is deliberately the simplest thing that
can be called a trained model and still run with zero extra runtime
dependencies. If you want to go further, a natural next step is a small
MLP (one hidden layer) on the same features, or richer features
(MFCCs, chroma) - both would require extending `TrainedModel` in Rust to
do more than one matmul, and extending `features.rs`/`features.py` in
lock-step.
