import { ControlEmittedEvents, FindInPageEvents } from 'src/shared/ipc_events'
import type { RendererListener } from '../../../preload/preload'

export function registerIpcListener(channel: string, listener: RendererListener) {
  electron.ipcRenderer.on(channel, listener)
  return () => {
    electron.ipcRenderer.removeListener(channel, listener)
  }
}

export function sendIpcMessage(channel: ControlEmittedEvents | FindInPageEvents, ...args: any[]) {
  electron.ipcRenderer.send(channel, ...args)
}

registerIpcListener('test', () => console.log('test'))
