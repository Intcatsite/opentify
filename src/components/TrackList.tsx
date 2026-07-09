import { useStore } from '../state/store'
import type { Track } from '../types'
import { IconClock } from './icons'
import { TrackRow } from './TrackRow'

interface TrackListProps {
  tracks: Track[]
  emptyMessage: string
}

export function TrackList({ tracks, emptyMessage }: TrackListProps) {
  const playQueue = useStore((s) => s.playQueue)
  const currentTrack = useStore((s) => s.currentTrack())
  const isPlaying = useStore((s) => s.progress.is_playing)

  if (tracks.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="track-list">
      <div className="track-row track-row-header">
        <div className="track-row-index">#</div>
        <div className="track-row-cover" />
        <div className="track-row-info">Title</div>
        <div className="track-row-album">Album</div>
        <div className="track-row-genre">Genre</div>
        <div className="track-row-duration">
          <IconClock />
        </div>
        <div className="track-row-edit" />
        <div className="track-row-menu" />
      </div>
      {tracks.map((track, index) => (
        <TrackRow
          key={track.id}
          track={track}
          index={index}
          isActive={currentTrack?.id === track.id}
          isPlaying={isPlaying}
          onPlay={() =>
            playQueue(
              tracks.map((t) => t.id),
              index
            )
          }
        />
      ))}
    </div>
  )
}
