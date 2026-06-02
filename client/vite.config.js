import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGhPages = process.env.GH_PAGES === 'true'

export default defineConfig({
  base: isGhPages ? '/tcf-command-center/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: isGhPages ? '../client-dist-gh' : '../client-dist',
    emptyOutDir: true,
  },
})
