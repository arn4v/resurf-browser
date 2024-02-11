import { ArrowDownIcon, ArrowUpIcon, SearchIcon, XIcon } from 'lucide-react'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { useDebouncedValue } from 'rooks'
import { useEventListener } from 'usehooks-ts'
import { useIpcListener } from '~/common/hooks/useIpcListener'
import { FindInPageEvents, MainProcessEmittedEvents } from '~/shared/ipc_events'
import './globals.css'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

function App() {
  const [query, setQuery] = React.useState('')
  const [debouncedQuery] = useDebouncedValue(query, 50)

  const close = async () => {
    ipcRenderer.invoke(FindInPageEvents.Hide)
  }

  React.useEffect(() => {
    ipcRenderer.invoke(FindInPageEvents.UpdateQuery, debouncedQuery, true, true)
  }, [debouncedQuery])
  useIpcListener(MainProcessEmittedEvents.FindInPage_StartHiding, () => {
    close()
  })
  useEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      await close()
    }
  })

  function move(forward: boolean) {
    ipcRenderer.invoke(FindInPageEvents.UpdateQuery, query, true, forward)
  }

  return (
    <div className='h-full w-full rounded-lg bg-zinc-900 px-3 py-2 flex items-center justify-between overflow-hidden'>
      <label className='flex items-center gap-2 text-white h-full grow'>
        <SearchIcon className='h-4 w-4' />
        <input
          autoFocus
          title='Find in page'
          className='outline-none h-full bg-transparent text-sm w-full'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              move(true)
            }
          }}
        />
      </label>
      <div className='text-white flex items-center justify-center gap-2'>
        <button className='hover:bg-zinc-700 p-1 rounded-md transition' onClick={() => move(false)}>
          <ArrowUpIcon className='h-4 w-4' />
          <span className='sr-only'>Previous result</span>
        </button>
        <button className='hover:bg-zinc-700 p-1 rounded-md transition' onClick={() => move(true)}>
          <ArrowDownIcon className='h-4 w-4' />
          <span className='sr-only'>Next result</span>
        </button>
        <button className='hover:bg-zinc-700 p-1 rounded-md transition' onClick={close}>
          <XIcon className='h-4 w-4' />
          <span className='sr-only'>Close find in page</span>
        </button>
      </div>
    </div>
  )
}

root.render(<App />)
