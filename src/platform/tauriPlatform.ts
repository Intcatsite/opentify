import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import type {
  AiProviderConfig,
  AppSettings,
  GenrePrediction,
  Library,
  PlaybackProgress,
  Playlist,
  TrackMetadataUpdate,
} from '../types'
import type { Platform } from './types'

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac']

let cachedLibrary: Library | null = null

async function refresh(library: Library): Promise<Library> {
  cachedLibrary = library
  return library
}

export const tauriPlatform: Platform = {
  name: 'tauri',
  supportsFolderImport: true,
  supportsLocalAi: true,

  async getLibrary() {
    const library = await invoke<Library>('get_library')
    return refresh(library)
  },

  async pickAndImportFiles() {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }],
    })
    if (!selected) return cachedLibrary ?? (await this.getLibrary())
    const paths = Array.isArray(selected) ? selected : [selected]
    const library = await invoke<Library>('add_files', { paths })
    return refresh(library)
  },

  async pickAndImportFolder() {
    const selected = await open({ directory: true })
    if (!selected || Array.isArray(selected)) return cachedLibrary ?? (await this.getLibrary())
    const library = await invoke<Library>('scan_folder', { folder: selected })
    return refresh(library)
  },

  async removeTrack(trackId) {
    const library = await invoke<Library>('remove_track', { trackId })
    return refresh(library)
  },

  async updateTrackMetadata(trackId, updates: TrackMetadataUpdate) {
    const library = await invoke<Library>('update_track_metadata', { trackId, updates })
    return refresh(library)
  },

  async setTrackGenre(trackId, genre) {
    const library = await invoke<Library>('set_track_genre', { trackId, genre })
    return refresh(library)
  },

  async pickCoverImageDataUrl() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    })
    if (!selected || Array.isArray(selected)) return null
    return invoke<string>('read_image_as_data_url', { path: selected })
  },

  createPlaylist: (name: string) => invoke<Playlist>('create_playlist', { name }),
  deletePlaylist: (playlistId: string) => invoke<void>('delete_playlist', { playlistId }),
  addToPlaylist: (playlistId: string, trackId: string) =>
    invoke<void>('add_to_playlist', { playlistId, trackId }),
  removeFromPlaylist: (playlistId: string, trackId: string) =>
    invoke<void>('remove_from_playlist', { playlistId, trackId }),

  async playTrack(trackId) {
    const library = cachedLibrary ?? (await this.getLibrary())
    const track = library.tracks.find((t) => t.id === trackId)
    if (!track) return
    await invoke<void>('play_track', { path: track.path })
  },
  pause: () => invoke<void>('pause_playback'),
  resume: () => invoke<void>('resume_playback'),
  stop: () => invoke<void>('stop_playback'),
  seek: (positionSecs: number) => invoke<void>('seek_playback', { positionSecs }),
  setVolume: (volume: number) => invoke<void>('set_volume', { volume }),

  getSettings: () => invoke<AppSettings>('get_settings'),
  setAiProvider: (config: AiProviderConfig) => invoke<void>('set_ai_provider', { config }),
  classifyTrackGenre: (trackId: string) =>
    invoke<GenrePrediction>('classify_track_genre', { trackId }),

  onProgress(cb) {
    const unlisten = listen<PlaybackProgress>('player://progress', (event) => cb(event.payload))
    return () => {
      unlisten.then((f) => f())
    }
  },

  onTrackEnded(cb) {
    const unlisten = listen('player://ended', () => cb())
    return () => {
      unlisten.then((f) => f())
    }
  },

  onFilesDropped(cb) {
    const webview = getCurrentWebviewWindow()
    const unlisten = webview.onDragDropEvent(async (event) => {
      if (event.payload.type !== 'drop') return
      const paths = event.payload.paths.filter((p) => {
        const ext = p.split('.').pop()?.toLowerCase()
        return ext ? AUDIO_EXTENSIONS.includes(ext) : false
      })
      if (paths.length === 0) return
      const library = await invoke<Library>('add_files', { paths })
      cb(await refresh(library))
    })
    return () => {
      unlisten.then((f) => f())
    }
  },
}
