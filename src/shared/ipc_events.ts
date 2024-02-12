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
  FindInPage_StartHiding = 'find-in-page_start-hiding',
  NotFound_SetReason = 'not-found_set-reason',
}

export enum FindInPageEvents {
  Show = 'enable-find-in-page',
  Hide = 'disable-find-in-page',
  UpdateQuery = 'update-find-in-page-search-query',
}

export enum AddressBarEvents {
  Go = 'ab__go',
  Close = 'ab__close',
  GetCurrentUrl = 'ab__get-current-url',
}

export enum NewTabEvents {
  Go = 'nt__go',
  Close = 'nt__close',
  SearchOpenTabs = 'nt__search-open-tabs',
}

export enum SettingsDialogEvents {
  GetAdblockValue = 'settings__get-adblock-value',
  SetAdblockValue = 'settings__set-adblock-value',
  GetDefaultSearchEngine = 'settings__get-default-search-engine',
  SetDefaultSearchEngine = 'settings__set-default-search-engine',
  Close = 'settings__close',
}

export enum NotFoundEvents {}
