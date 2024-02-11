import { createRoot } from 'react-dom/client'
import '../common/globals.css'
import { SettingsDialogEvents } from '~/shared/ipc_events'
import { XIcon } from 'lucide-react'
import { Switch } from '~/common/ui/switch'
import { useDidMount } from 'rooks'
import * as React from 'react'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

function App() {
  const [adblockEnabled, setAdblockEnabled] = React.useState(false)

  useDidMount(async () => {
    const adblockEnabled = await ipcRenderer.invoke(SettingsDialogEvents.GetAdblockValue)
    setAdblockEnabled(adblockEnabled)
  })

  function handleClose() {
    ipcRenderer.invoke(SettingsDialogEvents.Close)
  }

  return (
    <div className='h-full w-full relative grid place-items-center dark'>
      <div className='h-full w-full absolute top-0 left-0 bg-black/10 z-10' onClick={handleClose} />
      <div className='bg-zinc-800 flex flex-col items-start justify-start shadow-lg w-1/4 h-[25%] rounded-lg text-sm z-20 text-white p-4'>
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
      </div>
    </div>
  )
}

root.render(<App />)
