import type { ConfigEnv, UserConfig } from 'vite'
import { defineConfig, mergeConfig } from 'vite'
// import tailwindcss_vite from '@tailwindcss/vite' // Removed static import
import { getBuildConfig, external, pluginHotRestart } from './vite.base.config'

// https://vitejs.dev/config
export default defineConfig(async (env) => { // Made async
  const forgeEnv = env as ConfigEnv<'build'>
  const { forgeConfigSelf } = forgeEnv

  const tailwindcss_vite_module = await import('@tailwindcss/vite');
  const tailwindcss_vite = tailwindcss_vite_module.default || tailwindcss_vite_module;

  const config: UserConfig = {
    build: {
      rollupOptions: {
        external,
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: forgeConfigSelf.entry!,
        output: {
          format: 'cjs',
          // It should not be split chunks.
          inlineDynamicImports: true,
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
    plugins: [tailwindcss_vite(), pluginHotRestart('reload')],
  }

  return mergeConfig(getBuildConfig(forgeEnv), config)
})
