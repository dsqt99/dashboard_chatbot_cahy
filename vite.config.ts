import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Admin API của service Zalo OA (cahy_zalo) chạy local ở 8081.
    proxy: {
      '/admin': { target: process.env.ADMIN_API_URL || 'http://localhost:8081', changeOrigin: true },
      '/wiki-api/': {
        target: process.env.WIKI_API_UPSTREAM || 'http://127.0.0.1:5055',
        changeOrigin: true,
        bypass(req) {
          const path = req.url?.split('?')[0] || ''
          if (req.method === 'POST' && path === '/wiki-api/auth/login') return
          if (req.method === 'GET' && /^\/wiki-api\/(departments|employees|knowledge-types|sources(?:\/processing-summary|\/[0-9a-fA-F-]{36}(?:\/preview)?)?|wiki\/pages(?:\/[A-Za-z0-9._-]+)?)$/.test(path)) return
          return false
        },
        rewrite: (path) => path.replace(/^\/wiki-api\//, '/api/'),
      },
    },
  },
})
