import { SearchIcon } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { useDebouncedValue, useDidMount } from 'rooks'
import { useEventListener } from 'usehooks-ts'
import { useIpcListener } from '~/common/hooks/useIpcListener'
import { BingLogo } from '~/common/logos/Bing'
import { ExaAILogo } from '~/common/logos/ExaAI'
import { GoogleLogo } from '~/common/logos/Google'
import { PerplexityLogo } from '~/common/logos/Perplexity'
import { NewTabEvents } from '~/shared/ipc_events'
import { SearchEngine, engineToShortcode, engineToTitle } from '~/shared/search_engines'
import '../common/globals.css'
import { ResultWithPositions } from '@orama/plugin-match-highlight'
import { Tab } from '~/shared/tabs'
import { Highlight } from '@orama/highlight'
import { waitOneTick } from '~/common/lib/utils'

enum OmnibarMode {
  All = 'all',
  SearchEngine = 'search-engine',
  OpenTabs = 'open-tabs',
  History = 'history',
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

const MODES_TO_SHOW_INDICATOR_FOR = [OmnibarMode.History, OmnibarMode.OpenTabs]

const MODE_TO_HUMAN_READABLE: Record<OmnibarMode, string> = {
  [OmnibarMode.All]: '',
  [OmnibarMode.SearchEngine]: '',
  [OmnibarMode.OpenTabs]: 'Tabs',
  [OmnibarMode.History]: 'History',
}

interface HistoryResult {
  title: string
  content: string
}

interface SearchResults {
  tabs: Tab[]
}

const INITIAL_RESULTS: SearchResults = {
  tabs: [],
}

const highlighter = new Highlight({
  CSSClass: 'bg-yellow-400',
})

interface State {
  query: string
  mode: OmnibarMode
  searchModeEngine: SearchEngine | null
  results: SearchResults
  allTabs: Tab[]
}

export function App() {
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
      results: INITIAL_RESULTS,
      searchModeEngine: null,
    } satisfies State,
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const [debouncedQuery] = useDebouncedValue(state.query, 200)
  const [defaultSearchEngine, setDefaultSearchEngine] = useState<SearchEngine>(SearchEngine.Google)

  function handleClose() {
    ipcRenderer.invoke(NewTabEvents.Close)
  }

  useDidMount(async () => {
    const engine: SearchEngine = await ipcRenderer.invoke(NewTabEvents.GetDefaultSearchEngine)
    setDefaultSearchEngine(engine)

    const tabs: Tab[] = await ipcRenderer.invoke(NewTabEvents.GetAllTabs)
    dispatch({ allTabs: tabs })

    await waitOneTick()
    inputRef.current?.focus()
  })
  // useEffect(() => {
  //   if (state.mode === OmnibarMode.SearchEngine) return
  //   if (debouncedQuery === '') return
  //   ;(async () => {
  //     const results: SearchResults = await ipcRenderer.invoke(NewTabEvents.Search, debouncedQuery)
  //     dispatch({ results })
  //   })()
  // }, [debouncedQuery])

  useIpcListener(NewTabEvents.Reset, () => {})
  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  })

  const ModeIcon = state.searchModeEngine
    ? SEARCH_ENGINE_TO_ICON[state.searchModeEngine]
    : SearchIcon
  const tabs = state.query === '' ? state.allTabs : state.results.tabs

  return (
    <div className='h-full w-full relative grid place-items-center dark isolate'>
      <div className='h-full w-full absolute top-0 left-0 bg-black/50 z-10' onClick={handleClose} />
      <div className='border border-zinc-900 bg-neutral-900 flex flex-col items-start justify-start shadow-lg w-1/2 lg:w-1/3 max-w-[600px] max-h-[500px] rounded-lg text-sm z-20 text-white relative'>
        {MODES_TO_SHOW_INDICATOR_FOR.includes(state.mode) && (
          <div className='absolute left-0 top-0 -translate-y-full mb-4'>
            {MODE_TO_HUMAN_READABLE[state.mode]}
          </div>
        )}
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
              let mode: OmnibarMode = OmnibarMode.All
              let searchModeEngine: SearchEngine | null = null
              const matchesWithShortcode = Object.entries(engineToShortcode).find(
                ([_, shortcode]) => {
                  return query.startsWith(`!${shortcode}`)
                },
              )

              if (matchesWithShortcode) {
                const [engine, shortcode] = matchesWithShortcode
                query = query.slice(`!${shortcode}`.length)
                mode = OmnibarMode.SearchEngine
                searchModeEngine = engine as SearchEngine
              }

              dispatch({
                query,
                mode,
                searchModeEngine,
              })
            }}
          />
        </label>
        <div className='w-full grow max-h-full overflow-y-auto flex flex-col overflow-x-clip p-4'>
          <div className='text-xs font-medium uppercase text-zinc-200'>Open Tabs</div>
          {tabs.map((tab) => {
            // const title = highlighter.highlight(tab.title, query)
            // const content = highlighter.highlight(tab.content, query)

            return (
              <div key={tab.id} className='px-2 flex flex-col'>
                <div className='whitespace-nowrap truncate text-md font-medium'>{tab.title}</div>
                {/* <div className='text-sm whitespace-nowrap truncate text-zinc-300'>
                  {tab.content}
                </div> */}
                {/* <span
                  dangerouslySetInnerHTML={{ __html: title.HTML }}
                  className='font-medium text-md'
                />
                <span dangerouslySetInnerHTML={{ __html: content.HTML }} className='text-sm' /> */}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
