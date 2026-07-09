use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use base64::Engine;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::Picture;
use lofty::tag::Accessor;
use uuid::Uuid;
use walkdir::WalkDir;

use crate::models::{Library, Playlist, Track};

const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "ogg", "m4a", "aac"];

pub struct LibraryState {
    pub inner: Mutex<Library>,
    pub data_file: PathBuf,
}

impl LibraryState {
    pub fn new(data_dir: &Path) -> Self {
        let data_file = data_dir.join("library.json");
        let inner = load_from_disk(&data_file).unwrap_or_default();
        Self {
            inner: Mutex::new(inner),
            data_file,
        }
    }

    pub fn persist(&self) -> Result<(), String> {
        let library = self.inner.lock().map_err(|e| e.to_string())?;
        if let Some(parent) = self.data_file.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(&*library).map_err(|e| e.to_string())?;
        fs::write(&self.data_file, json).map_err(|e| e.to_string())
    }
}

fn load_from_disk(path: &Path) -> Option<Library> {
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str(&contents).ok()
}

fn is_supported(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Reads audio tags + cover art for a single file and builds a `Track`.
/// Falls back to filename-derived title when tags are missing so imports
/// never silently drop a file just because it lacks metadata.
pub fn read_track_metadata(path: &Path) -> Result<Track, String> {
    let tagged_file = lofty::read_from_path(path).map_err(|e| e.to_string())?;
    let properties = tagged_file.properties();
    let duration_secs = properties.duration().as_secs_f64();

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let file_stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let (title, artist, album, genre, track_no, year, cover_data_url) = match tag {
        Some(tag) => {
            let title = tag
                .title()
                .map(|s| s.to_string())
                .unwrap_or_else(|| file_stem.clone());
            let artist = tag
                .artist()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Artist".to_string());
            let album = tag
                .album()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Album".to_string());
            let genre = tag.genre().map(|s| s.to_string());
            let track_no = tag.track();
            let year = tag.year();
            let cover_data_url = tag.pictures().first().map(picture_to_data_url);
            (title, artist, album, genre, track_no, year, cover_data_url)
        }
        None => (
            file_stem,
            "Unknown Artist".to_string(),
            "Unknown Album".to_string(),
            None,
            None,
            None,
            None,
        ),
    };

    Ok(Track {
        id: Uuid::new_v4().to_string(),
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        genre,
        duration_secs,
        track_no,
        year,
        cover_data_url,
        ai_genre: None,
    })
}

fn picture_to_data_url(picture: &Picture) -> String {
    let mime = picture
        .mime_type()
        .map(|m| m.to_string())
        .unwrap_or_else(|| "image/jpeg".to_string());
    let encoded = base64::engine::general_purpose::STANDARD.encode(picture.data());
    format!("data:{mime};base64,{encoded}")
}

/// Recursively scans a folder for supported audio files and returns freshly
/// parsed tracks. Paths already present in `existing_paths` are skipped so
/// re-scanning a watched folder is cheap and doesn't duplicate library
/// entries.
pub fn scan_folder(folder: &Path, existing_paths: &[String]) -> Vec<Track> {
    WalkDir::new(folder)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.into_path())
        .filter(|path| is_supported(path))
        .filter(|path| !existing_paths.contains(&path.to_string_lossy().to_string()))
        .filter_map(|path| read_track_metadata(&path).ok())
        .collect()
}

pub fn new_playlist(name: String) -> Playlist {
    Playlist {
        id: Uuid::new_v4().to_string(),
        name,
        track_ids: Vec::new(),
    }
}
