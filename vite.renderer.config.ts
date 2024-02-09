import { defineConfig } from 'vite'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

const base = path.resolve(__dirname, 'src/renderer')

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  build: {
    rollupOptions: {
      input: {
        sidebar: path.resolve(base, 'sidebar/index.html'),
        find: path.resolve(base, 'find/index.html'),
      },
    },
  },
})
