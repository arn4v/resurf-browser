import { defineConfig } from 'vite'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

// const base = path.resolve(__dirname, 'src/renderer')

const CONTROL_VIEWS = ['new_tab', 'address_bar', 'find', 'sidebar', 'not_found', 'settings']

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    rollupOptions: {
      input: CONTROL_VIEWS.reduce(
        (acc, cur) => {
          acc[cur] = path.resolve(__dirname, `src/renderer/${cur}/index.html`)
          return acc
        },
        {} as Record<string, string>,
      ),
    },
  },
})
