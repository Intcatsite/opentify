import { useStore } from '../state/store'
import { coverGradient } from '../genreColors'
import {
  IconChevronDown,
  IconNext,
  IconNote,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
} from './icons'

function formatTime(secs: number): string {
  const total = Math.max(0, Math.floor(secs))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function NowPlayingView() {
  const currentTrack = useStore((s) => s.currentTrack())
  const queue = useStore((s) => s.queue)
  const currentIndex = useStore((s) => s.currentIndex)
  const library = useStore((s) => s.library)
  const progress = useStore((s) => s.progress)
  const shuffle = useStore((s) => s.shuffle)
  const repeat = useStore((s) => s.repeat)
  const togglePlayPause = useStore((s) => s.togglePlayPause)
  const next = useStore((s) => s.next)
  const prev = useStore((s) => s.prev)
  const seek = useStore((s) => s.seek)
  const toggleShuffle = useStore((s) => s.toggleShuffle)
  const cycleRepeat = useStore((s) => s.cycleRepeat)
  const setNowPlayingOpen = useStore((s) => s.setNowPlayingOpen)
  const playQueue = useStore((s) => s.playQueue)

  if (!currentTrack) return null

  const duration = currentTrack.duration_secs
  const progressPct = duration > 0 ? (progress.position_secs / duration) * 100 : 0
  const upcoming = queue
    .slice(currentIndex + 1)
    .map((id) => library.tracks.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  return (
    <div className="now-playing">
      <div className="now-playing-header">
        <button className="icon-button" onClick={() => setNowPlayingOpen(false)} title="Close">
          <IconChevronDown />
        </button>
        <span className="now-playing-header-title">Now Playing</span>
        <span />
      </div>

      <div className="now-playing-body">
        <div className="now-playing-main">
          <div className="now-playing-cover">
            {currentTrack.cover_data_url ? (
              <img src={currentTrack.cover_data_url} alt="" />
            ) : (
              <div
                className="cover-placeholder large"
                style={{ background: coverGradient(`${currentTrack.title}-${currentTrack.artist}`) }}
              >
                <IconNote />
              </div>
            )}
          </div>

          <div className="now-playing-title">{currentTrack.title}</div>
          <div className="now-playing-artist">{currentTrack.artist}</div>

          <div className="now-playing-seek">
            <input
              className="seek-slider"
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={Math.min(progress.position_secs, duration || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, var(--accent) ${progressPct}%, var(--surface-3) ${progressPct}%)`,
              }}
            />
            <div className="now-playing-times">
              <span>{formatTime(progress.position_secs)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-bar-buttons now-playing-buttons">
            <button
              className={`icon-button ${shuffle ? 'active' : ''}`}
              onClick={toggleShuffle}
              title="Shuffle"
            >
              <IconShuffle />
            </button>
            <button className="icon-button" onClick={prev} title="Previous">
              <IconPrev />
            </button>
            <button className="play-button large" onClick={togglePlayPause} title="Play/Pause">
              {progress.is_playing ? <IconPause /> : <IconPlay />}
            </button>
            <button className="icon-button" onClick={next} title="Next">
              <IconNext />
            </button>
            <button
              className={`icon-button ${repeat !== 'off' ? 'active' : ''}`}
              onClick={cycleRepeat}
              title={`Repeat: ${repeat}`}
            >
              {repeat === 'one' ? <IconRepeatOne /> : <IconRepeat />}
            </button>
          </div>
        </div>

        <div className="now-playing-queue">
          <h3>Next up</h3>
          {upcoming.length === 0 ? (
            <p className="settings-hint">Nothing queued after this track.</p>
          ) : (
            <ul className="queue-list">
              {upcoming.map((track, i) => (
                <li key={`${track.id}-${i}`}>
                  <button
                    className="queue-row"
                    onClick={() => playQueue(queue, currentIndex + 1 + i)}
                  >
                    <div className="track-row-cover">
                      {track.cover_data_url ? (
                        <img src={track.cover_data_url} alt="" />
                      ) : (
                        <div
                          className="cover-placeholder"
                          style={{ background: coverGradient(`${track.title}-${track.artist}`) }}
                        >
                          <IconNote />
                        </div>
                      )}
                    </div>
                    <div className="track-row-info">
                      <div className="track-row-title">{track.title}</div>
                      <div className="track-row-artist">{track.artist}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
