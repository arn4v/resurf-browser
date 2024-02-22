export {} // Make this a module

declare global {
  namespace NodeJS {
    interface Process {
      // Used for hot reload after preload scripts.
      viteDevServers: Record<string, import('vite').ViteDevServer>
    }
  }

  type VitePluginConfig = ConstructorParameters<
    typeof import('@electron-forge/plugin-vite').VitePlugin
  >[0]

  interface VitePluginRuntimeKeys {
    VITE_DEV_SERVER_URL: `${string}_VITE_DEV_SERVER_URL`
    VITE_NAME: `${string}_VITE_NAME`
  }
}

declare module 'vite' {
  interface ConfigEnv<K extends keyof VitePluginConfig = keyof VitePluginConfig> {
    root: string
    forgeConfig: VitePluginConfig
    forgeConfigSelf: VitePluginConfig[K][number]
  }
}
