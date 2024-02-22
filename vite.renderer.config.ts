import react from '@vitejs/plugin-react'
import type { ConfigEnv, UserConfig } from 'vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { pluginExposeRenderer } from './vite.base.config'
import path from 'path'

const CONTROL_VIEWS = ['new_tab', 'address_bar', 'find', 'sidebar', 'not_found', 'settings']

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>
  const { root, mode, forgeConfigSelf } = forgeEnv
  const name = forgeConfigSelf.name ?? ''
  const rendererPath = path.resolve(root, 'src/renderer')

  return {
    root: rendererPath,
    mode,
    base: './',
    build: {
      outDir: path.join(root, `.vite/renderer`),
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
