import * as React from "react";
import { useDidMount } from "rooks";
import { useIpcListener } from "~/hooks/useIpcListener";
import { sendIpcMessage } from "~/lib/ipc";
import {
  MainProcessEmittedEvents,
  RendererEmittedEvents,
} from "~/shared-types/ipc_events";
import { Tab, TabsMap } from "~/shared-types/tabs";

export function Sidebar() {
  const [tabs, setTabs] = React.useState<TabsMap | null>(null);
  const [activeTab, setActiveTab] = React.useState<Tab["id"] | null>(null);

  useDidMount(() => {
    sendIpcMessage(RendererEmittedEvents.TabsReady);
  });

  useIpcListener(
    MainProcessEmittedEvents.TabsSetInitialTabs,
    (_, tabs: TabsMap) => {
      if (!tabs) setTabs(tabs);
    }
  );
  useIpcListener(
    MainProcessEmittedEvents.TabsUpdateTabConfig,
    (_, tab: Tab) => {
      setTabs((prev) => ({
        ...prev,
        [tab.id]: tab,
      }));
    }
  );
  useIpcListener(
    MainProcessEmittedEvents.TabsUpdateActiveTabs,
    (_, activeTab: Tab["id"]) => {
      setActiveTab(activeTab);
    }
  );

  return (
    <div className="h-full w-full shadow-inner bg-gray-200 pt-8">
      {!!tabs && (
        <ul className="px-3">
          {Object.values(tabs).map((tab) => {
            return (
              <li>
                <button
                  onClick={() => {
                    sendIpcMessage(
                      RendererEmittedEvents.TabsUpdateActiveTab,
                      tab.id
                    );
                  }}
                >
                  <span>
                    {tab.favicon ? (
                      <img src={tab.favicon} alt={`${tab.title} Favicon`} />
                    ) : (
                      "🌐"
                    )}
                  </span>
                  <span>{tab.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
