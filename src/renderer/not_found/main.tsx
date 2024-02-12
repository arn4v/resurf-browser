import * as React from 'react'
import { createRoot } from 'react-dom/client'
import '../common/globals.css'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

const reasonToMessage = {
  offline: {
    heading: `You're offline`,
    subheading: `Uh oh, it seems that you're offline. Please connect to the internet and refresh to access this link.`,
  },
  'dead-link': {
    heading: 'Dead link',
    subheading:
      'This link appears to be long dead. Do you want to visit an archived version instead?',
  },
}

function App() {
  const reason = React.useMemo<'offline' | 'dead-link' | null>(() => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('reason') as 'offline' | 'dead-link' | null
  }, [])
  console.log({ reason })

  return (
    <div className='h-full w-full grid place-items-center bg-zinc-800'>
      {reason && (
        <div className='text-center text-white'>
          <h1 className='text-xl'>{reasonToMessage[reason].heading}</h1>
          <span>{reasonToMessage[reason].subheading}</span>
        </div>
      )}
    </div>
  )
}

root.render(<App />)
