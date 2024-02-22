import react from '@vitejs/plugin-react'
import type { ConfigEnv, UserConfig } from 'vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { pluginExposeRenderer } from './vite.base.config'
import path from 'path'

const CONTROL_VIEWS = ['new_tab', 'address_bar', 'find', 'not_found', 'settings']
const rendererPath = path.resolve(__dirname, 'src/renderer')

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>
  const { mode, forgeConfigSelf } = forgeEnv
  const name = forgeConfigSelf.name ?? ''

  return {
    root: rendererPath,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,
      rollupOptions: {
        input: {
          main: path.join(rendererPath, './sidebar/index.html'),
          ...CONTROL_VIEWS.reduce(
            (acc, cur) => {
              acc[cur] = path.join(rendererPath, `./${cur}/index.html`)
              return acc
            },
            {} as Record<string, string>,
          ),
        },
      },
    },
    plugins: [react(), tsconfigPaths(), pluginExposeRenderer(name)],
    resolve: {
      preserveSymlinks: true,
    },
    clearScreen: false,
  } as UserConfig
})
