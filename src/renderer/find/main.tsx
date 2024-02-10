import { ArrowDownIcon, ArrowUpIcon, SearchIcon, XIcon } from 'lucide-react'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useEventListener } from 'usehooks-ts'
import { FindInPageEvents } from '~/shared/ipc_events'
import './globals.css'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

function App() {
  const [state, setState] = React.useState({
    query: '',
    cursor: 0,
    total: 0,
  })

  // useIpcListener(
  //   MainProcessEmittedEvents.FindInPage_SetInitial,
  //   (_, state: TabState['findInPage']) => {
  //     setState({ cursor: state.results_cursor, query: state.query, total: state.results_total })
  //   },
  // )
  // useIpcListener(MainProcessEmittedEvents.FindInPage_Update, (_, state: TabState['findInPage']) => {
  //   setState({ cursor: state.results_cursor, query: state.query, total: state.results_total })
  // })

  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ipcRenderer.invoke(FindInPageEvents.Hide)
    }
  })

  return (
    <div className='h-full w-full rounded-lg bg-zinc-900 px-3 py-2 flex items-center justify-between'>
      <label className='flex items-center gap-2 text-white h-full'>
        <SearchIcon className='h-4 w-4' />
        <input
          autoFocus
          title='Find in page'
          className='outline-none h-full bg-transparent text-sm'
          value={state.query}
          onChange={(e) => {
            setState((prev) => ({ ...prev, query: e.target.value }))
          }}
        />
      </label>
      <div className='text-white flex items-center justify-center gap-2'>
        <button className='hover:bg-zinc-700 p-1 rounded-md transition'>
          <ArrowUpIcon className='h-4 w-4' />
          <span className='sr-only'>Previous result</span>
        </button>
        <button className='hover:bg-zinc-700 p-1 rounded-md transition'>
          <ArrowDownIcon className='h-4 w-4' />
          <span className='sr-only'>Next result</span>
        </button>
        <button className='hover:bg-zinc-700 p-1 rounded-md transition'>
          <XIcon className='h-4 w-4' />
          <span className='sr-only'>Close find in page</span>
        </button>
      </div>
    </div>
  )
}

root.render(<App />)
