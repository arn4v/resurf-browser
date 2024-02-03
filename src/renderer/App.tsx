import React, { useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./components/core/Sidebar";
import { NewTabDialog } from "./components/core/NewTabDialog";

export function App() {
  const [defaultSize, setDefaultSize] = React.useState<number | null>(null);

  useEffect(() => {
    electron.ipcRenderer.send("sidebar-ready");
    electron.ipcRenderer.on("set-initial-sidebar-width", (_, width: number) => {
      setDefaultSize(width);
    });
  }, []);

  if (!defaultSize) return null;

  return (
    <>
      <NewTabDialog />
      <PanelGroup
        direction="horizontal"
        onLayout={(layout) => {
          const [sidebarWidth] = layout;
          electron.ipcRenderer.send("sidebar-width-update", sidebarWidth);
        }}
      >
        <Panel minSize={10} maxSize={20} defaultSize={defaultSize}>
          <Sidebar />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={80}>
          <div
            onMouseOver={() => {
              console.log("mouse over");
            }}
          />
        </Panel>
      </PanelGroup>
    </>
  );
}
