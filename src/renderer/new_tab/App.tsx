import { Command } from 'cmdk'
import { GlobeIcon, Link2Icon, LinkIcon, SearchIcon, XCircleIcon } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Highlighter from 'react-highlight-words'
import { usePreviousImmediate } from 'rooks'
import scrollIntoViewIfNeeded from 'scroll-into-view-if-needed'
import * as tldts from 'tldts'
import { useEventListener } from 'usehooks-ts'
import { z } from 'zod'
import { useIpcListener } from '~/common/hooks/useIpcListener'
import useFuse from '~/common/hooks/use_fuse'
import { cn, waitOneTick } from '~/common/lib/utils'
import { BingLogo } from '~/common/logos/Bing'
import { ExaAILogo } from '~/common/logos/ExaAI'
import { GoogleLogo } from '~/common/logos/Google'
import { PerplexityLogo } from '~/common/logos/Perplexity'
import { ControlEmittedEvents, NewTabEvents } from '~/shared/ipc_events'
import { SearchEngine, engineToShortcode, engineToTitle } from '~/shared/search_engines'
import { Tab } from '~/shared/tabs'

enum OmnibarMode {
  All = 'all',
  SearchEngine = 'search-engine',
  // OpenTabs = 'open-tabs',
  // History = 'history',
}

const SEARCH_ENGINE_TO_ICON: Record<
  SearchEngine,
  (props: React.ComponentPropsWithoutRef<'svg'>) => React.ReactElement
> = {
  [SearchEngine.Bing]: BingLogo,
  [SearchEngine.Exa]: ExaAILogo,
  [SearchEngine.Google]: GoogleLogo,
  [SearchEngine.Perplexity]: PerplexityLogo,
}

// const MODES_TO_SHOW_INDICATOR_FOR = [OmnibarMode.History, OmnibarMode.OpenTabs]

const MODE_TO_HUMAN_READABLE: Record<OmnibarMode, string> = {
  [OmnibarMode.All]: '',
  [OmnibarMode.SearchEngine]: '',
  // [OmnibarMode.OpenTabs]: 'Tabs',
  // [OmnibarMode.History]: 'History',
}

interface State {
  query: string
  mode: OmnibarMode
  searchModeEngine: SearchEngine | null
  allTabs: Tab[]
  activeTab: string | null
}

const urlSchema = z.string().url()
function isUrl(url: string) {
  if (urlSchema.safeParse(url).success) return true
  const parsed = tldts.parse(url)
  if (parsed.domain && parsed.isIcann) return true
  return false
}

