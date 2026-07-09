import { create } from 'zustand'
import { api } from '../api/tauri'
import type { AiProviderConfig, AppSettings, Library, PlaybackProgress, Track } from '../types'

export type RepeatMode = 'off' | 'all' | 'one'
export type View = { kind: 'library' } | { kind: 'playlist'; id: string } | { kind: 'settings' }

interface OpentifyState {
  library: Library
  settings: AppSettings
  view: View
  loading: boolean
  error: string | null

  queue: string[]
  currentIndex: number
  progress: PlaybackProgress
  volume: number
  shuffle: boolean
  repeat: RepeatMode

  init: () => Promise<void>
  setView: (view: View) => void

  importFiles: (paths: string[]) => Promise<void>
  importFolder: (folder: string) => Promise<void>
  removeTrack: (trackId: string) => Promise<void>

  createPlaylist: (name: string) => Promise<void>
  deletePlaylist: (playlistId: string) => Promise<void>
  addToPlaylist: (playlistId: string, trackId: string) => Promise<void>
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>

  playQueue: (trackIds: string[], startIndex: number) => Promise<void>
  togglePlayPause: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  seek: (positionSecs: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
  toggleShuffle: () => void
  cycleRepeat: () => void

  onProgress: (progress: PlaybackProgress) => void
  onTrackEnded: () => void

  setAiProvider: (config: AiProviderConfig) => Promise<void>
  classifyGenre: (trackId: string) => Promise<void>

  currentTrack: () => Track | undefined
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const useStore = create<OpentifyState>((set, get) => ({
  library: { tracks: [], playlists: [], watched_folders: [] },
  settings: { ai_provider: { mode: 'none' }, theme: null },
  view: { kind: 'library' },
  loading: true,
  error: null,

  queue: [],
  currentIndex: -1,
  progress: { position_secs: 0, is_playing: false },
  volume: 1,
  shuffle: false,
  repeat: 'off',

  init: async () => {
    set({ loading: true, error: null })
    try {
      const [library, settings] = await Promise.all([api.getLibrary(), api.getSettings()])
      set({ library, settings, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  setView: (view) => set({ view }),

  importFiles: async (paths) => {
    if (paths.length === 0) return
    const library = await api.addFiles(paths)
    set({ library })
  },

  importFolder: async (folder) => {
    const library = await api.scanFolder(folder)
    set({ library })
  },

  removeTrack: async (trackId) => {
    const library = await api.removeTrack(trackId)
    set({ library })
  },

  createPlaylist: async (name) => {
    const playlist = await api.createPlaylist(name)
    set((s) => ({ library: { ...s.library, playlists: [...s.library.playlists, playlist] } }))
  },

  deletePlaylist: async (playlistId) => {
    await api.deletePlaylist(playlistId)
    set((s) => ({
      library: { ...s.library, playlists: s.library.playlists.filter((p) => p.id !== playlistId) },
      view: s.view.kind === 'playlist' && s.view.id === playlistId ? { kind: 'library' } : s.view,
    }))
  },

  addToPlaylist: async (playlistId, trackId) => {
    await api.addToPlaylist(playlistId, trackId)
    set((s) => ({
      library: {
        ...s.library,
        playlists: s.library.playlists.map((p) =>
          p.id === playlistId && !p.track_ids.includes(trackId)
            ? { ...p, track_ids: [...p.track_ids, trackId] }
            : p
        ),
      },
    }))
  },

  removeFromPlaylist: async (playlistId, trackId) => {
    await api.removeFromPlaylist(playlistId, trackId)
    set((s) => ({
      library: {
        ...s.library,
        playlists: s.library.playlists.map((p) =>
          p.id === playlistId ? { ...p, track_ids: p.track_ids.filter((id) => id !== trackId) } : p
        ),
      },
    }))
  },

  playQueue: async (trackIds, startIndex) => {
    const ordered = get().shuffle ? shuffleArray(trackIds) : trackIds
    const startId = trackIds[startIndex]
    const index = get().shuffle ? ordered.indexOf(startId) : startIndex
    set({ queue: ordered, currentIndex: index, progress: { position_secs: 0, is_playing: true } })
    const track = get().library.tracks.find((t) => t.id === ordered[index])
    if (track) await api.playTrack(track.path)
  },

  togglePlayPause: async () => {
    const { progress, currentIndex } = get()
    if (currentIndex < 0) return
    if (progress.is_playing) {
      await api.pause()
      set({ progress: { ...progress, is_playing: false } })
    } else {
      await api.resume()
      set({ progress: { ...progress, is_playing: true } })
    }
  },

  next: async () => {
    const { queue, currentIndex, repeat, library } = get()
    if (queue.length === 0) return
    let nextIndex = currentIndex + 1
    if (nextIndex >= queue.length) {
      if (repeat === 'all') nextIndex = 0
      else {
        await api.stop()
        set({ progress: { position_secs: 0, is_playing: false } })
        return
      }
    }
    const track = library.tracks.find((t) => t.id === queue[nextIndex])
    set({ currentIndex: nextIndex, progress: { position_secs: 0, is_playing: true } })
    if (track) await api.playTrack(track.path)
  },

  prev: async () => {
    const { queue, currentIndex, progress, library } = get()
    if (queue.length === 0) return
    if (progress.position_secs > 3) {
      await api.seek(0)
      set({ progress: { ...progress, position_secs: 0 } })
      return
    }
    const prevIndex = Math.max(0, currentIndex - 1)
    const track = library.tracks.find((t) => t.id === queue[prevIndex])
    set({ currentIndex: prevIndex, progress: { position_secs: 0, is_playing: true } })
    if (track) await api.playTrack(track.path)
  },

  seek: async (positionSecs) => {
    await api.seek(positionSecs)
    set((s) => ({ progress: { ...s.progress, position_secs: positionSecs } }))
  },

  setVolume: async (volume) => {
    await api.setVolume(volume)
    set({ volume })
  },

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
    })),

  onProgress: (progress) => set({ progress }),

  onTrackEnded: () => {
    const { repeat } = get()
    if (repeat === 'one') {
      const track = get().currentTrack()
      if (track) api.playTrack(track.path)
      return
    }
    get().next()
  },

  setAiProvider: async (config) => {
    await api.setAiProvider(config)
    set((s) => ({ settings: { ...s.settings, ai_provider: config } }))
  },

  classifyGenre: async (trackId) => {
    const prediction = await api.classifyTrackGenre(trackId)
    set((s) => ({
      library: {
        ...s.library,
        tracks: s.library.tracks.map((t) =>
          t.id === trackId ? { ...t, ai_genre: prediction.genre } : t
        ),
      },
    }))
  },

  currentTrack: () => {
    const { queue, currentIndex, library } = get()
    const id = queue[currentIndex]
    return library.tracks.find((t) => t.id === id)
  },
}))
