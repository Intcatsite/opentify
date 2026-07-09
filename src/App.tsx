import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useStore } from './state/store'
import { Sidebar } from './components/Sidebar'
import { LibraryView } from './components/LibraryView'
import { PlaylistView } from './components/PlaylistView'
import { SettingsView } from './components/SettingsView'
import { PlayerBar } from './components/PlayerBar'
import type { PlaybackProgress } from './types'
import './App.css'

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'])

function App() {
  const init = useStore((s) => s.init)
  const view = useStore((s) => s.view)
  const onProgress = useStore((s) => s.onProgress)
  const onTrackEnded = useStore((s) => s.onTrackEnded)
  const importFiles = useStore((s) => s.importFiles)
  const loading = useStore((s) => s.loading)
  const error = useStore((s) => s.error)

  useEffect(() => {
    init()

    const unlistenProgress = listen<PlaybackProgress>('player://progress', (event) => {
      onProgress(event.payload)
    })
    const unlistenEnded = listen('player://ended', () => {
      onTrackEnded()
    })

    const webview = getCurrentWebviewWindow()
    const unlistenDrop = webview.onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const audioPaths = event.payload.paths.filter((p) => {
          const ext = p.split('.').pop()?.toLowerCase()
          return ext ? AUDIO_EXTENSIONS.has(ext) : false
        })
        if (audioPaths.length > 0) importFiles(audioPaths)
      }
    })

    return () => {
      unlistenProgress.then((f) => f())
      unlistenEnded.then((f) => f())
      unlistenDrop.then((f) => f())
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
      <PlayerBar />
    </div>
  )
}

export default App
