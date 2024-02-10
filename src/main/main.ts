import { createId } from '@paralleldrive/cuid2'
import {
  BrowserView,
  BrowserWindow,
  app,
  ipcMain,
  screen,
  webContents,
  webContents,
} from 'electron'
import contextMenu from 'electron-context-menu'
import Store from 'electron-store'
import path from 'path'
import {
  ControlEmittedEvents,
  FindInPageEvents,
  MainProcessEmittedEvents,
} from 'src/shared/ipc_events'
import { Tab, TabsMap } from 'src/shared/tabs'
import { FIND_IN_PAGE_HEIGHT, FIND_IN_PAGE_WIDTH } from '~/shared/constants'
import { KeyboardShortcuts } from '../shared/keyboard_shortcuts'
import { ShortcutManager } from './shortcut_manager'

export type Brand<Name extends string, T> = T & { __brand: Name }

export const Env = {
  platform: {
    isWin: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
  },
  app: {
    version: app.getVersion(),
  },
  deploy: {
    isDevelopment: !app.isPackaged,
    isProduction: app.isPackaged,
  },
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

const preloadPath = path.resolve(__dirname, './preload.js')

type StoredPreferences = {
  windowBounds: ReturnType<typeof screen.getPrimaryDisplay>['bounds']
  sidebarWidth: number
  tabs: TabsMap
  lastActiveTab: string | null
}
const preferencesStore = new Store<StoredPreferences>()
preferencesStore.clear()

function getInternalViewPath(view: string) {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/${view}/index.html`
  } else {
    return path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/${view}/index.html`)
  }
}

class BidiMap<K, V> {
  private keyToValue = new Map<K, V>()
  private valueToKey = new Map<V, K>()

  set(key: K, value: V): void {
    this.keyToValue.set(key, value)
    this.valueToKey.set(value, key)
  }

  getByKey(key: K): V | undefined {
    return this.keyToValue.get(key)
  }

  getByValue(value: V): K | undefined {
    return this.valueToKey.get(value)
  }

  deleteByKey(key: K): boolean {
    const value = this.keyToValue.get(key)
    if (value !== undefined) {
      this.valueToKey.delete(value)
    }
    return this.keyToValue.delete(key)
  }

  deleteByValue(value: V): boolean {
    const key = this.valueToKey.get(value)
    if (key !== undefined) {
      this.keyToValue.delete(key)
    }
    return this.valueToKey.delete(value)
  }
}

class AppWindow {
  window: BrowserWindow
  sidebarView: BrowserView
  tabToBrowserView = new Map<string, BrowserView>()
  tabToWebContentsId = new BidiMap<string, number>()
  tabs = new Map<string, Tab>()
  activeTab: string | null = null
  shortcutManager: ShortcutManager

  constructor() {
    this.window = new BrowserWindow({
      ...this.getWindowBounds(),
      y: 0,
      ...(Env.platform.isMac
        ? {
            titleBarStyle: 'hidden',
            trafficLightPosition: { x: 16, y: 8 },
            frame: false,
          }
        : {}),
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: true,
      },
    })

