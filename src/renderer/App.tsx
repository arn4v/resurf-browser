import { ipcRenderer } from "electron";
import React, { useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./ui/Sidebar";

export function App() {
  const [defaultSize, setDefaultSize] = React.useState(15);

  useEffect(() => {
    ipcRenderer.sendSync("sidebar-ready");
    ipcRenderer.on("set-initial-sidebar-width", (_, width: number) => {
      setDefaultSize(width);
    });
  }, []);

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={(layout) => {
        const [sidebarWidth] = layout;
        console.log(layout);
        ipcRenderer.send("sidebar-width-update", sidebarWidth);
      }}
    >
      <Panel minSize={15} maxSize={20} defaultSize={defaultSize}>
        <Sidebar />
      </Panel>
      <PanelResizeHandle />
      {/* <Panel minSize={80}></Panel> */}
      {/* <Panel minSize={66}>
        <Stage />
      </Panel> */}
    </PanelGroup>
  );
}
