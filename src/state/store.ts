import { create } from 'zustand'
import { platform } from '../platform'
import type {
  AiProviderConfig,
  AppSettings,
  Library,
  PlaybackProgress,
  Track,
  TrackMetadataUpdate,
} from '../types'

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

  analyzing: { current: number; total: number } | null

  init: () => Promise<void>
  setView: (view: View) => void

  importFiles: () => Promise<void>
  importFolder: () => Promise<void>
  handleDroppedLibrary: (library: Library) => Promise<void>
  removeTrack: (trackId: string) => Promise<void>
  updateTrackMetadata: (trackId: string, updates: TrackMetadataUpdate) => Promise<void>
  setTrackGenre: (trackId: string, genre: string) => Promise<void>

  nowPlayingOpen: boolean
  setNowPlayingOpen: (open: boolean) => void

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

export const useStore = create<OpentifyState>((set, get) => {
  async function classifyNewTracks(trackIds: string[]) {
    if (trackIds.length === 0 || get().settings.ai_provider.mode === 'none') return
    set({ analyzing: { current: 0, total: trackIds.length } })
    for (let i = 0; i < trackIds.length; i++) {
      try {
        await get().classifyGenre(trackIds[i])
      } catch (e) {
        console.error(e)
      }
      set({ analyzing: { current: i + 1, total: trackIds.length } })
    }
    set({ analyzing: null })
  }

  async function applyImportedLibrary(library: Library) {
    const existingIds = new Set(get().library.tracks.map((t) => t.id))
    set({ library })
    const newIds = library.tracks.map((t) => t.id).filter((id) => !existingIds.has(id))
    await classifyNewTracks(newIds)
  }

  return {
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
  nowPlayingOpen: false,
  analyzing: null,

  init: async () => {
    set({ loading: true, error: null })
    try {
      const [library, settings] = await Promise.all([platform.getLibrary(), platform.getSettings()])
      set({ library, settings, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  setView: (view) => set({ view }),
  setNowPlayingOpen: (nowPlayingOpen) => set({ nowPlayingOpen }),

  importFiles: async () => {
    const library = await platform.pickAndImportFiles()
    await applyImportedLibrary(library)
  },

  importFolder: async () => {
    const library = await platform.pickAndImportFolder()
    await applyImportedLibrary(library)
  },

  handleDroppedLibrary: async (library) => {
    await applyImportedLibrary(library)
  },

  removeTrack: async (trackId) => {
    const library = await platform.removeTrack(trackId)
    set({ library })
  },

  updateTrackMetadata: async (trackId, updates) => {
    const library = await platform.updateTrackMetadata(trackId, updates)
    set({ library })
  },

  setTrackGenre: async (trackId, genre) => {
    const library = await platform.setTrackGenre(trackId, genre)
    set({ library })
  },

  createPlaylist: async (name) => {
    const playlist = await platform.createPlaylist(name)
    set((s) => ({ library: { ...s.library, playlists: [...s.library.playlists, playlist] } }))
  },

  deletePlaylist: async (playlistId) => {
    await platform.deletePlaylist(playlistId)
    set((s) => ({
      library: { ...s.library, playlists: s.library.playlists.filter((p) => p.id !== playlistId) },
      view: s.view.kind === 'playlist' && s.view.id === playlistId ? { kind: 'library' } : s.view,
    }))
  },

  addToPlaylist: async (playlistId, trackId) => {
    await platform.addToPlaylist(playlistId, trackId)
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
    await platform.removeFromPlaylist(playlistId, trackId)
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
    if (track) await platform.playTrack(track.id)
  },

  togglePlayPause: async () => {
    const { progress, currentIndex } = get()
    if (currentIndex < 0) return
    if (progress.is_playing) {
      await platform.pause()
      set({ progress: { ...progress, is_playing: false } })
    } else {
      await platform.resume()
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
        await platform.stop()
        set({ progress: { position_secs: 0, is_playing: false } })
        return
      }
    }
    const track = library.tracks.find((t) => t.id === queue[nextIndex])
    set({ currentIndex: nextIndex, progress: { position_secs: 0, is_playing: true } })
    if (track) await platform.playTrack(track.id)
  },

  prev: async () => {
    const { queue, currentIndex, progress, library } = get()
    if (queue.length === 0) return
    if (progress.position_secs > 3) {
      await platform.seek(0)
      set({ progress: { ...progress, position_secs: 0 } })
      return
    }
    const prevIndex = Math.max(0, currentIndex - 1)
    const track = library.tracks.find((t) => t.id === queue[prevIndex])
    set({ currentIndex: prevIndex, progress: { position_secs: 0, is_playing: true } })
    if (track) await platform.playTrack(track.id)
  },

  seek: async (positionSecs) => {
    await platform.seek(positionSecs)
    set((s) => ({ progress: { ...s.progress, position_secs: positionSecs } }))
  },

  setVolume: async (volume) => {
    await platform.setVolume(volume)
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
      if (track) platform.playTrack(track.id)
      return
    }
    get().next()
  },

  setAiProvider: async (config) => {
    await platform.setAiProvider(config)
    set((s) => ({ settings: { ...s.settings, ai_provider: config } }))
  },

  classifyGenre: async (trackId) => {
    const prediction = await platform.classifyTrackGenre(trackId)
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
  }
})
