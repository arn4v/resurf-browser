import { XIcon } from 'lucide-react'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { useDidMount } from 'rooks'
import { Select } from '~/common/ui/select'
import { Switch } from '~/common/ui/switch'
import { SettingsDialogEvents } from '~/shared/ipc_events'
import { SearchEngine, engineToTitle } from '~/shared/search_engines'
import '../common/globals.css'
import { TabCloseBehavior } from '~/shared/tabs'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

interface SettingsState {
  adblockEnabled: boolean
  searchEngine: SearchEngine | undefined
  tabCloseBehavior: TabCloseBehavior | undefined
}

function App() {
  const [state, dispatch] = React.useReducer(
    (current: SettingsState, partial: Partial<SettingsState>) => {
      return {
        ...current,
        ...partial,
      }
    },
    {
      adblockEnabled: false,
      searchEngine: undefined,
      tabCloseBehavior: undefined,
    } satisfies SettingsState,
  )

  useDidMount(async () => {
    const adblockEnabled = await ipcRenderer.invoke<boolean>(SettingsDialogEvents.GetAdblockValue)
    const searchEngine = await ipcRenderer.invoke<SearchEngine>(
      SettingsDialogEvents.GetDefaultSearchEngine,
    )
    const tabCloseBehavior = await ipcRenderer.invoke<TabCloseBehavior>(
      SettingsDialogEvents.GetTabCloseBehavior,
    )
    dispatch({
      adblockEnabled,
      searchEngine,
      tabCloseBehavior,
    })
  })

  function handleClose() {
    ipcRenderer.invoke(SettingsDialogEvents.Close)
  }

  return (
    <div className='h-full w-full relative dark'>
      <div className='h-full w-full absolute top-0 left-0 bg-black/50 z-10' onClick={handleClose} />
      <div className='border fixed top-[20%] left-1/2 -translate-x-1/2 border-zinc-900 bg-neutral-900 flex flex-col items-start justify-start shadow-lg w-1/2 lg:w-1/3 max-w-[600px] max-h-[500px] rounded-lg text-sm z-20 text-white p-4'>
        <div className='flex items-center justify-between w-full'>
          <h1 className='font-semibold text-xl'>Settings</h1>
          <button onClick={handleClose}>
            <XIcon />
            <span className='sr-only'>Close Settings Popup</span>
          </button>
        </div>
        <div className='h-px w-full bg-zinc-600 my-4' />
        <div className='flex items-start justify-between w-full py-2'>
          <div className='flex flex-col gap-2'>
            <span className='text-md font-medium'>Block Ads</span>
            <span className='text-zinc-400 text-sm'>Block ads and trackers on websites</span>
          </div>
          <Switch
            checked={state.adblockEnabled}
            onCheckedChange={(checked) => {
              ipcRenderer.invoke(SettingsDialogEvents.SetAdblockValue, checked)
              dispatch({ adblockEnabled: checked })
            }}
          />
        </div>
        <div className='flex items-start justify-between w-full py-2'>
          <div className='flex flex-col gap-2'>
            <span className='text-md font-medium'>Search Engine</span>
            <span className='text-zinc-400 text-sm'>Change your default search engine</span>
          </div>
          <Select.Root
            onValueChange={(v: SearchEngine) => {
              dispatch({ searchEngine: v })
              ipcRenderer.invoke(SettingsDialogEvents.SetDefaultSearchEngine, v)
            }}
            value={state.searchEngine}
            defaultValue={SearchEngine.Google}
          >
            <Select.Trigger className='w-[180px]'>
              <Select.Value placeholder='Search Engine' className='dark:bg-zinc-900' />
            </Select.Trigger>
            <Select.Content>
              {Object.values(SearchEngine).map((v) => {
                return (
                  <Select.Item key={v} value={v}>
                    {engineToTitle[v]}
                  </Select.Item>
                )
              })}
            </Select.Content>
          </Select.Root>
        </div>
        <div className='flex flex-col w-full py-2 gap-4'>
          <span className='text-md font-medium'>Tab Close Behavior</span>
          <Select.Root
            onValueChange={(value: TabCloseBehavior) => {
              dispatch({ tabCloseBehavior: value })
              ipcRenderer.invoke(SettingsDialogEvents.SetTabCloseBehavior, value)
            }}
            value={state.tabCloseBehavior}
            defaultValue={SearchEngine.Google}
          >
            <Select.Trigger className='w-full'>
              <Select.Value placeholder='Tab Close Behavior' className='dark:bg-zinc-900' />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={TabCloseBehavior.Cascade}>Close entire tree/subtree</Select.Item>
              <Select.Item value={TabCloseBehavior.Elevate}>Elevate to parent level</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      </div>
    </div>
  )
}

root.render(<App />)
