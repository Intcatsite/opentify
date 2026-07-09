import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { TrackList } from './TrackList'

export function PlaylistView({ playlistId }: { playlistId: string }) {
  const playlist = useStore((s) => s.library.playlists.find((p) => p.id === playlistId))
  const allTracks = useStore((s) => s.library.tracks)
  const deletePlaylist = useStore((s) => s.deletePlaylist)
  const [confirming, setConfirming] = useState(false)

  // Computed with useMemo (not inside the zustand selector above) so it
  // only produces a new array when its real inputs change - a selector
  // that returns a fresh array on every read fights React's
  // useSyncExternalStore snapshot check and can hang/crash the render.
  const trackIds = playlist?.track_ids
  const tracks = useMemo(
    () => (trackIds ? allTracks.filter((t) => trackIds.includes(t.id)) : []),
    [allTracks, trackIds]
  )

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
