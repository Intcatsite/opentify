import { useState } from 'react'
import { useStore } from '../state/store'
import { platform } from '../platform'
import type { AiProviderConfig } from '../types'
import { IconCheck } from './icons'

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const setAiProvider = useStore((s) => s.setAiProvider)

  const [mode, setMode] = useState(settings.ai_provider.mode)
  const [endpoint, setEndpoint] = useState(
    settings.ai_provider.mode === 'cloud' ? settings.ai_provider.endpoint : 'https://api.openai.com/v1'
  )
  const [apiKey, setApiKey] = useState(
    settings.ai_provider.mode === 'cloud' ? settings.ai_provider.api_key : ''
  )
  const [model, setModel] = useState(
    settings.ai_provider.mode === 'cloud' ? settings.ai_provider.model : 'gpt-4o-mini'
  )
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    let config: AiProviderConfig
    if (mode === 'cloud') {
      config = { mode: 'cloud', endpoint, api_key: apiKey, model }
    } else {
      config = { mode }
    }
    await setAiProvider(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Settings</h1>
        <p className="view-subtitle">Configure genre detection &amp; AI features</p>
      </header>

      {platform.name === 'web' && (
        <p className="settings-hint" style={{ marginBottom: 20 }}>
          Running in your browser: your library lives in this browser's local storage only —
          nothing is uploaded anywhere, but clearing site data (or switching browsers/devices)
          means starting over. For a persistent, full-featured setup, use the desktop app.
        </p>
      )}

      <div className="settings-panel">
        <h2>AI genre detection</h2>
        <p className="settings-hint">
          Choose how Opentify guesses a track's genre. Nothing is ever sent anywhere unless you
          pick "Cloud".
        </p>

        <label className="settings-radio">
          <input type="radio" checked={mode === 'none'} onChange={() => setMode('none')} />
          <div>
            <strong>Off</strong>
            <div className="settings-hint">No AI features.</div>
          </div>
        </label>

        {platform.supportsLocalAi && (
          <label className="settings-radio">
            <input type="radio" checked={mode === 'local'} onChange={() => setMode('local')} />
            <div>
              <strong>Local model</strong>
              <div className="settings-hint">
                Runs fully offline on this machine using an embedded audio-feature classifier.
                Audio never leaves your computer.
              </div>
            </div>
          </label>
        )}

        <label className="settings-radio">
          <input type="radio" checked={mode === 'cloud'} onChange={() => setMode('cloud')} />
          <div>
            <strong>Cloud provider</strong>
            <div className="settings-hint">
              Bring your own OpenAI-compatible endpoint (OpenAI, OpenRouter, a local Ollama
              server, etc). Only the track title/artist are sent — never the audio file.
            </div>
          </div>
        </label>

        {mode === 'cloud' && (
          <div className="settings-cloud-fields">
            <label>
              Endpoint
              <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
            </label>
            <label>
              API key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
              />
            </label>
            <label>
              Model
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
          </div>
        )}

        <button className="primary-button" onClick={handleSave}>
          {saved ? (
            <>
              <IconCheck className="inline-icon" /> Saved
            </>
          ) : (
            'Save settings'
          )}
        </button>
      </div>
    </div>
  )
}
