import { ChevronDownIcon, ChevronUpIcon, DotIcon, GlobeIcon, Trash2Icon } from 'lucide-react'
import * as React from 'react'
import scrollIntoView from 'scroll-into-view-if-needed'
import { ControlEmittedEvents, MainProcessEmittedEvents } from 'src/shared/ipc_events'
import { Tab, TabsMap } from 'src/shared/tabs'
import { useIpcListener } from '~/common/hooks/useIpcListener'
import { sendIpcMessage } from '~/common/lib/ipc'
import { cn } from '~/common/lib/utils'

const tabsContext = React.createContext<{
  tabs: TabsMap | null
  activeTab: Tab['id'] | null
  setActiveTab: (id: Tab['id']) => void
}>(null!)

function TabsProvider({ children }: { children: React.ReactElement }) {
  const [tabs, setTabs] = React.useState<TabsMap | null>(null)
  const [activeTab, setActiveTabInner] = React.useState<Tab['id'] | null>(null)
  const activeTabRef = React.useRef(activeTab)
  activeTabRef.current = activeTab

  useIpcListener(MainProcessEmittedEvents.Tabs_UpdateTabs, (_, tabs: TabsMap) => {
    setTabs(tabs)
  })
  useIpcListener(MainProcessEmittedEvents.TabsUpdateActiveTab, (_, newActiveTab: Tab['id']) => {
    console.log(activeTabRef.current, newActiveTab)
    if (activeTabRef.current === newActiveTab) return
    setActiveTabInner(activeTab)
    if (activeTab) {
      const tabEl = document.querySelector(`li[data-tab-id="${newActiveTab}"]`)
      if (tabEl) {
        scrollIntoView(tabEl, {
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start',
        })
      }
    }
  })

  function setActiveTab(id: Tab['id']) {
    activeTabRef.current = id
    setActiveTabInner(id)
    ipcRenderer.invoke(ControlEmittedEvents.Tabs_UpdateActiveTab, id)
  }

  return (
    <tabsContext.Provider
      value={{
        activeTab,
        setActiveTab,
        tabs,
      }}
    >
      {children}
    </tabsContext.Provider>
  )
}

export function Sidebar() {
  return (
    <TabsProvider>
      <div className='h-full w-full shadow-inner bg-neutral-800 text-white overflow-y-auto overflow-x-hidden scrollbar-track-zinc-700 scrollbar-thumb-zinc-500 scrollbar-thin pb-8 border-r border-neutral-700'>
        <div
          className='h-8 w-full'
          style={{
            // eslint-disable-next-line
            // @ts-ignore
            '-webkit-app-region': 'drag',
          }}
        />
        <Tabs />
      </div>
    </TabsProvider>
  )
}

function Tabs() {
  const { tabs: tabsMap } = React.useContext(tabsContext)

  const { tabs, topLevelTabs } = React.useMemo(() => {
    const tabs = Object.values(tabsMap || {})
    return { tabs, topLevelTabs: tabs.filter((tab) => !tab.parent) }
  }, [tabsMap])

  return (
    <ul className='max-w-[calc(100%-8px)] flex flex-col gap-1 overflow-x-clip pl-3 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-800'>
      {topLevelTabs.map((parent) => {
        return <TabItem key={parent.id} tab={parent} tabs={tabs} />
      })}
    </ul>
  )
}

function TabItem({ tab, tabs, depth = 0 }: { tabs: Tab[]; tab: Tab; depth?: number }) {
  const { setActiveTab, activeTab } = React.useContext(tabsContext)
  console.log(activeTab)
  const [expanded, setExpanded] = React.useState(true)
  const children = React.useMemo(
    () =>
      tabs.filter((child) => {
        if (!child.parent) return false
        return child.parent === tab.id
      }),
    [tabs, tab.id],
  )

  return (
    <li
      data-depth={depth}
      data-tab-id={tab.id}
      className='max-w-full'
      key={tab.id}
      style={{
        width: depth ? `calc(100% - ${depth * 12}px)` : undefined,
      }}
    >
      <div
        className={cn(
          'flex items-center justify-start w-full rounded-lg group select-none h-8',
          tab.id === activeTab
            ? 'bg-neutral-700 cursor-default'
            : 'transition hover:bg-neutral-700',
        )}
        onClick={() => {
          setActiveTab(tab.id)
        }}
      >
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
              sendIpcMessage(ControlEmittedEvents.Tabs_CloseTab, tab.id)
            }}
          >
            <span className='sr-only'>Close tab</span>
            <Trash2Icon className='h-4 w-4' />
          </div>
        </div>
      </div>
      {expanded && (
        <ul className='ml-3 w-full flex flex-col gap-1 box-border'>
          {children.map((parent) => {
            return (
              <TabItem
                key={parent.id}
                activeTab={activeTab}
                tab={parent}
                tabs={tabs}
                depth={depth + 1}
              />
            )
          })}
        </ul>
      )}
    </li>
  )
}
