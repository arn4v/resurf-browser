import * as React from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useDidMount } from 'rooks'
import { ControlEmittedEvents } from 'src/shared/ipc_events'
import { sendIpcMessage } from '../common/lib/ipc'
import { Sidebar } from './components/Sidebar'

export function App() {
  const [defaultSize, setDefaultSize] = React.useState<number | null>(null)

  useDidMount(async () => {
    const width: number = await ipcRenderer.invoke(ControlEmittedEvents.GetInitialSidebarWidth)
    setDefaultSize(width)
  })

  if (!defaultSize) return null

  return (
    <div className='h-full w-full bg-neutral-800'>
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