    this.sidebarView = new BrowserView({
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: true,
        // contextIsolation: tru,
      },
    })
    this.setupSidebarView()

    this.shortcutManager = new ShortcutManager(this.window)
    this.registerShortcuts()
    this.setupResizeAndMoveListeners()
    this.setupIpcHandlers()
    this.restoreTabsOrCreateBlank()

    setInterval(() => {
      this.persistTabs()
    }, 1000)
  }

  restoreTabsOrCreateBlank() {
    const savedTabs = preferencesStore.get('tabs')
    if (savedTabs && Object.entries(savedTabs).length >= 1 && !Env.deploy.isDevelopment) {
      const tabsArr = Object.entries(savedTabs)
      const tabs = new Map<string, Tab>(tabsArr)
      this.tabs = tabs
      const lastActiveTab = preferencesStore.get('lastActiveTab') || tabsArr[0][0]
      this.setActiveTab(lastActiveTab)
      this.emitUpdateTabs()
    } else {
      this.newTab('https://google.com', true)
    }
  }

  getActiveView() {
    if (!this.activeTab) return undefined
    return this.tabToBrowserView.get(this.activeTab)
  }

  registerShortcuts() {
    this.shortcutManager.registerShortcut(KeyboardShortcuts.NewTab, () => {
      this.newTab('https://bing.com', true)
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.CloseTab, () => {
      if (this.activeTab) this.closeTab(this.activeTab)
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.ReloadPage, () => {
      if (!this.activeTab) return
      this.getActiveView()?.webContents.reload()
      this.destroyFindInPageForTab(this.activeTab)
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.NextTab, () => {
      this.switchTab(+1)
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.PreviousTab, () => {
      this.switchTab(-1)
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.HistoryBack, () => {
      this.getActiveView()?.webContents.goBack()
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.HistoryForward, () => {
      this.getActiveView()?.webContents.goForward()
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.FindInPage, () => {
      this.toggleFindInPageForActiveTab()
    })
  }

  destroy() {
    this.window.destroy()
    this.shortcutManager.unregisterShortcuts()
  }

  /*******************
   * WEBVIEW HELPERS *
   *******************/
  getWindowBounds() {
    const windowBounds = preferencesStore.get('windowBounds')
    const bounds = windowBounds ?? screen.getPrimaryDisplay().workAreaSize
    return bounds
  }

  getWebviewBounds() {
    const winBounds = this.window.getBounds()
    return {
      width: normalizeNumber(
        winBounds.width - winBounds.width * (this.getSidebarWidthOrDefault() / 100),
      ),
      height: winBounds.height,
      x: normalizeNumber(winBounds.width * (this.getSidebarWidthOrDefault() / 100)),
      y: 0,
    }
  }

  createWebview(tabId: string, url: string) {
    const tabView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        devTools: true,
        contextIsolation: true,
        sandbox: true,
        scrollBounce: true,
        safeDialogs: true,
        autoplayPolicy: 'user-gesture-required',
      },
    })

    tabView.setAutoResize({
      width: true,
      height: true,
      horizontal: true,
      vertical: true,
    })
    tabView.setBounds(this.getWebviewBounds())

    contextMenu({
      window: tabView,
      showSelectAll: true,
      showCopyImage: true,
      showCopyImageAddress: true,
      showSaveImage: true,
      showSaveLinkAs: true,
      showInspectElement: true,
    })

    tabView.webContents.loadURL(url ?? 'about:blank')
    tabView.webContents.on('page-favicon-updated', (_, favicons) => {
      if (favicons[0]) {
        this.updateTabConfig(tabId, {
          favicon: favicons[0],
        })
      }
    })
    tabView.webContents.on('page-title-updated', (_, title) => {
      this.updateTabConfig(tabId, {
        title,
      })
    })
    tabView.webContents.setWindowOpenHandler(({ disposition, url }) => {
      if (disposition === 'background-tab') {
        this.newTab(url, false, tabId)
        return {
          action: 'deny',
        }
      }

      return {
        action: 'allow',
      }
    })

    return tabView
  }

  loadInternalViewURLOrFile(view: BrowserView, urlOrFilePath: string) {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      view.webContents.loadURL(urlOrFilePath)
    } else {
      view.webContents.loadFile(urlOrFilePath)
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                    TABS                                    */
  /* -------------------------------------------------------------------------- */
  switchTab(direction: number) {
    if (!this.activeTab) return
    const tabsArray = Array.from(this.tabs.keys())
    const currentTabIndex = tabsArray.indexOf(this.activeTab)
    if (currentTabIndex === -1) return

    // Calculate the new active tab index, wrapping around if necessary
    const newActiveTabIndex = (currentTabIndex + direction + tabsArray.length) % tabsArray.length

    // Get the new active tab ID
    const newActiveTabId = tabsArray[newActiveTabIndex]

    // Set and show the new active tab
    this.setActiveTab(newActiveTabId)
  }

  closeTab(tabId: Tab['id']) {
    // Get a sorted array of the tab IDs
    const tabsArray = Array.from(this.tabs.keys())

    // Find the index of the tab to be closed
    const closingTabIndex = tabsArray.indexOf(tabId)

    // Only proceed if the tab is found
    if (closingTabIndex !== -1) {
      // Determine the new active tab if the closing tab is the current active tab
      if (this.activeTab === tabId) {
        // Calculate the new active tab index
        let newActiveTabIndex = closingTabIndex === 0 ? 1 : closingTabIndex - 1

        // Ensure the new index is within the bounds of the tabs array
        newActiveTabIndex = Math.min(Math.max(newActiveTabIndex, 0), tabsArray.length - 1)

        // Get the new active tab ID
        const newActiveTabId = tabsArray[newActiveTabIndex]

        // Set and show the new active tab
        this.setActiveTab(newActiveTabId)
      }

      // Remove the closing tab from the data structures and UI
      const browserView = this.tabToBrowserView.get(tabId)
      if (browserView) {
        this.window.removeBrowserView(browserView)
        browserView.webContents.close() // Ensure the BrowserView is properly cleaned up
      }
      this.tabToBrowserView.delete(tabId)
      this.tabs.delete(tabId)
      this.destroyFindInPageForTab(tabId)

      // Update the UI to reflect the new state of the tabs
      this.emitUpdateTabs()

      const newActiveView = this.tabToBrowserView.get(tabId)
      if (newActiveView) {
        newActiveView.webContents.focus() // This will focus the BrowserView's contents
      }
    }
  }

  setActiveTab(tabId: Tab['id'], noSanityChecks = false) {
    const newActiveTab = this.tabs.get(tabId)
    if (!newActiveTab) return
    if (!noSanityChecks && this.activeTab === tabId) return
    const currentActiveTab = this.activeTab
    // const activeView = this.getActiveView()

    let newActiveView = this.tabToBrowserView.get(tabId)
    if (newActiveTab && !newActiveView) {
      newActiveView = this.createWebview(newActiveTab.id, newActiveTab.url)
      this.tabToBrowserView.set(newActiveTab.id, newActiveView)
      this.tabToWebContentsId.set(newActiveTab.id, newActiveView.webContents.id)
    }

    if (newActiveView) {
      this.activeTab = tabId
      newActiveView.setBounds(this.getWebviewBounds())
      newActiveView.webContents.focus()
      // Set controlView as top view first, so that controlView zIndex = 0, newActiveView zIndex = 1
      // This fixes the bug where previous active view is on top of controlView, causing it to show when the
      // sidebar is resized
      this.window.setTopBrowserView(this.sidebarView)
      this.window.addBrowserView(newActiveView)
      this.window.setTopBrowserView(newActiveView)

      this.emitUpdateTabs()
    }

    if (currentActiveTab && this.tabToFindInPageView.get(currentActiveTab)) {
      this.hideFindInPageForTab(currentActiveTab)
    }

    if (this.tabToFindInPageView.get(newActiveTab.id)) {
      this.showFindInPageForTab(newActiveTab.id)
    }

    // Don't removeBrowserView, because it causes a glitchy flash when added back again
    // Keep as many browser views in memory as possible
    // if (activeView) {
    // this.window.removeBrowserView(activeView);
    // }
  }

  emitUpdateTabs() {
    this.emitSidebarEvent(
      MainProcessEmittedEvents.Tabs_UpdateTabs,
      Object.fromEntries(this.tabs.entries()),
    )
    this.emitSidebarEvent(MainProcessEmittedEvents.TabsUpdateActiveTab, this.activeTab)
  }

  persistTabs() {
    preferencesStore.set('tabs', Object.fromEntries(this.tabs.entries()))
    preferencesStore.set('lastActiveTab', this.activeTab)
  }
  updateTabConfig(id: Tab['id'], update: Partial<Tab>) {
    this.tabs.set(id, {
      ...this.tabs.get(id)!,
      ...update,
    })
    this.emitUpdateTabs()
  }

  newTab(url?: string, focus?: boolean, parent?: string) {
    if (!url) url = 'about:blank'
    const tabId = createId()
    const tab: Tab = {
      id: tabId,
      url,
      title: url,
      parent,
    }
    const view = this.createWebview(tabId, url)
    this.tabToBrowserView.set(tabId, view)
    this.tabToWebContentsId.set(tabId, view.webContents.id)
    this.tabs.set(tabId, tab)
    if (focus) {
      this.setActiveTab(tabId)
    }
    this.emitUpdateTabs()
  }

  setupTabHandlers() {
    // Tabs
    ipcMain.on(ControlEmittedEvents.Tabs_Ready, (event) => {
      event.reply(MainProcessEmittedEvents.Tabs_UpdateTabs, Object.fromEntries(this.tabs.entries()))
      event.reply(MainProcessEmittedEvents.TabsUpdateActiveTab, this.activeTab)
    })
    ipcMain.on(ControlEmittedEvents.Tabs_CloseTab, (event, tabId: string) => {
      this.closeTab(tabId)
    })
    ipcMain.on(ControlEmittedEvents.Tabs_UpdateActiveTab, (_, tabId: string) => {
      this.setActiveTab(tabId)
    })
  }

  /* -------------------------------------------------------------------------- */
  /*                                FIND IN PAGE                                */
  /* -------------------------------------------------------------------------- */
  tabToFindInPageView = new Map<string, BrowserView>()
  tabToFindInPageVisibility = new Map<string, boolean>()

  createBrowserViewForFindInPage() {
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        // contextIsolation: false,
        // sandbox: false,
        preload: preloadPath,
      },
    })
    this.loadInternalViewURLOrFile(view, getInternalViewPath('find'))
    return view
  }

  showFindInPageForTab(tabId: string) {
    const findInPageView =
      this.tabToFindInPageView.get(tabId) || this.createBrowserViewForFindInPage()

    this.window.addBrowserView(findInPageView)
    this.window.setTopBrowserView(findInPageView)
    findInPageView.setBounds({
      height: FIND_IN_PAGE_HEIGHT,
      width: FIND_IN_PAGE_WIDTH,
      y: 0,
      x: this.window.getBounds().width - (FIND_IN_PAGE_WIDTH + 32),
    })
    findInPageView.webContents.focus()
    this.tabToFindInPageView.set(tabId, findInPageView)
    this.tabToFindInPageVisibility.set(tabId, true)
  }

  hideFindInPageForTab(tabId: string) {
    const view = this.tabToFindInPageView.get(tabId)
    if (!view) return
    this.window.removeBrowserView(view)
    this.tabToFindInPageVisibility.set(tabId, false)
    view.webContents.stopFindInPage('clearSelection')
  }

  destroyFindInPageForTab(tabId: string) {
    this.hideFindInPageForTab(tabId)
    this.tabToFindInPageView.delete(tabId)
    this.stopFindInPage(tabId)
  }

  stopFindInPage(tabId: string) {
    const tab = this.tabToBrowserView.get(tabId)
    if (!tab) return
    tab.webContents.stopFindInPage('clearSelection')
  }

  findInPage(params: { tabId: string; query: string; findNext: boolean; forward: boolean }) {
    const { tabId, query, findNext, forward } = params
    const tab = this.tabToBrowserView.get(tabId)
    if (!tab) return
    if (query === '') {
      this.stopFindInPage(tabId)
    } else {
      tab.webContents.findInPage(query, {
        matchCase: false,
        findNext,
        forward,
      })
    }
  }

  setupFindInPageHandlers() {
    // Find in page
    ipcMain.handle(FindInPageEvents.Hide, () => {
      if (!this.activeTab) return
      this.hideFindInPageForTab(this.activeTab)
    })
    ipcMain.handle(
      FindInPageEvents.UpdateQuery,
      (_, query: string, findNext: boolean, forward: boolean) => {
        if (!this.activeTab) return
        this.findInPage({ tabId: this.activeTab, query, findNext, forward })
      },
    )
  }

  toggleFindInPageForActiveTab() {
    const tabId = this.activeTab
    if (!tabId) return
    const visbility = this.tabToFindInPageVisibility.get(tabId)
    this.tabToFindInPageVisibility.set(tabId, !visbility)
    this.showFindInPageForTab(tabId)
  }

  /* -------------------------------------------------------------------------- */
  /*                                   SIDEBAR                                  */
  /* -------------------------------------------------------------------------- */
  emitSidebarEvent(channel: MainProcessEmittedEvents, ...args: any[]) {
    this.sidebarView.webContents.send(channel, ...args)
  }

  setupSidebarView() {
    const controlView = this.sidebarView
    controlView.setBackgroundColor('hsla(0, 0%, 100%, 0.0)')
    controlView.setBounds({
      ...this.window.getBounds(),
      y: 0,
    })
    controlView.setAutoResize({ width: true, height: true })
    // and load the index.html of the app.

    this.loadInternalViewURLOrFile(controlView, getInternalViewPath('sidebar'))
    if (Env.deploy.isDevelopment) {
      controlView.webContents.openDevTools()
    }
    this.window.addBrowserView(controlView)
    this.window.setTopBrowserView(controlView)
  }

  getSidebarWidthOrDefault() {
    return preferencesStore.get('sidebarWidth') || 15
  }

  setupSidebarHandlers() {
    // Sidebar
    ipcMain.on(ControlEmittedEvents.SidebarReady, (event) => {
      const storedWidth = preferencesStore.get('sidebarWidth')
      event.reply(MainProcessEmittedEvents.SidebarSetInitialWidth, storedWidth || 15)
    })
    ipcMain.on(ControlEmittedEvents.SidebarUpdateWidth, (_, sidebarWidth: number) => {
      preferencesStore.set('sidebarWidth', sidebarWidth)
      this.getActiveView()?.setBounds(this.getWebviewBounds())
      for (const key in this.tabToBrowserView.keys()) {
        this.tabToBrowserView.get(key)?.setBounds(this.getWebviewBounds())
      }
    })
  }

  /* -------------------------------------------------------------------------- */
  /*                               PUBSUB HANDLERS                              */
  /* -------------------------------------------------------------------------- */
  setupResizeAndMoveListeners() {
    this.window.on('resize', () => {
      const { width, height, x, y } = this.window.getBounds()
      this.getActiveView()?.setBounds(this.getWebviewBounds())
      preferencesStore.set('windowBounds', { width, height, x, y })
    })
    this.window.on('move', () => {
      const { width, height, x, y } = this.window.getBounds()
      preferencesStore.set('windowBounds', { width, height, x, y })
    })
  }
  setupIpcHandlers() {
    this.setupSidebarHandlers()
    this.setupTabHandlers()
    this.setupFindInPageHandlers()
  }
}

export const normalizeNumber = (value: number | undefined): number =>
  value && isFinite(1 / value) ? Math.trunc(value) : 0

const windows = new Map<string, AppWindow>()

function createWindow() {
  const id = createId()
  const window = new AppWindow()
  return {
    id,
    window,
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  const { id, window } = createWindow()
  windows.set(id, window)
  if (Env.platform.isMac && Env.deploy.isDevelopment) {
    app.dock.setIcon(path.join(app.getAppPath(), 'assets/icon.png'))
    app.setName('Resurf Dev')
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    windows.forEach((window) => {
      window.destroy()
    })
    windows.clear()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    const { id, window } = createWindow()
    windows.set(id, window)
  }
})
