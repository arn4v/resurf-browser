import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import type { ForgeConfig } from '@electron-forge/shared-types'
import path from 'path'
import fs from 'fs'

const config: ForgeConfig = {
  packagerConfig: {
    icon: './assets/icon',
    name: 'Resurf',
    executableName: 'Resurf',
    asar: true,
    extendInfo: './Info.plist',
  },
  rebuildConfig: {},
  makers: [new MakerZIP({}, ['darwin']), new MakerSquirrel({})],
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
          name: 'control_ui',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    packageAfterPrune: async (forgeConfig, buildPath) => {
      const packageDotJsonPath = path.resolve(buildPath, 'package.json')
      const packageDotJson = fs.readFileSync(packageDotJsonPath)
      const json = JSON.parse(packageDotJson.toString())
      Object.keys(json).forEach((key) => {
        switch (key) {
          case 'name': {
            break
          }
          case 'version': {
            break
          }
          case 'main': {
            break
          }
          case 'author': {
            break
          }
          case 'description': {
            break
          }
          default: {
            delete json[key]
            break
          }
        }
      })
      fs.writeFileSync(packageDotJsonPath, JSON.stringify(json, null, '\t'))
    },
    readPackageJson: async (_, packageJson) => {
      packageJson['dependencies'] = {}
      return packageJson
    },
  },
}

export default config
