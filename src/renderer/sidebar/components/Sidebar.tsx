import { ChevronDownIcon, ChevronUpIcon, DotIcon, GlobeIcon, Trash2Icon } from 'lucide-react'
import * as React from 'react'
import { useDidMount } from 'rooks'
import scrollIntoView from 'scroll-into-view-if-needed'
import { ControlEmittedEvents, MainProcessEmittedEvents } from 'src/shared/ipc_events'
import { Tab, TabsMap } from 'src/shared/tabs'
import { useIpcListener } from '~/common/hooks/useIpcListener'
import { sendIpcMessage } from '~/common/lib/ipc'
import { cn } from '~/common/lib/utils'

const tabsContext = React.createContext<{
  tabs: TabsMap | null
  activeTab: Tab['id'] | null
  draggingTab: string | null
  setDraggingTab: (id: string | null) => void
  setActiveTab: (id: Tab['id']) => void
}>(null!)

function TabsProvider({ children }: { children: React.ReactElement }) {
  const [tabs, setTabs] = React.useState<TabsMap | null>(null)
  const [activeTab, setActiveTabInner] = React.useState<Tab['id'] | null>(null)
  const [draggingTab, setDraggingTab] = React.useState<string | null>(null)
  const activeTabRef = React.useRef(activeTab)
  const initiatedByContext = React.useRef(false) // Flag to track the source of the update

  activeTabRef.current = activeTab

  function scrollToTab(tabId: string) {
    const tabEl = document.querySelector(`li[data-tab-id="${tabId}"]`)
    if (tabEl) {
      scrollIntoView(tabEl, {
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      })
    }
  }

  function setActiveTab(id: Tab['id']) {
    initiatedByContext.current = true // Set the flag to indicate the update is from the context
    activeTabRef.current = id
    setActiveTabInner(id)
    ipcRenderer.invoke(ControlEmittedEvents.UpdateActiveTab, id)
  }

  useDidMount(async () => {
    const { tabs, activeTab } = await ipcRenderer.invoke<{
      tabs: TabsMap
      activeTab: Tab['id'] | null
    }>(ControlEmittedEvents.GetInitialState)
    setTabs(tabs)
    setActiveTabInner(activeTab)
    if (activeTab) scrollToTab(activeTab)
  })
  useIpcListener(MainProcessEmittedEvents.UpdateTabs, (_, tabs: TabsMap) => {
    setTabs(tabs)
  })
  useIpcListener(MainProcessEmittedEvents.UpdateActiveTab, (_, newActiveTab: Tab['id']) => {
    if (activeTabRef.current === newActiveTab) return
    setActiveTabInner(newActiveTab)
    if (!initiatedByContext.current) scrollToTab(newActiveTab)
    initiatedByContext.current = false // Reset the flag
  })

  return (
    <tabsContext.Provider
      value={{
        activeTab,
        setActiveTab,
        tabs,
        draggingTab,
        setDraggingTab,
      }}
    >
      {children}
    </tabsContext.Provider>
  )
}

export function Sidebar() {
  return (
    <TabsProvider>
      <div className='h-full w-full shadow-inner bg-neutral-800 text-white pb-8 border-r border-neutral-700'>
        <div
          className='h-8 w-full'
          style={{
            // eslint-disable-next-line
            // @ts-ignore
            WebkitAppRegion: 'drag',
          }}
        />
        <Tabs />
      </div>
    </TabsProvider>
  )
}

function isWithinYAxisRegion(mouseY: number, rect: DOMRect, regionFactor: [number, number]) {
  const regionStart = rect.top + rect.height * regionFactor[0]
  const regionEnd = rect.top + rect.height * regionFactor[1]
  return mouseY >= regionStart && mouseY <= regionEnd
}

function Tabs() {
  const { tabs: tabsMap } = React.useContext(tabsContext)

  const { tabs, topLevelTabs } = React.useMemo(() => {
    const tabs = Object.values(tabsMap || {})
    return { tabs, topLevelTabs: tabs.filter((tab) => !tab.parent) }
  }, [tabsMap])

  return (
    <ul className='flex flex-col gap-1 overflow-x-clip pb-4 px-3 scrollbar-thin overflow-y-auto h-full scrollbar-track-zinc-700 scrollbar-thumb-zinc-500'>
      {topLevelTabs.map((parent) => {
        return <TabItem key={parent.id} tab={parent} tabs={tabs} />
      })}
    </ul>
  )
}

