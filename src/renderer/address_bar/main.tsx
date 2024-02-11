import { createRoot } from 'react-dom/client'
import * as React from 'react'
import './globals.css'
import { AddressBarEvents } from '~/shared/ipc_events'
import { useDidMount } from 'rooks'
import { useEventListener } from 'usehooks-ts'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function waitOneTick() {
  return sleep(1)
}

function App() {
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const close = () => ipcRenderer.invoke(AddressBarEvents.Close)
  useDidMount(async () => {
    const url = await ipcRenderer.invoke(AddressBarEvents.GetCurrentUrl)
    setQuery(url)

    await waitOneTick()
    inputRef.current?.focus()
    inputRef.current?.select()
  })
  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close()
    }
  })

  return (
    <div className='h-full w-full relative grid place-items-center'>
      <div
        className='h-full w-full fixed top-0 left-0 bg-black/15 transition'
        onClick={() => {
          close()
        }}
      />
      <div className='bg-zinc-700 flex items-center shadow-lg w-1/4 rounded-lg text-sm'>
        <input
          ref={inputRef}
          className='h-11 w-full py-2 bg-transparent text-white outline-none px-4'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              ipcRenderer.invoke(AddressBarEvents.Go, query)
            }
          }}
          value={query}
          onInput={(e) => {
            setQuery(e.currentTarget.value)
          }}
        />
      </div>
    </div>
  )
}

root.render(<App />)
