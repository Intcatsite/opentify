import type { AppSettings, Library } from '../types'

const LIBRARY_KEY = 'opentify:library'
const SETTINGS_KEY = 'opentify:settings'

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return { tracks: [], playlists: [], watched_folders: [] }
    return JSON.parse(raw) as Library
  } catch {
    return { tracks: [], playlists: [], watched_folders: [] }
  }
}

export function saveLibrary(library: Library): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ai_provider: { mode: 'none' }, theme: null }
    return JSON.parse(raw) as AppSettings
  } catch {
    return { ai_provider: { mode: 'none' }, theme: null }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
