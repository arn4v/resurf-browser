import { ControlEmittedEvents, FindInPageEvents } from 'src/shared/ipc_events'
import type { RendererListener } from '../../../preload/preload'

export function registerIpcListener(channel: string, callback: RendererListener): () => void {
  return electron.ipcRenderer.on(channel, callback)
}

export function sendIpcMessage(channel: ControlEmittedEvents | FindInPageEvents, ...args: any[]) {
  electron.ipcRenderer.send(channel, ...args)
}

registerIpcListener('test', () => console.log('test'))
