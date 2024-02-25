export enum ControlEmittedEvents {
  GetInitialState = 'sidebar__get-initial-state',
  SidebarUpdateWidth = 'sidebar-update-width',
  UpdateActiveTab = 'tabs_update-active-tab',
  CloseTab = 'tabs_close-tab',
  GetInitialSidebarWidth = 'sidebar__set-initial-sidebar-width',
  ChangeTabParent = 'sidebar__change-tab-parent',
}

export enum MainProcessEmittedEvents {
  UpdateTabs = 'tabs_update-tabs',
  UpdateActiveTab = 'update-active-tab',

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
  Reset = 'nt__reset',
  Search = 'nt__search',
  GetDefaultSearchEngine = 'nt__get-default-search-engine',
  SignalClose = 'nt__signal-close',
  SignalOpen = 'nt__signal-open',
  CopyTabUrl = 'nt__copy-tab-url',
  CloseTab = 'nt__close-tab',
}

export enum SettingsDialogEvents {
  GetAdblockValue = 'settings__get-adblock-value',
  SetAdblockValue = 'settings__set-adblock-value',
  GetDefaultSearchEngine = 'settings__get-default-search-engine',
  SetDefaultSearchEngine = 'settings__set-default-search-engine',
  GetTabCloseBehavior = 'settings__get-tab-close-behavior',
  SetTabCloseBehavior = 'settings__set-tab-close-behavior',
  Close = 'settings__close',
}

export enum NotFoundEvents {}
