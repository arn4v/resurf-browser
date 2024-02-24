import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const versions: Record<string, unknown> = {}

// Process versions
for (const type of ['chrome', 'node', 'electron']) {
  versions[type] = process.versions[type]
}

function validateIPC(channel: string) {
  if (!channel) {
    throw new Error(`Unsupported event IPC channel '${channel}'`)
  }

  return true
}

export type RendererListener = (event: IpcRendererEvent, ...args: any[]) => void

export const globals = {
  /** Processes versions **/
  versions,

  /**
   * A minimal set of methods exposed from Electron's `ipcRenderer`
   * to support communication to main process.
   */
  ipcRenderer: {
    send(channel: string, ...args: any[]) {
      if (validateIPC(channel)) {
        ipcRenderer.send(channel, ...args)
      }
    },

    invokeSync(channel: string, ...args: any[]) {
      return ipcRenderer.sendSync(channel, ...args)
    },

    async invoke<T>(channel: string, ...args: any[]): Promise<T> {
      return (await ipcRenderer.invoke(channel, ...args)) as T
    },

    on(channel: string, listener: RendererListener) {
      if (validateIPC(channel)) {
        ipcRenderer.on(channel, listener)
      }
      return () => ipcRenderer.removeListener(channel, listener)
    },

    once(channel: string, listener: RendererListener) {
      if (validateIPC(channel)) {
        ipcRenderer.once(channel, listener)
      }
    },

    removeListener(channel: string, listener: RendererListener) {
      if (validateIPC(channel)) {
        ipcRenderer.removeListener(channel, listener)
      }
    },
  },
} as const

declare global {
  const electron: typeof globals
  const ipcRenderer: (typeof globals)['ipcRenderer']
}

/** Create a safe, bidirectional, synchronous bridge across isolated contexts
 *  When contextIsolation is enabled in your webPreferences, your preload scripts run in an "Isolated World".
 */
contextBridge.exposeInMainWorld('electron', globals)
contextBridge.exposeInMainWorld('ipcRenderer', globals.ipcRenderer)
