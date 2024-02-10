export enum ControlEmittedEvents {
  SidebarReady = 'sidebar-ready',
  SidebarUpdateWidth = 'sidebar-update-width',
  Tabs_Ready = 'tabs-ready',
  Tabs_UpdateActiveTab = 'tabs_update-active-tab',
  Tabs_CloseTab = 'tabs_close-tab',
}

export enum MainProcessEmittedEvents {
  Tabs_UpdateTabs = 'tabs_update-tabs',
  TabsUpdateActiveTab = 'update-active-tab',
  SidebarSetInitialWidth = 'set-initial-sidebar-width',
  NewTabDialogToggle = 'toggle-new-tab-dialog',
  FindInPage_Update = 'find-in-page__update',
  FindInPage_SetInitial = 'find-in-page__set-initial',
}

export enum FindInPageEvents {
  Show = 'enable-find-in-page',
  Hide = 'disable-find-in-page',
  UpdateQuery = 'update-find-in-page-search-query',
}
