import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// https://v2.tauri.app/start/frontend/vite/
// GitHub Pages serves this as a project site under /opentify/, so asset
// URLs need that base path; the Tauri desktop build keeps serving from
// its own root ('/') either way.
const base = process.env.GITHUB_PAGES ? '/opentify/' : '/'

export default defineConfig(async () => ({
  base,
  plugins: [react()],

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}))
