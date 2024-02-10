import * as React from 'react'
import { useIpcListener } from '~/common/hooks/useIpcListener'
import { Dialog } from '../../common/ui/dialog'
import { Input } from '../../common/ui/input'
import { MainProcessEmittedEvents } from 'src/shared/ipc_events'

export function NewTabDialog() {
  const [open, setOpen] = React.useState(false)

  useIpcListener(MainProcessEmittedEvents.NewTabDialogToggle, () => {
    setOpen((prev) => !prev)
  })

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Content className='p-0'>
        <Dialog.Close />
        <Input autoFocus />
      </Dialog.Content>
    </Dialog.Root>
  )
}
