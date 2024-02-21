import { createRoot } from 'react-dom/client'
import '../common/globals.css'
import { SettingsDialogEvents } from '~/shared/ipc_events'
import { Settings, XIcon } from 'lucide-react'
import { Switch } from '~/common/ui/switch'
import { useDidMount } from 'rooks'
import * as React from 'react'
import { Select } from '~/common/ui/select'
import { SearchEngine, engineToTitle } from '~/shared/search_engines'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

function App() {
  const [adblockEnabled, setAdblockEnabled] = React.useState(false)
  const [searchEngine, setSearchEngine] = React.useState<SearchEngine | undefined>(undefined)

  useDidMount(async () => {
    await Promise.all([
      (async () => {
        const adblockEnabled = await ipcRenderer.invoke(SettingsDialogEvents.GetAdblockValue)
        setAdblockEnabled(adblockEnabled)
      })(),
      (async () => {
        const searchEngine = await ipcRenderer.invoke(SettingsDialogEvents.GetDefaultSearchEngine)
        setSearchEngine(searchEngine)
      })(),
    ])
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
            checked={adblockEnabled}
            onCheckedChange={() => {
              setAdblockEnabled((prev) => {
                const newVal = !prev
                ipcRenderer.invoke(SettingsDialogEvents.SetAdblockValue, newVal)
                return newVal
              })
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
              setSearchEngine(v)
              ipcRenderer.invoke(SettingsDialogEvents.SetDefaultSearchEngine, v)
            }}
            value={searchEngine}
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
      </div>
    </div>
  )
}

root.render(<App />)
