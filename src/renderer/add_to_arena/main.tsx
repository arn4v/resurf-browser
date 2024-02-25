import { createRoot } from 'react-dom/client'
import '../common/globals.css'
import { XIcon } from 'lucide-react'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

function App() {
  function handleClose() {}

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
      </div>
    </div>
  )
}

root.render('Arena client')
