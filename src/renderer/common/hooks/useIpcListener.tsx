import { useEffect } from 'react'
import { registerIpcListener } from '~/common/lib/ipc'
import type { RendererListener } from '~/preload/preload'

export function useIpcListener(channel: string, listener: RendererListener) {
  useEffect(() => {
    return registerIpcListener(channel, listener)
  }, [channel, listener])
}