export function App() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(0)
  const [state, dispatch] = useReducer(
    (state: State, update: Partial<State>) => {
      return {
        ...state,
        ...update,
      }
    },
    {
      allTabs: [],
      mode: OmnibarMode.All,
      query: '',
      searchModeEngine: null,
      activeTab: null,
    } satisfies State,
  )
  // const queryWords = state.query.split(' ')
  const inputRef = useRef<HTMLInputElement>(null)
  // const [debouncedQuery] = useDebouncedValue(state.query, 100)
  const { result: tabs } = useFuse({
    data: state.allTabs,
    query: state.query,
    options: {
      threshold: 0.2,
      keys: ['title'],
    },
  })
  // const tabs = useMemo(() => {
  //   return fuse.search(debouncedQuery)
  // }, [debouncedQuery])
  const [defaultSearchEngine, setDefaultSearchEngine] = useState<SearchEngine>(SearchEngine.Google)
  const DefaultSearchEngineIcon = useMemo(
    () => SEARCH_ENGINE_TO_ICON[defaultSearchEngine],
    [defaultSearchEngine],
  )

  function handleClose() {
    ipcRenderer.invoke(NewTabEvents.Close)
    scrollContainerRef.current?.scrollTo({ top: 0 })
    setSelected(0)
    dispatch({
      query: '',
      mode: OmnibarMode.All,
      searchModeEngine: null,
    })
  }

  useIpcListener('nt__signal_close', () => {
    handleClose()
  })
  useIpcListener(
    NewTabEvents.SignalOpen,
    async (_, { activeTab, tabs }: { tabs: Tab[]; activeTab: string | null }) => {
      dispatch({
        activeTab,
        allTabs: tabs,
      })
      const engine: SearchEngine = await ipcRenderer.invoke(NewTabEvents.GetDefaultSearchEngine)
      setDefaultSearchEngine(engine)
      await waitOneTick()
      inputRef.current?.focus()
    },
  )
  // useEffect(() => {
  //   if (state.mode === OmnibarMode.SearchEngine) return
  //   if (debouncedQuery === '') return
  //   ;(async () => {
  //     const results: SearchResults = await ipcRenderer.invoke(NewTabEvents.Search, debouncedQuery)
  //     dispatch({ results })
  //   })()
  // }, [debouncedQuery])

  const activeTabTitle = state.allTabs.find((t) => t.id === state.activeTab)?.title || null
  const isQueryAUrl = useMemo(() => isUrl(state.query), [state.query])
  const { flattened, results } = useMemo(() => {
    const results = (
      [
        {
          heading: 'Tab Actions',
          type: 'commands',
          enabled: !isQueryAUrl || state.mode !== OmnibarMode.SearchEngine,
          items: [
            {
              id: 'copy_url',
              title: `Copy URL`,
              icon: <Link2Icon className='h-5 w-5' />,
              command() {
                void ipcRenderer.invoke(NewTabEvents.CopyTabUrl, state.activeTab)
              },
            },
            {
              id: 'close_tab',
              icon: <XCircleIcon className='h-5 w-5' />,
              title: `Close ${activeTabTitle ? `"${activeTabTitle}"` : 'Tab'}`,
              command() {
                void ipcRenderer.invoke(NewTabEvents.CloseTab, state.activeTab)
              },
            },
          ],
        },
        {
          heading: 'Open Tabs',
          type: 'open_tabs',
          enabled: !isQueryAUrl && state.mode !== OmnibarMode.SearchEngine,
          items: state.query.length ? tabs : state.allTabs,
        },
        {
          type: 'history',
          heading: 'History',
          enabled: !isQueryAUrl || state.mode !== OmnibarMode.SearchEngine,
          items: [],
        },
        {
          heading: 'Commands',
          type: 'commands',
          enabled: true,
          items:
            state.mode === OmnibarMode.SearchEngine && state.searchModeEngine
              ? [
                  {
                    id: 'search_engine',
                    title: `Search for "${state.query}" on ${engineToTitle[state.searchModeEngine]}`,
                    icon: (() => {
                      const Icon = SEARCH_ENGINE_TO_ICON[state.searchModeEngine]
                      return <Icon className='h-5 w-5' />
                    })(),
                    command() {
                      ipcRenderer.invoke(NewTabEvents.Go, state.query, true, state.searchModeEngine)
                    },
                  },
                ]
              : isQueryAUrl
                ? [
                    {
                      id: 'open_url',
                      command() {
                        ipcRenderer.invoke(
                          NewTabEvents.Go,
                          state.query,
                          true,
                          state.searchModeEngine,
                        )
                      },
                      icon: <LinkIcon className='h-5 w-5' />,
                      title: 'Open URL in New Tab',
                    },
                  ]
                : [
                    ...(state.query.length > 0
                      ? [
                          {
                            id: 'search_on',
                            title: `Search for "${state.query}" on ${engineToTitle[defaultSearchEngine]}`,
                            command() {
                              ipcRenderer.invoke(
                                NewTabEvents.Go,
                                state.query,
                                true,
                                defaultSearchEngine,
                              )
                            },
                            icon: <DefaultSearchEngineIcon className='h-5 w-5' />,
                          },
                        ]
                      : []),
                  ],
        },
      ] satisfies OmnibarResults[]
    ).filter((section) => section.items.length > 0 && section.enabled)
    const flattened: (Tab | Command)[] = results.map((x) => x.items).flat()
    return { results, flattened }
  }, [
    DefaultSearchEngineIcon,
    activeTabTitle,
    defaultSearchEngine,
    isQueryAUrl,
    state.activeTab,
    state.allTabs,
    state.mode,
    state.query,
    state.searchModeEngine,
    tabs,
  ])
  const prevFlattened = usePreviousImmediate(flattened)

  function handleSelectItem(index: number) {
    const selectedItem = flattened[index]
    if ('command' in selectedItem) {
      selectedItem?.command()
      handleClose()
    } else {
      ipcRenderer.invoke(ControlEmittedEvents.UpdateActiveTab, selectedItem.id)
      handleClose()
    }
  }

  const selectItem = useCallback((index: number) => {
    setSelected(index)
    const el = document.querySelector(
      `div[data-tab-search-result="true"][data-search-index="${index}"]`,
    )
    if (el) {
      scrollIntoViewIfNeeded(el, {
        scrollMode: 'if-needed',
        block: 'nearest',
        inline: 'start',
      })
    }
  }, [])

  useEffect(() => {
    if (!prevFlattened || !prevFlattened.every((a) => !!flattened.find((b) => a.id === b.id))) {
      selectItem(0)
    }
  }, [flattened, prevFlattened, selectItem])

  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  })
  useEventListener(
    'keydown',
    (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const newIndex = selected == 0 ? flattened.length - 1 : selected - 1
        selectItem(newIndex)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const newIndex = selected === flattened.length - 1 ? 0 : selected + 1
        selectItem(newIndex)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSelectItem(selected)
      }
    },
    undefined,
    { capture: true },
  )

  const ModeIcon = state.searchModeEngine
    ? SEARCH_ENGINE_TO_ICON[state.searchModeEngine]
    : SearchIcon

  return (
    <div className='h-full w-full relative isolate'>
      <div className='h-full w-full absolute top-0 left-0 bg-black/50 z-10' onClick={handleClose} />
      <div className='border fixed top-[20%] left-1/2 -translate-x-1/2 border-zinc-900 bg-neutral-900 flex flex-col items-start justify-start shadow-lg min-w-[500px] w-1/2 lg:w-1/3 max-w-[600px] h-[500px] rounded-lg text-sm z-20 text-white relative'>
        {/* {MODES_TO_SHOW_INDICATOR_FOR.includes(state.mode) && (
          <div className='absolute left-0 top-0 -translate-y-full mb-4'>
            {MODE_TO_HUMAN_READABLE[state.mode]}
          </div>
        )} */}
        <label className='group h-10 w-full px-4 border-b border-zinc-700 flex items-center justify-center sticky'>
          <ModeIcon className='h-5 w-5' />
          <input
            ref={inputRef}
            autoFocus
            className='bg-transparent h-10 outline-none grow px-2'
            value={state.query}
            placeholder={
              state.mode === OmnibarMode.SearchEngine && state.searchModeEngine
                ? `Search on ${engineToTitle[state.searchModeEngine]}...`
                : `Search everything...`
            }
            onKeyDown={(e) => {
              if (
                e.key === 'Backspace' &&
                state.query === '' &&
                state.mode === OmnibarMode.SearchEngine
              ) {
                dispatch({
                  mode: OmnibarMode.All,
                  searchModeEngine: null,
                })
              }
            }}
            onInput={(e) => {
              let query = e.currentTarget.value

              if (state.mode !== OmnibarMode.SearchEngine) {
                const matchesWithShortcode = Object.entries(engineToShortcode).find(
                  ([_, shortcode]) => {
                    return query.startsWith(`!${shortcode}`)
                  },
                )

                if (matchesWithShortcode) {
                  const [engine, shortcode] = matchesWithShortcode
                  query = query.slice(`!${shortcode}`.length)
                  const mode = OmnibarMode.SearchEngine
                  const searchModeEngine = engine as SearchEngine
                  dispatch({ query, mode, searchModeEngine })
                  return
                }
              }

              dispatch({ query })
            }}
          />
        </label>
        <div
          className='flex flex-col grow w-full py-3 overflow-y-auto outline-none'
          tabIndex={-1}
          ref={scrollContainerRef}
        >
          {results.map((section, index) => {
            return (
              <Fragment key={section.type}>
                <div className={cn('ml-3 text-xs font-semibold mb-2', index !== 0 && 'mt-2')}>
                  {section.heading}
                </div>
                {section.items.map((item) => {
                  const flattenedIndex = flattened.findIndex((flatItem) => flatItem.id === item.id)
                  return (
                    <OmnibarItem
                      key={item.id}
                      onClick={() => {
                        handleSelectItem(flattenedIndex)
                        handleClose()
                      }}
                      onMouseOver={() => {
                        selectItem(flattenedIndex)
                      }}
                      index={flattenedIndex}
                      type={section.type}
                      query={state.query}
                      item={item}
                      isSelected={selected === flattenedIndex}
                    />
                  )
                })}
              </Fragment>
            )
          })}
        </div>
        <div className='border-t border-neutral-600 py-2 px-4 w-full'>
          <div className='flex items-center gap-2'>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>Navigate</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function OmnibarItem({
  type,
  item,
  isSelected,
  onMouseOver,
  onClick,
  index,
  query,
}: {
  index: number
  isSelected: boolean
  query: string
  onMouseOver(): void
  onClick(): void
} & (
  | {
      type: 'open_tabs'
      item: Tab
    }
  | {
      type: 'history'
      item: Tab
    }
  | {
      type: 'commands'
      item: Command
    }
)) {
  if (type === 'commands') {
    return (
      <div
        data-tab-search-result='true'
        data-search-index={index}
        onClick={onClick}
        onMouseOver={onMouseOver}
        className={cn(
          'flex items-start px-3 py-2 border border-neutral-800 gap-2 select-none cursor-pointer',
          isSelected && 'bg-neutral-700',
        )}
      >
        {item.icon}
        <div className='font-medium'>{item.title}</div>
      </div>
    )
  } else {
    return (
      <div
        data-tab-search-result='true'
        data-search-index={index}
        onClick={onClick}
        onMouseOver={onMouseOver}
        className={cn(
          'flex items-start p-3 border-b border-neutral-500/20 gap-2 select-none cursor-pointer',
          isSelected && 'bg-neutral-700',
        )}
      >
        {item.favicon ? (
          <img className='h-5 w-5' src={item.favicon} />
        ) : (
          <GlobeIcon className='text-white h-5 w-5' />
        )}
        <Highlighter
          highlightClassName='bg-yellow-400 text-black'
          className='font-medium'
          searchWords={query.split(' ')}
          textToHighlight={item.title}
        />
      </div>
    )
  }
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className='rounded-md border border-neutral-600 h-6 w-6 text-center select-none bg-neutral-800'>
      {children}
    </kbd>
  )
}

type OmnibarResults =
  | {
      type: 'open_tabs'
      heading: string
      enabled: boolean
      items: Tab[]
    }
  | {
      type: 'history'
      heading: string
      enabled: boolean
      items: Tab[]
    }
  | {
      type: 'commands'
      heading: string
      enabled: boolean
      items: Array<Command>
    }

interface Command {
  id: string
  title: string
  icon?: React.ReactElement
  command(): void | Promise<void>
}
