import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_ORIGIN = 'http://127.0.0.1:9000'

const resolveBackendOrigin = () => (
  String(
    process.env.VITE_BACKEND_URL ||
    process.env.BACKEND_ORIGIN ||
    process.env.VITE_API_URL ||
    ''
  ).replace(/\/$/, '')
)

const narBackendPlugin = () => ({
  name: 'nar-backend-origin',
  config() {
    const origin = resolveBackendOrigin()
    if (!origin) return undefined
    return {
      define: {
        'import.meta.env.VITE_BACKEND_URL': JSON.stringify(origin),
      },
    }
  },
  transformIndexHtml(html) {
    const origin = resolveBackendOrigin()
    return html.replace(
      '</head>',
      `<script>window.__NAR_CONFIG__={backendUrl:${JSON.stringify(origin)}};</script>\n</head>`
    )
  },
})

export default defineConfig({
  plugins: [react(), narBackendPlugin()],
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
