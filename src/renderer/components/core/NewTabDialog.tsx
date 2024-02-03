import * as React from "react";
import { useIpcListener } from "~/hooks/useIpcListener";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { MainProcessEmittedEvents } from "~/shared-types/ipc_events";

export function NewTabDialog() {
  const [open, setOpen] = React.useState(false);

  useIpcListener(MainProcessEmittedEvents.NewTabDialogToggle, () => {
    setOpen((prev) => !prev);
  });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Content className="p-0">
        <Dialog.Close />
        <Input autoFocus />
      </Dialog.Content>
    </Dialog.Root>
  );
}
