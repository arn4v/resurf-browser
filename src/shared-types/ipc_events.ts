export enum RendererEmittedEvents {
  SidebarReady = "sidebar-ready",
  SidebarUpdateWidth = "sidebar-update-width",
  TabsReady = "tabs-ready",
  TabsUpdateActiveTab = "update-active-tab",
}

export enum MainProcessEmittedEvents {
  TabsSetInitialTabs = "set-initial-tabs",
  TabsUpdateTabConfig = "update-tabs",
  TabsUpdateActiveTabs = "update-active-tabs",
  SidebarSetInitialWidth = "set-initial-sidebar-width",
  NewTabDialogToggle = "toggle-new-tab-dialog",
}
