import type {
  AiProviderConfig,
  AppSettings,
  GenrePrediction,
  Library,
  Playlist,
  TrackMetadataUpdate,
} from '../types'

/**
 * Everything the UI needs from "the backend", abstracted so the exact same
 * React app can run either inside Tauri (native file access, a real audio
 * device, Rust-side DSP) or as a plain static site on GitHub Pages (browser
 * File/IndexedDB storage, an HTML5 <audio> element, no local AI DSP).
 */
export interface Platform {
  name: 'tauri' | 'web'
  supportsFolderImport: boolean
  supportsLocalAi: boolean

  getLibrary(): Promise<Library>
  pickAndImportFiles(): Promise<Library>
  pickAndImportFolder(): Promise<Library>
  removeTrack(trackId: string): Promise<Library>
  updateTrackMetadata(trackId: string, updates: TrackMetadataUpdate): Promise<Library>
  setTrackGenre(trackId: string, genre: string): Promise<Library>
  /** Opens an image picker and resolves to a ready-to-use `data:` URL, or null if cancelled. */
  pickCoverImageDataUrl(): Promise<string | null>

  createPlaylist(name: string): Promise<Playlist>
  deletePlaylist(playlistId: string): Promise<void>
  addToPlaylist(playlistId: string, trackId: string): Promise<void>
  removeFromPlaylist(playlistId: string, trackId: string): Promise<void>

  /** `trackId` rather than a raw path/URL - each platform resolves its own source. */
  playTrack(trackId: string): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<void>
  seek(positionSecs: number): Promise<void>
  setVolume(volume: number): Promise<void>

  getSettings(): Promise<AppSettings>
  setAiProvider(config: AiProviderConfig): Promise<void>
  classifyTrackGenre(trackId: string): Promise<GenrePrediction>

  onProgress(cb: (p: { position_secs: number; is_playing: boolean }) => void): () => void
  onTrackEnded(cb: () => void): () => void
  /** Platform handles its own OS/browser drag-drop plumbing and imports the files itself. */
  onFilesDropped(cb: (library: Library) => void): () => void
}
