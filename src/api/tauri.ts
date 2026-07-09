import { invoke } from '@tauri-apps/api/core'
import type {
  AiProviderConfig,
  AppSettings,
  GenrePrediction,
  Library,
  Playlist,
  TrackMetadataUpdate,
} from '../types'

export const api = {
  getLibrary: () => invoke<Library>('get_library'),
  addFiles: (paths: string[]) => invoke<Library>('add_files', { paths }),
  scanFolder: (folder: string) => invoke<Library>('scan_folder', { folder }),
  removeTrack: (trackId: string) => invoke<Library>('remove_track', { trackId }),
  updateTrackMetadata: (trackId: string, updates: TrackMetadataUpdate) =>
    invoke<Library>('update_track_metadata', { trackId, updates }),

  createPlaylist: (name: string) => invoke<Playlist>('create_playlist', { name }),
  deletePlaylist: (playlistId: string) => invoke<void>('delete_playlist', { playlistId }),
  addToPlaylist: (playlistId: string, trackId: string) =>
    invoke<void>('add_to_playlist', { playlistId, trackId }),
  removeFromPlaylist: (playlistId: string, trackId: string) =>
    invoke<void>('remove_from_playlist', { playlistId, trackId }),

  playTrack: (path: string) => invoke<void>('play_track', { path }),
  pause: () => invoke<void>('pause_playback'),
  resume: () => invoke<void>('resume_playback'),
  stop: () => invoke<void>('stop_playback'),
  seek: (positionSecs: number) => invoke<void>('seek_playback', { positionSecs }),
  setVolume: (volume: number) => invoke<void>('set_volume', { volume }),

  getSettings: () => invoke<AppSettings>('get_settings'),
  setAiProvider: (config: AiProviderConfig) => invoke<void>('set_ai_provider', { config }),
  classifyTrackGenre: (trackId: string) =>
    invoke<GenrePrediction>('classify_track_genre', { trackId }),
}
