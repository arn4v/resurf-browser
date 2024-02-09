import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { MakerDMG } from '@electron-forge/maker-dmg'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
    name: 'Resurf Browser',
    executableName: process.platform === 'linux' ? 'resurf-browser' : 'resurfBrowser',
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      icon: './assets/icon.icns',
      format: 'ULFO',
    }),
    new MakerSquirrel({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
        {
          name: 'tabs',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
}

export default config
