import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGhPages = process.env.GH_PAGES === 'true'

export default defineConfig({
  base: isGhPages ? '/tcf-command-center/' : '/',
  plugins: [react()],
  build: {
    outDir: isGhPages ? '../client-dist-gh' : '../client-dist',
    emptyOutDir: true,
  },
})
