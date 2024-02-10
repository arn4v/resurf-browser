import { useEffect } from 'react'
import type { RendererListener } from '~/preload/preload'
import { registerIpcListener } from '~/common/lib/ipc'
import { MainProcessEmittedEvents } from '~/shared/ipc_events'

export function useIpcListener(channel: MainProcessEmittedEvents, listener: RendererListener) {
  useEffect(() => {
    return registerIpcListener(channel, listener)
  }, [])
}
