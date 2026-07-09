import { useState } from 'react'
import { useStore } from '../state/store'
import type { Track } from '../types'
import { IconEdit, IconMore, IconNote, IconPlay, IconTrash } from './icons'
import { EditTrackModal } from './EditTrackModal'

function formatDuration(secs: number): string {
  const total = Math.max(0, Math.floor(secs))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface TrackRowProps {
  track: Track
  index: number
  isActive: boolean
  isPlaying: boolean
  onPlay: () => void
}

export function TrackRow({ track, index, isActive, isPlaying, onPlay }: TrackRowProps) {
  const library = useStore((s) => s.library)
  const addToPlaylist = useStore((s) => s.addToPlaylist)
  const removeTrack = useStore((s) => s.removeTrack)
  const classifyGenre = useStore((s) => s.classifyGenre)
  const aiMode = useStore((s) => s.settings.ai_provider.mode)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [classifying, setClassifying] = useState(false)

  async function handleClassify() {
    setClassifying(true)
    try {
      await classifyGenre(track.id)
    } catch (e) {
      console.error(e)
    } finally {
      setClassifying(false)
    }
  }

  const genreLabel = track.ai_genre ?? track.genre

  return (
    <div className={`track-row ${isActive ? 'active' : ''}`} onDoubleClick={onPlay}>
      <div className="track-row-index" onClick={onPlay}>
        {isActive && isPlaying ? <IconPlay className="playing-indicator" /> : index + 1}
      </div>
      <div className="track-row-cover">
        {track.cover_data_url ? (
          <img src={track.cover_data_url} alt="" />
        ) : (
          <div className="cover-placeholder">
            <IconNote />
          </div>
        )}
      </div>
      <div className="track-row-info">
        <div className="track-row-title">{track.title}</div>
        <div className="track-row-artist">{track.artist}</div>
      </div>
      <div className="track-row-album">{track.album}</div>
      <div className="track-row-genre">
        {genreLabel ? (
          <span className={`genre-badge ${track.ai_genre ? 'ai' : ''}`}>{genreLabel}</span>
        ) : aiMode !== 'none' ? (
          <button className="ghost-button" disabled={classifying} onClick={handleClassify}>
            {classifying ? 'Detecting…' : 'Detect genre'}
          </button>
        ) : (
          <span className="track-row-genre-empty">—</span>
        )}
      </div>
      <div className="track-row-duration">{formatDuration(track.duration_secs)}</div>
      <div className="track-row-edit">
        <button className="icon-button" onClick={() => setEditing(true)} title="Edit track">
          <IconEdit />
        </button>
      </div>
      <div className="track-row-menu">
        <button className="icon-button" onClick={() => setMenuOpen((v) => !v)} title="More options">
          <IconMore />
        </button>
        {menuOpen && (
          <div className="track-menu" onMouseLeave={() => setMenuOpen(false)}>
            {library.playlists.length === 0 && <div className="track-menu-empty">No playlists yet</div>}
            {library.playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  addToPlaylist(p.id, track.id)
                  setMenuOpen(false)
                }}
              >
                Add to {p.name}
              </button>
            ))}
            <button
              className="danger"
              onClick={() => {
                removeTrack(track.id)
                setMenuOpen(false)
              }}
            >
              <IconTrash className="inline-icon" /> Remove from library
            </button>
          </div>
        )}
      </div>

      {editing && <EditTrackModal track={track} onClose={() => setEditing(false)} />}
    </div>
  )
}
