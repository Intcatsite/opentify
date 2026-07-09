import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// https://v2.tauri.app/start/frontend/vite/
export default defineConfig(async () => ({
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
