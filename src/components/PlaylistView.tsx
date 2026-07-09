import { useState } from 'react'
import { useStore } from '../state/store'
import { TrackList } from './TrackList'

export function PlaylistView({ playlistId }: { playlistId: string }) {
  const playlist = useStore((s) => s.library.playlists.find((p) => p.id === playlistId))
  const tracks = useStore((s) =>
    s.library.tracks.filter((t) => playlist?.track_ids.includes(t.id))
  )
  const deletePlaylist = useStore((s) => s.deletePlaylist)
  const [confirming, setConfirming] = useState(false)

  if (!playlist) return null

  return (
    <div className="view">
      <header className="view-header">
        <h1>{playlist.name}</h1>
        <p className="view-subtitle">
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
        </p>
        {confirming ? (
          <div className="confirm-row">
            <span>Delete this playlist?</span>
            <button className="danger" onClick={() => deletePlaylist(playlist.id)}>
              Delete
            </button>
            <button onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        ) : (
          <button className="ghost-button" onClick={() => setConfirming(true)}>
            Delete playlist
          </button>
        )}
      </header>
      <TrackList
        tracks={tracks}
        emptyMessage="This playlist is empty — add tracks from your library via the ⋯ menu."
      />
    </div>
  )
}
