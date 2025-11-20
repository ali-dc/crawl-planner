import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.geojson'],
  server: {
    proxy: {
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/pubs': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/plan': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/directions': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/precompute': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/parse': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
