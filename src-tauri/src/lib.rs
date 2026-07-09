mod ai;
mod library;
mod models;
mod player;
mod settings;

use std::path::{Path, PathBuf};
use std::sync::Arc;

use models::{Library, Playlist};
use player::{PlaybackProgress, Player};
use settings::{AiProviderConfig, AppSettings, SettingsState};
use tauri::{Manager, State};

use library::LibraryState;

struct AppState {
    library: LibraryState,
    settings: SettingsState,
    player: Arc<Player>,
    data_dir: PathBuf,
}

#[tauri::command]
fn get_library(state: State<AppState>) -> Result<Library, String> {
    state
        .library
        .inner
        .lock()
        .map_err(|e| e.to_string())
        .map(|l| l.clone())
}

#[tauri::command]
fn add_files(state: State<AppState>, paths: Vec<String>) -> Result<Library, String> {
    {
        let mut library = state.library.inner.lock().map_err(|e| e.to_string())?;
        let existing: Vec<String> = library.tracks.iter().map(|t| t.path.clone()).collect();
        for path in paths {
            if existing.contains(&path) {
                continue;
            }
            if let Ok(track) = library::read_track_metadata(Path::new(&path)) {
                library.tracks.push(track);
            }
        }
    }
    state.library.persist()?;
    state
        .library
        .inner
        .lock()
        .map_err(|e| e.to_string())
        .map(|l| l.clone())
}

#[tauri::command]
fn scan_folder(state: State<AppState>, folder: String) -> Result<Library, String> {
    {
        let mut library = state.library.inner.lock().map_err(|e| e.to_string())?;
        let existing: Vec<String> = library.tracks.iter().map(|t| t.path.clone()).collect();
        let found = library::scan_folder(Path::new(&folder), &existing);
        library.tracks.extend(found);
        if !library.watched_folders.contains(&folder) {
            library.watched_folders.push(folder);
        }
    }
    state.library.persist()?;
    state
        .library
        .inner
        .lock()
        .map_err(|e| e.to_string())
        .map(|l| l.clone())
}

#[tauri::command]
fn remove_track(state: State<AppState>, track_id: String) -> Result<Library, String> {
    {
        let mut library = state.library.inner.lock().map_err(|e| e.to_string())?;
        library.tracks.retain(|t| t.id != track_id);
        for playlist in library.playlists.iter_mut() {
            playlist.track_ids.retain(|id| id != &track_id);
        }
    }
    state.library.persist()?;
    state
        .library
        .inner
        .lock()
        .map_err(|e| e.to_string())
        .map(|l| l.clone())
}

#[tauri::command]
fn create_playlist(state: State<AppState>, name: String) -> Result<Playlist, String> {
    let playlist = library::new_playlist(name);
    {
        let mut library = state.library.inner.lock().map_err(|e| e.to_string())?;
        library.playlists.push(playlist.clone());
    }
    state.library.persist()?;
    Ok(playlist)
}

#[tauri::command]
fn delete_playlist(state: State<AppState>, playlist_id: String) -> Result<(), String> {
    {
        let mut library = state.library.inner.lock().map_err(|e| e.to_string())?;
        library.playlists.retain(|p| p.id != playlist_id);
    }
    state.library.persist()
}

#[tauri::command]
fn add_to_playlist(
    state: State<AppState>,
    playlist_id: String,
    track_id: String,
) -> Result<(), String> {
    {
        let mut library = state.library.inner.lock().map_err(|e| e.to_string())?;
        if let Some(playlist) = library.playlists.iter_mut().find(|p| p.id == playlist_id) {
            if !playlist.track_ids.contains(&track_id) {
                playlist.track_ids.push(track_id);
            }
        }
    }
    state.library.persist()
}

#[tauri::command]
fn remove_from_playlist(
    state: State<AppState>,
    playlist_id: String,
    track_id: String,
) -> Result<(), String> {
    {
        let mut library = state.library.inner.lock().map_err(|e| e.to_string())?;
        if let Some(playlist) = library.playlists.iter_mut().find(|p| p.id == playlist_id) {
            playlist.track_ids.retain(|id| id != &track_id);
        }
    }
    state.library.persist()
}

#[tauri::command]
fn play_track(state: State<AppState>, path: String) -> Result<(), String> {
    state.player.play_path(&path)
}

#[tauri::command]
fn pause_playback(state: State<AppState>) -> Result<(), String> {
    state.player.pause()
}

#[tauri::command]
fn resume_playback(state: State<AppState>) -> Result<(), String> {
    state.player.resume()
}

#[tauri::command]
fn stop_playback(state: State<AppState>) -> Result<(), String> {
    state.player.stop()
}

#[tauri::command]
fn seek_playback(state: State<AppState>, position_secs: f64) -> Result<(), String> {
    state.player.seek(position_secs)
}

#[tauri::command]
fn set_volume(state: State<AppState>, volume: f32) -> Result<(), String> {
    state.player.set_volume(volume)
}

#[tauri::command]
fn get_progress(state: State<AppState>) -> Result<PlaybackProgress, String> {
    state.player.progress()
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Result<AppSettings, String> {
    state
        .settings
        .inner
        .lock()
        .map_err(|e| e.to_string())
        .map(|s| s.clone())
}

#[tauri::command]
fn set_ai_provider(state: State<AppState>, config: AiProviderConfig) -> Result<(), String> {
    {
        let mut settings = state.settings.inner.lock().map_err(|e| e.to_string())?;
        settings.ai_provider = config;
    }
    state.settings.persist()
}

#[tauri::command]
async fn classify_track_genre(
    state: State<'_, AppState>,
    track_id: String,
) -> Result<ai::GenrePrediction, String> {
    let (path, title, artist, config) = {
        let library = state.library.inner.lock().map_err(|e| e.to_string())?;
        let track = library
            .tracks
            .iter()
            .find(|t| t.id == track_id)
            .ok_or("track not found")?;
        let settings = state.settings.inner.lock().map_err(|e| e.to_string())?;
        (
            track.path.clone(),
            track.title.clone(),
            track.artist.clone(),
            settings.ai_provider.clone(),
        )
    };

    let prediction = ai::classify_genre(&config, &state.data_dir, &path, &title, &artist).await?;

    {
        let mut library = state.library.inner.lock().map_err(|e| e.to_string())?;
        if let Some(track) = library.tracks.iter_mut().find(|t| t.id == track_id) {
            track.ai_genre = Some(prediction.genre.clone());
        }
    }
    state.library.persist()?;

    Ok(prediction)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();

            let player = Arc::new(Player::new().expect("failed to initialize audio output"));
            player.ensure_watcher(app.handle().clone());

            app.manage(AppState {
                library: LibraryState::new(&data_dir),
                settings: SettingsState::new(&data_dir),
                player,
                data_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_library,
            add_files,
            scan_folder,
            remove_track,
            create_playlist,
            delete_playlist,
            add_to_playlist,
            remove_from_playlist,
            play_track,
            pause_playback,
            resume_playback,
            stop_playback,
            seek_playback,
            set_volume,
            get_progress,
            get_settings,
            set_ai_provider,
            classify_track_genre,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
