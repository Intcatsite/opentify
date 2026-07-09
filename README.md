# Opentify

A local-first, open-source music player. Point it at your own MP3/WAV/FLAC/OGG
files, get a Spotify-like library, playlists, and playback - with optional AI
genre tagging that runs either fully offline or through your own cloud
provider. No account, no streaming service, no telemetry.

Built with [Tauri](https://tauri.app) (Rust) + React/TypeScript, so it ships
as a small native app (`.exe` / `.app` / AppImage) instead of an Electron
bundle. The same UI also runs as a static site (no backend at all) at
**https://intcatsite.github.io/opentify/** - see
[Running in the browser](#running-in-the-browser) below.

## Features

- Import individual files or scan whole folders (recursively) for audio
- Drag & drop files onto the window to import them
- Reads embedded tags (title/artist/album/genre/year/cover art) via `lofty`
- Playback with play/pause/seek/volume/shuffle/repeat, backed by `rodio`
- Playlists: create, rename via delete+recreate, add/remove tracks
- AI genre detection per track, with three provider modes:
  - **Off** - no AI features
  - **Local model** - runs fully offline: a small DSP feature extractor
    (tempo, spectral centroid/rolloff, zero-crossing rate, RMS, bass ratio)
    feeds either a hand-tuned heuristic baseline (default, zero setup) or a
    trained micro-model you drop in yourself (see
    [`tools/train_genre_model`](tools/train_genre_model))
  - **Cloud** - bring your own OpenAI-compatible endpoint + API key; only
    the track title/artist are sent, never the audio file

## Project layout

```
src/                 React + TypeScript frontend
src-tauri/           Rust backend (Tauri commands, audio, AI)
  src/library.rs     File scanning + tag reading, JSON-backed library store
  src/player.rs      rodio-based playback engine (runs on its own thread)
  src/ai/            Genre-detection provider abstraction (local + cloud)
tools/train_genre_model/   Python pipeline to train a real local genre model
```

## Development

Requirements: Rust (stable), Node 22+. On Linux you'll also need the
webkit2gtk/gtk3/alsa dev packages Tauri needs to build - see
`.github/workflows/build.yml` for the exact `apt-get install` list.

```bash
npm install
npm run tauri dev
```

## Building

```bash
npm run tauri build
```

Produces a platform-native installer/bundle in
`src-tauri/target/release/bundle/` (an `.exe`/installer on Windows, `.app`/dmg
on macOS, `.deb`/AppImage on Linux). Cross-platform builds are handled by
[`.github/workflows/release.yml`](.github/workflows/release.yml), which
builds all three platforms in CI and attaches them to a GitHub Release when
you push a `v*` tag.

## Running in the browser

`src/platform` abstracts everything platform-specific, so the exact same UI
also runs as a plain static site with no install and no backend:

- Audio files are imported via the browser file picker or drag & drop and
  stored as blobs in IndexedDB; playback runs through a normal `<audio>`
  element
- ID3v2 (MP3) and FLAC tags are parsed client-side; other formats fall back
  to the filename
- Library/playlists/settings live in `localStorage` - private to that
  browser, gone if you clear site data, never uploaded anywhere
- Folder import and local (offline DSP) AI genre detection need real
  filesystem/audio access, so those are desktop-only; the Cloud AI provider
  works identically in both

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds this
target (`GITHUB_PAGES=true npm run build`, which sets the `/opentify/` base
path) and publishes it to GitHub Pages on every push.

## AI genre detection

Configure this in Settings inside the app. "Local model" works out of the
box with no setup - it uses a lightweight heuristic baseline. To improve
accuracy with a real trained model, see
[`tools/train_genre_model/README.md`](tools/train_genre_model/README.md) for
the full train-and-export pipeline (no ONNX runtime or other native ML
dependency required - the exported model is a small JSON weight file).

## License

MIT
