import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/chat/',
  plugins: [react()],
  resolve: {
    alias: {
      'cronixui-react': path.resolve(__dirname, 'ui_engine/react/src'),
    },
  },
  build: {
    outDir: 'dist',
  },
})
