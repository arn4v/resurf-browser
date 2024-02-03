import { GlobeIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { useDidMount } from "rooks";
import { useIpcListener } from "~/hooks/useIpcListener";
import { sendIpcMessage } from "~/lib/ipc";
import { cn } from "~/lib/utils";
import {
  ControlEmittedEvents,
  MainProcessEmittedEvents,
} from "~/shared-types/ipc_events";
import { Tab, TabsMap } from "~/shared-types/tabs";

export function Sidebar() {
  const [tabs, setTabs] = React.useState<TabsMap | null>(null);
  const [activeTab, setActiveTab] = React.useState<Tab["id"] | null>(null);

  useDidMount(() => {
    sendIpcMessage(ControlEmittedEvents.Tabs_Ready);
  });
  useIpcListener(
    MainProcessEmittedEvents.Tabs_UpdateTabs,
    (_, tabs: TabsMap) => {
      setTabs(tabs);
    }
  );
  useIpcListener(
    MainProcessEmittedEvents.TabsUpdateActiveTab,
    (_, activeTab: Tab["id"]) => {
      console.log({ activeTab });
      setActiveTab(activeTab);
    }
  );

  return (
    <div className="h-full w-full shadow-inner bg-gray-200 pt-8">
      <Tabs tabs={tabs || {}} activeTab={activeTab} />
    </div>
  );
}

function Tabs({
  tabs,
  activeTab,
}: {
  tabs: TabsMap;
  activeTab: Tab["id"] | null;
}) {
  return (
    <ul className="px-3 w-full">
      {Object.values(tabs).map((tab) => {
        return (
          <li className="w-full" key={tab.id}>
            <button
              className={cn(
                "flex items-center justify-between w-full rounded-lg group",
                tab.id === activeTab
                  ? "bg-gray-300 cursor-default"
                  : "transition hover:bg-gray-200"
              )}
              onClick={() => {
                sendIpcMessage(
                  ControlEmittedEvents.Tabs_UpdateActiveTab,
                  tab.id
                );
              }}
            >
              <span className="inline-flex gap-3 pl-3 py-1.5 items-center">
                {tab.favicon ? (
                  <img
                    src={tab.favicon}
                    alt={`${tab.title} Favicon`}
                    className="w-5 aspect-square"
                  />
                ) : (
                  <GlobeIcon className="h-5 w-5" />
                )}
                <p>{tab.title}</p>
              </span>
              <div className="hidden group-hover:flex items-center justify-center gap-2 pr-3">
                <div
                  className="cursor-pointer h-5 w-5 rounded-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    sendIpcMessage(ControlEmittedEvents.Tabs_CloseTab, tab.id);
                  }}
                >
                  <span className="sr-only">Close tab</span>
                  <Trash2Icon className="h-4 w-4" />
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
