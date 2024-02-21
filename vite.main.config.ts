import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
  plugins: [
    tsconfigPaths(),
    {
      name: 'restart',
      closeBundle() {
        process.stdin.emit('data', 'rs')
      },
    },
  ],
})
