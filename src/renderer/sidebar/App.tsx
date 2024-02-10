import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ControlEmittedEvents, MainProcessEmittedEvents } from 'src/shared/ipc_events'
import { useIpcListener } from '../common/hooks/useIpcListener'
import { sendIpcMessage } from '../common/lib/ipc'
import { NewTabDialog } from './components/NewTabDialog'
import { Sidebar } from './components/Sidebar'
import * as React from 'react'

export function App() {
  const [defaultSize, setDefaultSize] = React.useState<number | null>(null)

  React.useEffect(() => {
    sendIpcMessage(ControlEmittedEvents.SidebarReady)
  }, [])
  useIpcListener(MainProcessEmittedEvents.SidebarSetInitialWidth, (_, width: number) => {
    console.log(width)
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
        <Panel minSize={80} maxSize={90}></Panel>
      </PanelGroup>
    </div>
  )
}
