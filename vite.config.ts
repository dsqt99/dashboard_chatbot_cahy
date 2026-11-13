import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Admin API của service Zalo OA (cahy_zalo) chạy local ở 8081.
    proxy: { '/admin': { target: process.env.ADMIN_API_URL || 'http://localhost:8081', changeOrigin: true } },
  },
})
