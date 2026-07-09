import { useStore } from '../state/store'
import { TrackList } from './TrackList'

export function LibraryView() {
  const tracks = useStore((s) => s.library.tracks)

  return (
    <div className="view">
      <header className="view-header">
        <h1>Your Library</h1>
        <p className="view-subtitle">
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
        </p>
      </header>
      <TrackList
        tracks={tracks}
        emptyMessage="No tracks yet — import files or a folder from the sidebar to get started."
      />
    </div>
  )
}
