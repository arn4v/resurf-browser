import { createRoot } from 'react-dom/client'
import '../common/globals.css'
import { useEventListener } from 'usehooks-ts'

const container = document.getElementById('root') as HTMLDivElement
const root = createRoot(container)

function App() {
  function handleClose() {}

  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  })

  return (
    <div className='h-full w-full relative grid place-items-center dark'>
      <div className='h-full w-full absolute top-0 left-0 bg-black/10 z-10' onClick={handleClose} />
      <div className='bg-zinc-800 flex flex-col items-start justify-start shadow-lg w-1/4 h-[25%] rounded-lg text-sm z-20 text-white p-4'>
        <div className='flex items-center justify-between w-full'>
          <h1 className='font-semibold text-xl'>Settings</h1>
        </div>
        <div className='h-px w-full bg-zinc-600 my-4' />
      </div>
    </div>
  )
}

root.render(<App />)
