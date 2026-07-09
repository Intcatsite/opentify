import { useRef, useState } from 'react'
import { useStore } from '../state/store'
import { platform } from '../platform'
import logo from '../assets/logo.png'
import { IconNote, IconPlus, IconSettings } from './icons'

export function Sidebar() {
  const library = useStore((s) => s.library)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const importFiles = useStore((s) => s.importFiles)
  const importFolder = useStore((s) => s.importFolder)
  const createPlaylist = useStore((s) => s.createPlaylist)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  // Guards against double-creating a playlist: pressing Enter fires the
  // form's onSubmit *and* triggers a blur on the input, and both handlers
  // would otherwise call submitNewPlaylist with the same stale name.
  const submittedRef = useRef(false)

  function openNewPlaylistForm() {
    submittedRef.current = false
    setCreating(true)
  }

  async function submitNewPlaylist() {
    if (submittedRef.current) return
    submittedRef.current = true
    const name = newName.trim()
    if (name) await createPlaylist(name)
    setNewName('')
    setCreating(false)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={logo} alt="" className="brand-mark" />
        <span className="brand-name">Opentify</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${view.kind === 'library' ? 'active' : ''}`}
          onClick={() => setView({ kind: 'library' })}
        >
          <IconNote className="nav-icon" /> Your Library
        </button>
      </nav>

      <div className="sidebar-actions">
        <button className="sidebar-action" onClick={() => importFiles()}>
          <IconPlus className="inline-icon" /> Import files
        </button>
        {platform.supportsFolderImport && (
          <button className="sidebar-action" onClick={() => importFolder()}>
            <IconPlus className="inline-icon" /> Import folder
          </button>
        )}
      </div>

      <div className="sidebar-playlists">
        <div className="sidebar-section-header">
          <span>Playlists</span>
          <button className="icon-button" onClick={openNewPlaylistForm} title="New playlist">
            <IconPlus />
          </button>
        </div>

        {creating && (
          <form
            className="new-playlist-form"
            onSubmit={(e) => {
              e.preventDefault()
              submitNewPlaylist()
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={submitNewPlaylist}
              placeholder="Playlist name"
            />
          </form>
        )}

        <ul className="playlist-list">
          {library.playlists.map((playlist) => (
            <li key={playlist.id}>
              <button
                className={`nav-item ${
                  view.kind === 'playlist' && view.id === playlist.id ? 'active' : ''
                }`}
                onClick={() => setView({ kind: 'playlist', id: playlist.id })}
              >
                {playlist.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        className={`nav-item settings-item ${view.kind === 'settings' ? 'active' : ''}`}
        onClick={() => setView({ kind: 'settings' })}
      >
        <IconSettings className="nav-icon" /> Settings
      </button>
    </aside>
  )
}
