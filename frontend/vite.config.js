import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_ORIGIN = 'http://127.0.0.1:9000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
      },
      '/socket.io': {
        target: API_ORIGIN,
        changeOrigin: true,
        ws: true,
      },
    },
    headers: {
      // Allow camera/mic/display capture in local development.
      'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self)',
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
      },
      '/socket.io': {
        target: API_ORIGIN,
        changeOrigin: true,
        ws: true,
      },
    },
    headers: {
      'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self)',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssMinify: true,
    chunkSizeWarningLimit: 900,
  },
})
