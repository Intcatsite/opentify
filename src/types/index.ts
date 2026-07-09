export interface Track {
  id: string
  path: string
  title: string
  artist: string
  album: string
  genre: string | null
  duration_secs: number
  track_no: number | null
  year: number | null
  cover_data_url: string | null
  ai_genre: string | null
}

export interface Playlist {
  id: string
  name: string
  track_ids: string[]
}

export interface Library {
  tracks: Track[]
  playlists: Playlist[]
  watched_folders: string[]
}

export interface PlaybackProgress {
  position_secs: number
  is_playing: boolean
}

export type AiProviderConfig =
  | { mode: 'none' }
  | { mode: 'local' }
  | { mode: 'cloud'; endpoint: string; api_key: string; model: string }

export interface AppSettings {
  ai_provider: AiProviderConfig
  theme: string | null
}

export interface GenrePrediction {
  genre: string
  confidence: number
  source: string
}
