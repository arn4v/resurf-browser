import type { ConfigEnv, UserConfig } from 'vite'
import { defineConfig, mergeConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
// import tailwindcss_vite from '@tailwindcss/vite' // Removed static import
import { getBuildConfig, getBuildDefine, external, pluginHotRestart } from './vite.base.config'

// https://vitejs.dev/config
export default defineConfig(async (env) => { // Made async
  const forgeEnv = env as ConfigEnv<'build'>
  const { forgeConfigSelf } = forgeEnv
  const define = getBuildDefine(forgeEnv)

  const tailwindcss_vite_module = await import('@tailwindcss/vite');
  const tailwindcss_vite = tailwindcss_vite_module.default || tailwindcss_vite_module;

  const config: UserConfig = {
    build: {
      lib: {
        entry: forgeConfigSelf.entry!,
        fileName: () => '[name].js',
        formats: ['cjs'],
      },
      rollupOptions: {
        external,
      },
    },
    plugins: [tsconfigPaths(), tailwindcss_vite(), pluginHotRestart('restart')],
    define,
    resolve: {
      // Load the Node.js entry.
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },
  }

  return mergeConfig(getBuildConfig(forgeEnv), config)
})
