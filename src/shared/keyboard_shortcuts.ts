export const ELECTRON_MOD_KEY = 'CommandOrControl'
export enum KeyboardShortcuts {
  NewTab = `${ELECTRON_MOD_KEY}+T`,
  CloseTab = `${ELECTRON_MOD_KEY}+W`,
  NextTab = `Control+Tab`,
  PreviousTab = 'Shift+Control+Tab',
  ReloadPage = `${ELECTRON_MOD_KEY}+R`,
  HistoryBack = `${ELECTRON_MOD_KEY}+[`,
  HistoryForward = `${ELECTRON_MOD_KEY}+]`,
  FindInPage = `${ELECTRON_MOD_KEY}+F`,
  OpenAddressBar = `${ELECTRON_MOD_KEY}+L`,
}
