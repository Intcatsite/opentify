import type {
  AiProviderConfig,
  GenrePrediction,
  Playlist,
  Track,
  TrackMetadataUpdate,
} from '../types'
import type { Platform } from './types'
import { deleteBlob, getBlob, putBlob } from './db'
import { loadLibrary, loadSettings, saveLibrary, saveSettings } from './localStore'
import { getAudioDuration, parseTags } from './tags'

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac']

function isAudioFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext ? AUDIO_EXTENSIONS.includes(ext) : false
}

function titleFromFileName(name: string): string {
  return name.replace(/\.[^./]+$/, '')
}

async function fileToTrack(file: File): Promise<Track> {
  const id = crypto.randomUUID()
  await putBlob(id, file)
  const tags = await parseTags(file)
  const objectUrl = URL.createObjectURL(file)
  const duration = await getAudioDuration(objectUrl)
  URL.revokeObjectURL(objectUrl)

  return {
    id,
    path: file.name,
    title: tags.title || titleFromFileName(file.name),
    artist: tags.artist || 'Unknown Artist',
    album: tags.album || 'Unknown Album',
    genre: tags.genre ?? null,
    duration_secs: duration,
    track_no: null,
    year: null,
    cover_data_url: tags.coverDataUrl ?? null,
    ai_genre: null,
  }
}

function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : [])
      input.remove()
    }
    // Some browsers only fire onchange reliably once attached to the DOM.
    document.body.appendChild(input)
    input.click()
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// --- Playback: a single shared <audio> element, controlled like the Rust player ---

const audio = new Audio()
let currentObjectUrl: string | null = null
const progressListeners = new Set<(p: { position_secs: number; is_playing: boolean }) => void>()
const endedListeners = new Set<() => void>()

function emitProgress() {
  const payload = { position_secs: audio.currentTime, is_playing: !audio.paused && !audio.ended }
  for (const cb of progressListeners) cb(payload)
}

audio.addEventListener('timeupdate', emitProgress)
audio.addEventListener('play', emitProgress)
audio.addEventListener('pause', emitProgress)
audio.addEventListener('ended', () => {
  emitProgress()
  for (const cb of endedListeners) cb()
})

export const webPlatform: Platform = {
  name: 'web',
  supportsFolderImport: false,
  supportsLocalAi: false,

  async getLibrary() {
    return loadLibrary()
  },

  async pickAndImportFiles() {
    const files = (await pickFiles('audio/*', true)).filter((f) => isAudioFile(f.name))
    if (files.length === 0) return loadLibrary()
    const library = loadLibrary()
    for (const file of files) {
      library.tracks.push(await fileToTrack(file))
    }
    saveLibrary(library)
    return library
  },

  async pickAndImportFolder() {
    // Directory picking isn't universally supported across browsers; the
    // multi-file picker above covers the common case on a static site.
    return loadLibrary()
  },

  async removeTrack(trackId) {
    const library = loadLibrary()
    library.tracks = library.tracks.filter((t) => t.id !== trackId)
    for (const playlist of library.playlists) {
      playlist.track_ids = playlist.track_ids.filter((id) => id !== trackId)
    }
    saveLibrary(library)
    await deleteBlob(trackId)
    return library
  },

  async updateTrackMetadata(trackId, updates: TrackMetadataUpdate) {
    const library = loadLibrary()
    const track = library.tracks.find((t) => t.id === trackId)
    if (track) {
      track.title = updates.title
      track.artist = updates.artist
      track.album = updates.album
      track.genre = updates.genre
      if (updates.cover_data_url) track.cover_data_url = updates.cover_data_url
    }
    saveLibrary(library)
    return library
  },

  async setTrackGenre(trackId, genre) {
    const library = loadLibrary()
    const track = library.tracks.find((t) => t.id === trackId)
    if (track) track.ai_genre = genre
    saveLibrary(library)
    return library
  },

  async pickCoverImageDataUrl() {
    const files = await pickFiles('image/*', false)
    if (files.length === 0) return null
    return fileToDataUrl(files[0])
  },

  async createPlaylist(name) {
    const library = loadLibrary()
    const playlist: Playlist = { id: crypto.randomUUID(), name, track_ids: [] }
    library.playlists.push(playlist)
    saveLibrary(library)
    return playlist
  },

  async deletePlaylist(playlistId) {
    const library = loadLibrary()
    library.playlists = library.playlists.filter((p) => p.id !== playlistId)
    saveLibrary(library)
  },

  async addToPlaylist(playlistId, trackId) {
    const library = loadLibrary()
    const playlist = library.playlists.find((p) => p.id === playlistId)
    if (playlist && !playlist.track_ids.includes(trackId)) playlist.track_ids.push(trackId)
    saveLibrary(library)
  },

  async removeFromPlaylist(playlistId, trackId) {
    const library = loadLibrary()
    const playlist = library.playlists.find((p) => p.id === playlistId)
    if (playlist) playlist.track_ids = playlist.track_ids.filter((id) => id !== trackId)
    saveLibrary(library)
  },

  async playTrack(trackId) {
    const blob = await getBlob(trackId)
    if (!blob) return
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = URL.createObjectURL(blob)
    audio.src = currentObjectUrl
    await audio.play()
  },

  async pause() {
    audio.pause()
  },

  async resume() {
    await audio.play()
  },

  async stop() {
    audio.pause()
    audio.currentTime = 0
  },

  async seek(positionSecs) {
    audio.currentTime = positionSecs
  },

  async setVolume(volume) {
    audio.volume = Math.min(1, Math.max(0, volume))
  },

  async getSettings() {
    return loadSettings()
  },

  async setAiProvider(config: AiProviderConfig) {
    const settings = loadSettings()
    settings.ai_provider = config
    saveSettings(settings)
  },

  async classifyTrackGenre(trackId): Promise<GenrePrediction> {
    const settings = loadSettings()
    const library = loadLibrary()
    const track = library.tracks.find((t) => t.id === trackId)
    if (!track) throw new Error('track not found')
    if (settings.ai_provider.mode !== 'cloud') {
      throw new Error(
        'Local AI genre detection needs the desktop app - the browser build only supports the Cloud provider.'
      )
    }
    const { endpoint, api_key, model } = settings.ai_provider
    const prompt = `Reply with a single word: the most likely music genre for a track titled "${track.title}" by "${track.artist}". No punctuation, no explanation.`
    const response = await fetch(`${endpoint.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      }),
    })
    if (!response.ok) {
      throw new Error(`cloud AI request failed (${response.status}): ${await response.text()}`)
    }
    const json = await response.json()
    const genre = json.choices?.[0]?.message?.content?.trim()
    if (!genre) throw new Error('empty response from cloud provider')

    track.ai_genre = genre
    saveLibrary(library)
    return { genre, confidence: 1, source: `cloud: ${model}` }
  },

  onProgress(cb) {
    progressListeners.add(cb)
    return () => progressListeners.delete(cb)
  },

  onTrackEnded(cb) {
    endedListeners.add(cb)
    return () => endedListeners.delete(cb)
  },

  onFilesDropped(cb) {
    function onDragOver(e: DragEvent) {
      e.preventDefault()
    }
    async function onDrop(e: DragEvent) {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => isAudioFile(f.name))
      if (files.length === 0) return
      const library = loadLibrary()
      for (const file of files) {
        library.tracks.push(await fileToTrack(file))
      }
      saveLibrary(library)
      cb(library)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  },
}
