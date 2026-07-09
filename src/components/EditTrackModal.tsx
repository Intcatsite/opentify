import { useState } from 'react'
import { useStore } from '../state/store'
import { platform } from '../platform'
import type { Track } from '../types'
import { IconImage, IconClose } from './icons'

interface EditTrackModalProps {
  track: Track
  onClose: () => void
}

export function EditTrackModal({ track, onClose }: EditTrackModalProps) {
  const updateTrackMetadata = useStore((s) => s.updateTrackMetadata)
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist)
  const [album, setAlbum] = useState(track.album)
  const [genre, setGenre] = useState(track.genre ?? '')
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(track.cover_data_url)
  const [saving, setSaving] = useState(false)

  async function handlePickCover() {
    const dataUrl = await platform.pickCoverImageDataUrl()
    if (!dataUrl) return
    setCoverDataUrl(dataUrl)
    setCoverPreview(dataUrl)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateTrackMetadata(track.id, {
        title: title.trim() || track.title,
        artist: artist.trim() || 'Unknown Artist',
        album: album.trim() || 'Unknown Album',
        genre: genre.trim() ? genre.trim() : null,
        cover_data_url: coverDataUrl,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit track</h2>
          <button className="icon-button" onClick={onClose}>
            <IconClose />
          </button>
        </div>

        <div className="modal-body edit-track-body">
          <button className="edit-cover-picker" onClick={handlePickCover} title="Change cover art">
            {coverPreview ? (
              <img src={coverPreview} alt="" />
            ) : (
              <div className="cover-placeholder large">
                <IconImage />
              </div>
            )}
            <span className="edit-cover-overlay">
              <IconImage /> Change cover
            </span>
          </button>

          <div className="edit-track-fields">
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Artist
              <input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
            <label>
              Album
              <input value={album} onChange={(e) => setAlbum(e.target.value)} />
            </label>
            <label>
              Genre
              <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Optional" />
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
