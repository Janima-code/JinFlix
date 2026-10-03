import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The browser only ever calls same-origin /api paths; the FastAPI service
    // runs separately during development. See ../backend/README.md.
    proxy: {
      '/api': {
        // 127.0.0.1 rather than localhost: on Windows `localhost` can resolve to
        // IPv6 ::1 first, which uvicorn (which binds IPv4 by default) never
        // listens on, so the proxy fails with ECONNREFUSED.
        target: process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})