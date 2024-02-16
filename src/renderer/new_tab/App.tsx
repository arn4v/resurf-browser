import { SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
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

export function App() {
  const [defaultSearchEngine, setDefaultSearchEngine] = useState<SearchEngine>(SearchEngine.Google)

  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebouncedValue(query, 200)

  const [mode, setMode] = useState<OmnibarMode>(OmnibarMode.All)
  const [searchModeEngine, setSearchModeEngine] = useState<SearchEngine | null>(null)
  const [results, setResults] = useState<SearchResults>(INITIAL_RESULTS)
  const [allTabs, setAllTabs] = useState<Tab[]>([])

  function handleClose() {
    ipcRenderer.invoke(NewTabEvents.Close)
  }

  useDidMount(async () => {
    const engine: SearchEngine = await ipcRenderer.invoke(NewTabEvents.GetDefaultSearchEngine)
    setDefaultSearchEngine(engine)

    const tabs: Tab[] = await ipcRenderer.invoke(NewTabEvents.GetAllTabs)
    setAllTabs(tabs)
  })
  useEffect(() => {
    if (mode === OmnibarMode.SearchEngine) return
    if (query === '') return
    ;(async () => {
      const results: SearchResults = await ipcRenderer.invoke(NewTabEvents.Search, debouncedQuery)
      setResults(results)
    })()
  }, [debouncedQuery])

  useIpcListener(NewTabEvents.Reset, () => {})
  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  })

  const ModeIcon = searchModeEngine ? SEARCH_ENGINE_TO_ICON[searchModeEngine] : SearchIcon
  const tabs = query === '' ? allTabs : results.tabs

  return (
    <div className='h-full w-full relative grid place-items-center dark isolate'>
      <div className='h-full w-full absolute top-0 left-0 bg-black/10 z-10' onClick={handleClose} />
      <div className='border bg-zinc-900 flex flex-col items-start justify-start shadow-lg w-1/2 lg:w-1/3 max-w-[600px] h-[500px] rounded-lg text-sm z-20 text-white relative'>
        {MODES_TO_SHOW_INDICATOR_FOR.includes(mode) && (
          <div className='absolute left-0 top-0 -translate-y-full mb-4'>
            {MODE_TO_HUMAN_READABLE[mode]}
          </div>
        )}
        <label className='group h-10 w-full px-4 border-b border-zinc-700 flex items-center justify-center'>
          <ModeIcon className='h-5 w-5' />
          <input
            className='bg-transparent h-10 outline-none grow px-2'
            value={query}
            placeholder={
              mode === OmnibarMode.SearchEngine && searchModeEngine
                ? `Search on ${engineToTitle[searchModeEngine]}...`
                : `Search everything...`
            }
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && query === '' && mode === OmnibarMode.SearchEngine) {
                setMode(OmnibarMode.All)
                setSearchModeEngine(null)
              }
            }}
            onInput={(e) => {
              let query = e.currentTarget.value
              let mode: OmnibarMode = OmnibarMode.All
              let searchEngine: SearchEngine | null = null
              const matchesWithShortcode = Object.entries(engineToShortcode).find(
                ([_, shortcode]) => {
                  return query.startsWith(`!${shortcode}`)
                },
              )

              if (matchesWithShortcode) {
                const [engine, shortcode] = matchesWithShortcode
                query = query.slice(`!${shortcode}`.length)
                mode = OmnibarMode.SearchEngine
                searchEngine = engine as SearchEngine
              }

              setQuery(query)
              setMode(mode)
              setSearchModeEngine(searchEngine)
            }}
          />
        </label>
        <div className='w-full grow max-h-full overflow-y-auto flex flex-col overflow-x-clip'>
          <div className='px-4 py-2 text-sm text-zinc-200'>Open Tabs</div>
          {tabs.map((tab) => {
            // const title = highlighter.highlight(tab.title, query)
            // const content = highlighter.highlight(tab.content, query)

            return (
              <div key={tab.id} className='px-4 flex flex-col'>
                <div className='whitespace-nowrap truncate text-md font-medium'>{tab.title}</div>
                <div className='text-sm whitespace-nowrap truncate text-zinc-300'>
                  {tab.content}
                </div>
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
