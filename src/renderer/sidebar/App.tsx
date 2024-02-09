import React, { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './components/Sidebar'
import { NewTabDialog } from './components/NewTabDialog'
import { sendIpcMessage } from '../common/lib/ipc'
import { MainProcessEmittedEvents, ControlEmittedEvents } from '~/shared-types/ipc_events'
import { useIpcListener } from '../common/hooks/useIpcListener'

export function App() {
  const [defaultSize, setDefaultSize] = React.useState<number | null>(null)

  useEffect(() => {
    sendIpcMessage(ControlEmittedEvents.SidebarReady)
  }, [])
  useIpcListener(MainProcessEmittedEvents.SidebarSetInitialWidth, (_, width: number) => {
    setDefaultSize(width)
  })

  if (!defaultSize) return null

  return (
    <div className='h-full w-full'>
      <NewTabDialog />
      <PanelGroup
        direction='horizontal'
        onLayout={(layout) => {
          const [sidebarWidth] = layout
          sendIpcMessage(ControlEmittedEvents.SidebarUpdateWidth, sidebarWidth)
        }}
      >
        <Panel minSize={10} maxSize={20} defaultSize={defaultSize}>
          <Sidebar />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={80}>
          <div
            onMouseOver={() => {
              console.log('mouse over')
            }}
          />
        </Panel>
      </PanelGroup>
    </div>
  )
}
