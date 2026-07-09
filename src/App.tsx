import { useEffect } from 'react'
import { useStore } from './state/store'
import { platform } from './platform'
import { Sidebar } from './components/Sidebar'
import { LibraryView } from './components/LibraryView'
import { PlaylistView } from './components/PlaylistView'
import { SettingsView } from './components/SettingsView'
import { PlayerBar } from './components/PlayerBar'
import { NowPlayingView } from './components/NowPlayingView'
import { AnalyzingBanner } from './components/AnalyzingBanner'
import './App.css'

function App() {
  const init = useStore((s) => s.init)
  const view = useStore((s) => s.view)
  const onProgress = useStore((s) => s.onProgress)
  const onTrackEnded = useStore((s) => s.onTrackEnded)
  const handleDroppedLibrary = useStore((s) => s.handleDroppedLibrary)
  const loading = useStore((s) => s.loading)
  const error = useStore((s) => s.error)
  const nowPlayingOpen = useStore((s) => s.nowPlayingOpen)

  useEffect(() => {
    init()

    const unlistenProgress = platform.onProgress(onProgress)
    const unlistenEnded = platform.onTrackEnded(onTrackEnded)
    const unlistenDrop = platform.onFilesDropped((library) => {
      handleDroppedLibrary(library)
    })

    return () => {
      unlistenProgress()
      unlistenEnded()
      unlistenDrop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="app-shell">
      <div className="app-body">
        <Sidebar />
        <main className="app-main">
          {loading ? (
            <div className="empty-state">Loading your library…</div>
          ) : error ? (
            <div className="empty-state error">{error}</div>
          ) : view.kind === 'library' ? (
            <LibraryView />
          ) : view.kind === 'playlist' ? (
            <PlaylistView playlistId={view.id} />
          ) : (
            <SettingsView />
          )}
        </main>
      </div>
      <AnalyzingBanner />
      <PlayerBar />
      {nowPlayingOpen && <NowPlayingView />}
    </div>
  )
}

export default App
