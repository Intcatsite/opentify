import { useStore } from '../state/store'
import {
  IconNext,
  IconNote,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconRepeatOne,
  IconShuffle,
  IconVolume,
} from './icons'

function formatTime(secs: number): string {
  const total = Math.max(0, Math.floor(secs))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const currentTrack = useStore((s) => s.currentTrack())
  const progress = useStore((s) => s.progress)
  const volume = useStore((s) => s.volume)
  const shuffle = useStore((s) => s.shuffle)
  const repeat = useStore((s) => s.repeat)
  const togglePlayPause = useStore((s) => s.togglePlayPause)
  const next = useStore((s) => s.next)
  const prev = useStore((s) => s.prev)
  const seek = useStore((s) => s.seek)
  const setVolume = useStore((s) => s.setVolume)
  const toggleShuffle = useStore((s) => s.toggleShuffle)
  const cycleRepeat = useStore((s) => s.cycleRepeat)
  const setNowPlayingOpen = useStore((s) => s.setNowPlayingOpen)

  const duration = currentTrack?.duration_secs ?? 0
  const progressPct = duration > 0 ? (progress.position_secs / duration) * 100 : 0

  return (
    <footer className="player-bar">
      <div className="player-bar-track">
        {currentTrack ? (
          <button
            className="player-bar-track-button"
            onClick={() => setNowPlayingOpen(true)}
            title="Open now playing"
          >
            <div className="track-row-cover">
              {currentTrack.cover_data_url ? (
                <img src={currentTrack.cover_data_url} alt="" />
              ) : (
                <div className="cover-placeholder">
                  <IconNote />
                </div>
              )}
            </div>
            <div className="track-row-info">
              <div className="track-row-title">{currentTrack.title}</div>
              <div className="track-row-artist">{currentTrack.artist}</div>
            </div>
          </button>
        ) : (
          <div className="player-bar-empty">Nothing playing</div>
        )}
      </div>

      <div className="player-bar-controls">
        <div className="player-bar-buttons">
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
          <button className="play-button" onClick={togglePlayPause} title="Play/Pause">
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
        <div className="player-bar-seek">
          <span className="time-label">{formatTime(progress.position_secs)}</span>
          <input
            className="seek-slider"
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(progress.position_secs, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!currentTrack}
            style={{
              background: `linear-gradient(to right, var(--accent) ${progressPct}%, var(--surface-3) ${progressPct}%)`,
            }}
          />
          <span className="time-label">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-bar-volume">
        <IconVolume />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </div>
    </footer>
  )
}
