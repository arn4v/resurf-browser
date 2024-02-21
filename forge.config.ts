import { MakerZIP } from '@electron-forge/maker-zip'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { VitePlugin } from '@electron-forge/plugin-vite'

import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  packagerConfig: {
    // asar: true,
    icon: './assets/icon',
    name: 'Resurf',
    executableName: process.platform === 'linux' ? 'resurf-browser' : 'resurfBrowser',
    // asar: true,
    ignore: [
      '/src',
      '/assets',
      '/.eslintrc.cjs',
      '/postcss.config.js',
      '/tailwind.config.js',
      '/.gitignore',
      '/vite.preload.config.ts',
      '/tsconfig.json',
      '/components.json',
      '/bun.lockb',
      '/forge.config.ts',
      // '/package.json',
      '/vite.main.config.ts',
      '/vite.renderer.config.ts',
      '/adblock.bin',
      '/vite.renderer.config.ts',
    ],
    // asar:{}
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
    // new MakerDMG({
    //   icon: './assets/icon.icns',
    //   format: 'ULFO',
    // }),
    // new MakerSquirrel({}),
  ],
  plugins: [
    // new AutoUnpackNativesPlugin({}),
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
      ],
    }),
  ],
  // hooks: {
  //   readPackageJson: async (_, packageJson) => {
  //     packageJson['dependencies'] = {}
  //     return packageJson
  //   },
  // },
}

export default config