function TabItem({ tab, tabs, depth = 0 }: { tabs: Tab[]; tab: Tab; depth?: number }) {
  const { setActiveTab, activeTab, draggingTab, setDraggingTab } = React.useContext(tabsContext)
  const [dragging, setDragging] = React.useState(false)
  const [dropLocation, setDropLocation] = React.useState<'above' | 'below' | 'child' | null>(null)
  const [expanded, setExpanded] = React.useState(true)
  const children = React.useMemo(
    () =>
      tabs.filter((child) => {
        if (!child.parent) return false
        return child.parent === tab.id
      }),
    [tabs, tab.id],
  )

  React.useEffect(() => {
    if (!draggingTab) setDropLocation(null)
  }, [draggingTab])

  return (
    <li
      data-tab-id={tab.id}
      className={cn('max-w-full', children.length && dragging && 'bg-blue-500/50 rounded-lg')}
      key={tab.id}
      style={{
        marginLeft: depth ? depth * 16 : undefined,
      }}
    >
      <div
        className={cn(
          'flex items-center justify-start w-full rounded-lg group select-none h-8 relative',
          !dragging && [
            tab.id === activeTab
              ? 'bg-neutral-700 cursor-default'
              : 'transition hover:bg-neutral-700',
          ],
          dropLocation === 'child' ? 'bg-blue-500/50' : null,
        )}
        onClick={() => {
          setActiveTab(tab.id)
        }}
        draggable={draggingTab === null || draggingTab === tab.id}
        onDragLeave={() => {
          setDropLocation(null)
        }}
        onDragEnter={(e) => e.preventDefault()}
        onDragOver={(e) => {
          e.preventDefault()
          if (draggingTab && tab.id !== draggingTab) {
            const rect = e.currentTarget.getBoundingClientRect()
            if (isWithinYAxisRegion(e.pageY, rect, [0, 0.2])) {
              setDropLocation('above')
            } else if (isWithinYAxisRegion(e.pageY, rect, [0.2, 0.6])) {
              setDropLocation('child')
            } else {
              setDropLocation('below')
            }
          }
        }}
        onMouseOut={() => {
          if (dropLocation) setDropLocation(null)
        }}
        onDragStart={() => {
          setDragging(true)
          setDraggingTab(tab.id)
        }}
        onDrop={() => {
          const newParentId =
            dropLocation === 'above'
              ? tab.parent || null
              : dropLocation === 'below'
                ? tab.parent || null
                : dropLocation === 'child'
                  ? tab.id
                  : null
          void ipcRenderer.invoke(ControlEmittedEvents.ChangeTabParent, draggingTab, newParentId)
          setDraggingTab(null)
        }}
        onDragEnd={() => {
          setDragging(false)
        }}
      >
        {(dropLocation === 'above' || dropLocation === 'below') && (
          <div
            className={cn(
              'w-full h-px rounded-full bg-blue-500',
              'absolute',
              dropLocation === 'above' && 'top-0',
              dropLocation === 'below' && 'bottom-0',
            )}
          />
        )}
        <div
          className={cn(
            'h-8 w-8 grid place-items-center rounded-lg shrink-0',
            children.length && 'hover:bg-gray-600',
          )}
          onClick={(e) => {
            e.stopPropagation()
            if (children.length) setExpanded((prev) => !prev)
          }}
        >
          {children.length ? (
            expanded ? (
              <ChevronUpIcon className='h-3 w-3' />
            ) : (
              <ChevronDownIcon className='h-3 w-3' />
            )
          ) : (
            <DotIcon className='h-3 w-3' />
          )}
        </div>
        <div
          className='flex gap-2 py-1 items-center text-sm grow min-w-0 truncate'
          title={tab.title}
        >
          {tab.favicon ? (
            <img src={tab.favicon} alt={`${tab.title} Favicon`} className='w-3.5 h-3.5 shrink-0' />
          ) : (
            <GlobeIcon className='h-3.5 w-3.5 text-white shrink-0' />
          )}
          <p className='truncate max-w-full'> {tab.title} </p>
        </div>
        <div className='invisible ml-auto group-hover:visible flex items-center justify-center gap-2 pr-3'>
          <div
            className='rounded hover:bg-zinc-600 p-1 cursor-pointer grid place-items-center'
            onClick={(e) => {
              e.stopPropagation()
              sendIpcMessage(ControlEmittedEvents.CloseTab, tab.id)
            }}
          >
            <span className='sr-only'>Close tab</span>
            <Trash2Icon className='h-4 w-4' />
          </div>
        </div>
      </div>
      {expanded && !!children.length && (
        <ul draggable data-dept={depth + 1} className='w-full flex flex-col gap-1 box-border'>
          {children.map((parent) => {
            return <TabItem key={parent.id} tab={parent} tabs={tabs} depth={depth + 1} />
          })}
        </ul>
      )}
    </li>
  )
}
