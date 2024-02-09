import { useEffect } from 'react'
import { RendererListener } from 'src/preload/preload'
import { registerIpcListener } from '~/common/lib/ipc'
import { MainProcessEmittedEvents } from '~/shared-types/ipc_events'

export function useIpcListener(channel: MainProcessEmittedEvents, listener: RendererListener) {
  useEffect(() => {
    return registerIpcListener(channel, listener)
  }, [])
}
