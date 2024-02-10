import { defineConfig } from 'vite'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

const base = path.resolve(__dirname, 'src/renderer')
console.log(path.resolve(base, 'find/index.html'))

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'sidebar/index.html'),
        find: path.resolve(base, 'find/index.html'),
      },
    },
  },
})
