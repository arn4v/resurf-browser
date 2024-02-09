import { ChevronDownIcon, ChevronUpIcon, DotIcon, GlobeIcon, Trash2Icon } from 'lucide-react'
import * as React from 'react'
import { useDidMount } from 'rooks'
import { useIpcListener } from '~/common/hooks/useIpcListener'
import { sendIpcMessage } from '~/common/lib/ipc'
import { cn } from '~/common/lib/utils'
import { ControlEmittedEvents, MainProcessEmittedEvents } from '~/shared-types/ipc_events'
import { Tab, TabsMap } from '~/shared-types/tabs'

export function Sidebar() {
  const [tabs, setTabs] = React.useState<TabsMap | null>(null)
  const [activeTab, setActiveTab] = React.useState<Tab['id'] | null>(null)

  useDidMount(() => {
    sendIpcMessage(ControlEmittedEvents.Tabs_Ready)
  })
  useIpcListener(MainProcessEmittedEvents.Tabs_UpdateTabs, (_, tabs: TabsMap) => {
    setTabs(tabs)
  })
  useIpcListener(MainProcessEmittedEvents.TabsUpdateActiveTab, (_, activeTab: Tab['id']) => {
    console.log({ activeTab })
    setActiveTab(activeTab)
  })

  return (
    <div className='h-full w-full shadow-inner bg-neutral-800 text-white'>
      <div
        className='h-8 w-full'
        style={{
          // @ts-ignore
          '-webkit-app-region': 'drag',
        }}
      />
      <Tabs tabs={tabs || {}} activeTab={activeTab} />
    </div>
  )
}

function Tabs({ tabs: tabsMap, activeTab }: { tabs: TabsMap; activeTab: Tab['id'] | null }) {
  const { tabs, topLevelTabs } = React.useMemo(() => {
    const tabs = Object.values(tabsMap)
    return { tabs, topLevelTabs: tabs.filter((tab) => !tab.parent) }
  }, [tabsMap])

  return (
    <ul className='pl-3 pr-1.5 w-full flex flex-col gap-1 '>
      {topLevelTabs.map((parent) => {
        return <TabItem tab={parent} tabs={tabs} activeTab={activeTab} />
      })}
    </ul>
  )
}

function TabItem({ tab, tabs, activeTab }: { tabs: Tab[]; tab: Tab; activeTab: Tab['id'] | null }) {
  const [expanded, setExpanded] = React.useState(true)
  const children = React.useMemo(
    () =>
      tabs.filter((child) => {
        if (!child.parent) return false
        return child.parent === tab.id
      }),
    [tabs],
  )

  return (
    <li className='w-full' key={tab.id}>
      <div
        className={cn(
          'flex items-center justify-between w-full rounded-lg group select-none gap-2',
          tab.id === activeTab
            ? 'bg-neutral-700 cursor-default'
            : 'transition hover:bg-neutral-700',
        )}
        onClick={() => {
          sendIpcMessage(ControlEmittedEvents.Tabs_UpdateActiveTab, tab.id)
        }}
      >
        <div className='items-center flex pl-2 gap-1 w-full flex-grow'>
          <div
            className={cn('h-full grid place-items-center', children.length && 'hover:bg-gray-300')}
            onClick={() => {
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
          <span
            className='inline-flex gap-2 py-1 items-center text-sm truncate flex-1 min-w-0 max-w-[30ch]'
            title={tab.title}
          >
            {tab.favicon ? (
              <img src={tab.favicon} alt={`${tab.title} Favicon`} className='w-4 h-4' />
            ) : (
              <GlobeIcon className='h-4 w-4' />
            )}
            <p className='truncate max-w-full'> {tab.title} </p>
          </span>
        </div>
        <div className='invisible group-hover:visible flex items-center justify-center gap-2 pr-3 shrink-0'>
          <div
            className='rounded hover:bg-gray-300 p-1 cursor-pointer grid place-items-center'
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
        <ul className='ml-3 w-full flex flex-col gap-1'>
          {children.map((parent) => {
            return <TabItem activeTab={activeTab} tab={parent} tabs={tabs} />
          })}
        </ul>
      )}
    </li>
  )
}
