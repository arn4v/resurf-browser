import { ElectronBlocker, fullLists } from '@cliqz/adblocker-electron'
import { createId } from '@paralleldrive/cuid2'
import { parse as parsePageContent } from '@postlight/parser'
import { BrowserView, BrowserWindow, app, clipboard, ipcMain, screen } from 'electron'
import contextMenu from 'electron-context-menu'
import Store from 'electron-store'
import { promises as fs } from 'node:fs'
import $signal, { Observable } from 'oby'
import path from 'path'
import {
  AddressBarEvents,
  ControlEmittedEvents,
  FindInPageEvents,
  MainProcessEmittedEvents,
  NewTabEvents,
  SettingsDialogEvents,
} from 'src/shared/ipc_events'
import { Tab, TabCloseBehavior, TabsMap } from 'src/shared/tabs'
import { parse } from 'tldts'
import { FIND_IN_PAGE_HEIGHT, FIND_IN_PAGE_WIDTH } from '~/shared/constants'
import { SearchEngine, engineToSearchUrl, engineToTitle } from '~/shared/search_engines'
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
  window_bounds: Electron.Rectangle | null
  sidebar_width: number
  tabs: TabsMap
  root_tabs_order: string[]
  active_tab: string | null
  adblock_enabled: boolean
  search_engine: SearchEngine
  tab_close_behavior: TabCloseBehavior
}
const preferencesStore = new Store<StoredPreferences>({
  name: Env.deploy.isDevelopment ? 'dev' : undefined,
  defaults: {
    active_tab: null,
    tabs: {},
    root_tabs_order: [],
    adblock_enabled: true,
    search_engine: SearchEngine.Google,
    tab_close_behavior: TabCloseBehavior.Elevate,
    sidebar_width: 20,
    window_bounds: null,
  },
})

function getInternalViewPath(view: string) {
  if (CONTROL_UI_VITE_DEV_SERVER_URL) {
    return `${CONTROL_UI_VITE_DEV_SERVER_URL}/${view}/index.html`
  } else {
    return path.join(__dirname, `../renderer/${view}/index.html`)
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
  browserWindow: BrowserWindow
  sidebarView: BrowserView
  rootTabsOrder: string[] = []
  tabs = new Map<string, Tab>()
  tabToBrowserView = new Map<string, BrowserView>()
  tabToContent = new Map<string, string>()
  tabToWebContentsId = new BidiMap<string, number>()
  tabPlayingMedia: string | null = null
  activeTab: string | null = null
  shortcutManager: ShortcutManager
  blocker: ElectronBlocker | undefined
  currentlyOpenGlobalDialog: 'new_tab' | 'settings' | 'address_bar' | undefined = undefined

  constructor() {
    this.browserWindow = new BrowserWindow({
      ...this.getWindowBounds(),
      y: 0,
      ...(Env.platform.isMac
        ? {
            titleBarStyle: 'hidden',
            trafficLightPosition: { x: 16, y: 8 },
            frame: false,
          }
        : {}),
      minWidth: 800,
      minHeight: 800,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: true,
      },
    })

    this.sidebarView = this.createBrowserViewForControlInterface('')
    this.setupSidebarView()

    this.addressBarView = this.createBrowserViewForControlInterface('address_bar')
    this.settingsView = this.createBrowserViewForControlInterface('settings')
    this.newTabView = this.createBrowserViewForControlInterface('new_tab')

    this.shortcutManager = new ShortcutManager(this.browserWindow)
    this.registerShortcuts()
    this.setupResizeAndMoveListeners()
    this.setupIpcHandlers()

    void this.setupAdblocker()

    this.restoreTabsOrCreateBlank()
  }

  getPersistedTabs() {
    return {
      tabs: preferencesStore.get('tabs'),
      rootTabsOrder: preferencesStore.get('root_tabs_order'),
    }
  }

  restoreTabsOrCreateBlank() {
    const { rootTabsOrder = [], tabs } = this.getPersistedTabs()
    if (tabs && Object.entries(tabs).length >= 1) {
      const tabIds = new Set(Object.keys(tabs))
      const tabsArr = Object.entries(tabs)
        .map(([id, tab]) => {
          return [
            id,
            {
              id: tab.id,
              title: tab.title,
              url: tab.url,
              favicon: tab.favicon,
              parent: tab.parent && tabIds.has(tab.parent) ? tab.parent : undefined,
            } as Tab,
          ] as [string, Tab]
        })
        .filter(([_, tab]) => {
          return !!tab.id && !!tab.url
        })
      this.tabs = new Map<string, Tab>(tabsArr)
      this.rootTabsOrder = rootTabsOrder.filter((x) => tabIds.has(x)) || []
      const lastActiveTab = preferencesStore.get('active_tab') || tabsArr[0][0]
      this.setActiveTab(lastActiveTab)
      this.emitUpdateTabs()
    } else {
      this.createTab('https://google.com', true)
    }
  }

  getActiveView() {
    if (!this.activeTab) return undefined
    return this.tabToBrowserView.get(this.activeTab)
  }

  registerShortcuts() {
    this.shortcutManager.registerShortcut(KeyboardShortcuts.NewTab, () => {
      this.toggleNewTabPopup()
      // this.newTab('https://google.com', true)
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
      this.closeAddressBar()
      this.toggleFindInPageForActiveTab()
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.OpenAddressBar, () => {
      this.toggleAddressBar()
    })
    this.shortcutManager.registerShortcut(KeyboardShortcuts.OpenSettings, () => {
      this.toggleSettings()
    })
  }

  destroy() {
    this.browserWindow.destroy()
    this.shortcutManager.unregisterShortcuts()
  }

  /* -------------------------------------------------------------------------- */
  /*                                   ADBLOCK                                  */
  /* -------------------------------------------------------------------------- */
  get adblockEnabled(): boolean {
    return !!preferencesStore.get('adblockEnabled')
  }

  async setupAdblocker() {
    if (this.blocker) return null
    const adblockEnabled = preferencesStore.get('adblockEnabled')
    if (adblockEnabled !== false) {
      const blocker = await ElectronBlocker.fromLists(
        fetch,
        fullLists,
        {
          enableCompression: true,
        },
        {
          path: 'adblock.bin',
          read: fs.readFile,
          write: fs.writeFile,
        },
      )
      this.blocker = blocker
      return this.blocker as ElectronBlocker
    }
  }

  async enableAdblock() {
    const blocker = await this.setupAdblocker()
    preferencesStore.set('adblockEnabled', true)
    for (const [_, view] of this.tabToBrowserView) {
      blocker?.enableBlockingInSession(view.webContents.session)
    }
  }

  disableAdblock() {
    for (const [_, view] of this.tabToBrowserView) {
      this.blocker?.disableBlockingInSession(view.webContents.session)
    }
    preferencesStore.set('adblockEnabled', false)
  }

  /* -------------------------------------------------------------------------- */
  /*                               Global Dialogs                               */
  /* -------------------------------------------------------------------------- */
  closeCurrentlyOpenGlobalDialog() {
    switch (this.currentlyOpenGlobalDialog) {
      case 'new_tab': {
        this.closeNewTabPopup()
        return
      }
      case 'address_bar': {
        this.closeAddressBar()
        return
      }
      case 'settings': {
        this.closeSettings()
        return
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               WEBVIEW HELPERS                              */
  /* -------------------------------------------------------------------------- */
  getWindowBounds() {
    const windowBounds = preferencesStore.get('window_bounds')
    const screenBounds = screen.getPrimaryDisplay().workAreaSize
    if (!windowBounds) {
      return screenBounds
    }
    const bounds: Electron.Rectangle = {
      height: Math.min(windowBounds?.height, screenBounds.height),
      width: Math.min(windowBounds?.width, screenBounds.width),
      x: Math.max(windowBounds?.x, 0),
      y: Math.max(windowBounds?.y, 0),
    }
    return bounds
  }

  getWebviewBounds() {
    const winBounds = this.browserWindow.getBounds()
    return {
      height: winBounds.height,
      y: 0,
      width: normalizeNumber(winBounds.width - this.getSidebarWidth()) + 5,
      x: normalizeNumber(this.getSidebarWidth()),
    }
  }

  createWebview(tabId: string, url: string) {
    const view = new BrowserView({
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
    if (this.blocker) this.blocker.enableBlockingInSession(view.webContents.session)

    view.setAutoResize({
      width: true,
      height: true,
      horizontal: true,
      vertical: true,
    })
    view.setBounds(this.getWebviewBounds())
    view.setBackgroundColor('#FFFFFF')

    contextMenu({
      window: view,
      showSelectAll: true,
      showCopyImage: true,
      showCopyImageAddress: true,
      showSaveImage: true,
      // showSaveLinkAs: true,
      showInspectElement: true,
      showCopyLink: true,
      showSearchWithGoogle: false,
      prepend: (_, params) => {
        return [
          {
            label: 'Open',
            visible: params.linkURL.length > 0,
            click: () => {
              this.getActiveView()?.webContents.loadURL(params.linkURL)
            },
          },
          {
            label: 'Open in tree',
            visible: params.linkURL.length > 0,
            click: () => {
              this.createTab(params.linkURL, false, tabId)
            },
          },
          {
            label: `Search ${engineToTitle[this.defaultSearchEngine]} for “{selection}”`,
            // Only show it when right-clicking text
            visible: params.linkURL.length === 0 && params.selectionText.trim().length > 0,
            click: () => {
              this.createTab(
                `${engineToSearchUrl[this.defaultSearchEngine]}${encodeURIComponent(params.selectionText)}`,
                true,
                tabId,
              )
            },
          },
        ]
      },
    })

    view.webContents.on('page-favicon-updated', async (_, favicons) => {
      if (favicons[0]) {
        const exists = await fetch(favicons[0])
        if (exists.ok) {
          this.updateTabConfig(tabId, {
            favicon: favicons[0],
          })
        }
      } else {
        this.updateTabConfig(tabId, {
          favicon: undefined,
        })
      }
    })

    async function getContent(url: string) {
      try {
        const text = await view.webContents.executeJavaScript(
          `document.documentElement.innerText`,
          true,
        )
        console.log({ text })
        return text
        // console.log(html)
        // const result = await parsePageContent(url, { contentType: 'text', html: html })
        // console.log(result)
        // return result.content
      } catch (err) {
        console.log(err)
        return null
      }
    }

    view.webContents.on('page-title-updated', async (_, title) => {
      const content = await getContent(url)
      if (content) this.tabToContent.set(tabId, content)
      this.updateTabConfig(tabId, {
        title,
      })
    })

    view.webContents.on('media-started-playing', async () => {
      if (this.tabPlayingMedia) {
        this.tabToBrowserView.get(this.tabPlayingMedia)?.webContents.executeJavaScript(`
        
        `)
        this.tabPlayingMedia = tabId
      }
    })

    view.webContents.on('did-navigate', async () => {
      const url = view.webContents.getURL()
      const title = view.webContents.getTitle()
      const content = await getContent(url)
      if (content) this.tabToContent.set(tabId, content)
      // const content = await getContent(url)
      this.updateTabConfig(tabId, {
        title,
        url,
      })
    })

    view.webContents.on('did-navigate-in-page', async () => {
      const url = view.webContents.getURL()
      const content = await getContent(url)
      if (content) this.tabToContent.set(tabId, content)
      this.updateTabConfig(tabId, {
        title: view.webContents.getTitle(),
        url,
      })
    })

    view.webContents.setWindowOpenHandler(({ disposition, url }) => {
      if (disposition === 'foreground-tab' || disposition === 'background-tab') {
        this.createTab(url, false, tabId)
        return {
          action: 'deny',
        }
      }

      return {
        action: 'allow',
      }
    })

    view.webContents.loadURL(url ?? 'about:blank')

    // view.webContents.on(
    //   'did-fail-load',
    //   async (_, errorCode, errorDescription, validatedURL, isMainFrame) => {
    //     if (isMainFrame && errorDescription === 'ERR_CONNECTION_REFUSED') {
    //       const notFoundUrl =
    //         getInternalViewPath('not_found') +
    //         `?reason=${(await isOnline()) ? 'offline' : 'dead-link'}`

    //       this.loadInternalViewURLOrFile(view, notFoundUrl)

    //       this.updateTabConfig(tabId, {
    //         title: this.tabs.get(tabId)?.url,
    //         favicon: undefined,
    //       })
    //     }
    //   },
    // )

    return view
  }

  createBrowserViewForControlInterface(name: string) {
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: true,
        // contextIsolation: false,
        // sandbox: false,
        preload: preloadPath,
      },
    })

    view.webContents.on('did-finish-load', () => {
      view.webContents.executeJavaScript(
        `window.onkeydown = function(evt) {
          // disable zooming
          if ((evt.code == "Minus" || evt.code == "Equal") && (evt.ctrlKey || evt.metaKey)) {evt.preventDefault()}
        }`,
      )
    })

    view.webContents.setVisualZoomLevelLimits(1, 1)
    // view.webContents.setLayoutZoomLevelLimits(0, 0)

    view.setAutoResize({
      width: true,
      height: true,
      horizontal: true,
      vertical: true,
    })
    this.loadInternalViewURLOrFile(view, getInternalViewPath(name))
    // view.setBackgroundColor('hsla(0,0,0%,100.0)')
    return view
  }

  loadInternalViewURLOrFile(view: BrowserView, urlOrFilePath: string) {
    if (CONTROL_UI_VITE_DEV_SERVER_URL) {
      view.webContents.loadURL(urlOrFilePath)
    } else {
      view.webContents.loadFile(urlOrFilePath)
    }

    if (Env.deploy.isDevelopment) {
      contextMenu({
        window: view,
        // showInspectElement: true,
        menu(_, props) {
          return [
            {
              id: 'inspect',
              label: 'Inspect Element',
              click() {
                if (!view.webContents.isDevToolsOpened()) {
                  view.webContents.openDevTools({ mode: 'detach' })
                }
                view.webContents.devToolsWebContents?.focus()
                view.webContents.inspectElement(props.x, props.y)
              },
            },
          ]
        },
      })
      // controlView.webContents.openDevTools({ mode: 'detach' })
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

  getParentToChildrenMap() {
    return Array.from(this.tabs.entries()).reduce(
      (acc, [_, tab]) => {
        const parent = tab.parent
        if (parent) {
          if (!acc[parent]) acc[parent] = []
          acc[parent].push(tab.id)
        }
        return acc
      },
      {} as Record<string, string[]>,
    )
  }

  getTabsInTree(rootId: string): string[] {
    const parentToChildrenMap = this.getParentToChildrenMap()
    const result: string[] = []

    const traverse = (id: string) => {
      result.push(id)
      const children = parentToChildrenMap[id]
      if (children) {
        children.forEach(traverse)
      }
    }

    traverse(rootId)
    return result
  }

  closeTab(rootId: string) {
    if (!this.tabs.has(rootId)) return // Exit if the tab is not found

    let tabsToClose: string[] = [rootId]
    if (this.tabCloseBehavior === 'cascade') {
      tabsToClose = this.getTabsInTree(rootId)
    }

    // Determine the new active tab
    let newActiveTab: string | null = null
    if (this.tabCloseBehavior === 'cascade') {
      // For cascade, find the nearest sibling or parent
      const parent = this.tabs.get(rootId)?.parent
      if (parent && this.tabs.has(parent)) {
        newActiveTab = parent
      } else {
        const siblings = Array.from(this.tabs.values()).filter((tab) => tab.parent === parent)
        const index = siblings.findIndex((tab) => tab.id === rootId)
        newActiveTab = siblings[index + 1]?.id || siblings[index - 1]?.id || null
      }
    } else {
      // For elevate, find the nearest sibling
      const children = Array.from(this.tabs.values()).filter((tab) => tab.parent === rootId)
      const siblings =
        children.length === 0
          ? Array.from(this.tabs.values()).filter(
              (tab) => tab.parent === this.tabs.get(rootId)?.parent,
            )
          : []
      const arrayToUse = children.length ? children : siblings
      const index = arrayToUse.findIndex((tab) => tab.id === rootId)
      newActiveTab = arrayToUse[index + 1]?.id || arrayToUse[index - 1]?.id || null
    }

    // Remove the tabs and their associated resources
    tabsToClose.forEach((tabId) => {
      const browserView = this.tabToBrowserView.get(tabId)
      if (browserView) {
        this.browserWindow.removeBrowserView(browserView)
        browserView.webContents.close()
      }
      this.tabToBrowserView.delete(tabId)
      this.tabs.delete(tabId)
      this.destroyFindInPageForTab(tabId)
    })

    this.rootTabsOrder = this.rootTabsOrder.filter((x) => !tabsToClose.includes(x))

    if (newActiveTab) {
      this.setActiveTab(newActiveTab)
      const newActiveView = this.tabToBrowserView.get(newActiveTab)
      if (newActiveView) {
        newActiveView.webContents.focus()
      }
    }

    // If the tab close behavior is 'elevate', update the parent property for the children
    if (this.tabCloseBehavior === 'elevate') {
      this.tabs.forEach((tab, tabId) => {
        if (tab.parent === rootId) {
          this.updateTabConfig(tabId, { parent: undefined })
        }
      })
    }

    // Update the UI
    this.emitUpdateTabs()
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
      this.browserWindow.setTopBrowserView(this.sidebarView)
      this.browserWindow.addBrowserView(newActiveView)
      this.browserWindow.setTopBrowserView(newActiveView)
      this.emitUpdateTabs()
    }

    if (currentActiveTab && this.tabToFindInPageView.get(currentActiveTab)) {
      this.hideFindInPageForTab(currentActiveTab)
    }

    if (this.tabToFindInPageView.get(newActiveTab.id)) {
      this.showFindInPageForTab(newActiveTab.id)
    }
  }

  emitUpdateTabs() {
    this.emitSidebarEvent(MainProcessEmittedEvents.UpdateTabs, {
      tabs: Object.fromEntries(this.tabs.entries()),
      rootTabsOrder: this.rootTabsOrder,
    })
    this.emitSidebarEvent(MainProcessEmittedEvents.UpdateActiveTab, this.activeTab)
    this.persistTabs()
  }

  persistTabs() {
    preferencesStore.set('tabs', Object.fromEntries(this.tabs.entries()))
    preferencesStore.set('active_tab', this.activeTab)
  }

  updateTabConfig(id: Tab['id'], update: Partial<Tab>, reactive = true) {
    const updated: Tab = {
      ...this.tabs.get(id)!,
      ...update,
    }
    this.tabs.set(id, updated)
    // this.upsertTabForSearch(id, updated)
    this.persistTabs()
    if (reactive) this.emitUpdateTabs()
  }

  createTab(url?: string, focus?: boolean, parentId?: string) {
    if (!url) url = 'about:blank'
    const tabId = createId()
    const tab: Tab = {
      id: tabId,
      url,
      title: url,
      parent: parentId,
      children: [],
    }
    if (parentId) {
      const parentTab = this.tabs.get(parentId)
      if (parentTab) {
        if (!parentTab?.children) {
          parentTab.children = []
        }
        parentTab.children.push(parentId)
      }
    }
    if (!parentId) this.rootTabsOrder.push(tabId)
    const view = this.createWebview(tabId, url)
    if (this.blocker) this.blocker.enableBlockingInSession(view.webContents.session)
    this.tabToBrowserView.set(tabId, view)
    this.tabToContent.set(tabId, '')
    this.tabToWebContentsId.set(tabId, view.webContents.id)
    this.tabs.set(tabId, tab)
    if (focus) {
      this.setActiveTab(tabId)
    }
    this.emitUpdateTabs()
  }

  setupTabHandlers() {
    // Tabs
    ipcMain.handle(ControlEmittedEvents.GetInitialState, () => {
      return {
        tabs: Object.fromEntries(this.tabs.entries()),
        activeTab: this.activeTab,
        rootTabsOrder: this.rootTabsOrder,
      }
    })
    ipcMain.on(ControlEmittedEvents.CloseTab, (event, tabId: string) => {
      this.closeTab(tabId)
    })
    ipcMain.handle(ControlEmittedEvents.UpdateActiveTab, (_, tabId: string) => {
      this.setActiveTab(tabId)
    })
  }

  /* -------------------------------------------------------------------------- */
  /*                                FIND IN PAGE                                */
  /* -------------------------------------------------------------------------- */
  tabToFindInPageView = new Map<string, BrowserView>()
  tabToFindInPageVisibility = new Map<string, boolean>()

  showFindInPageForTab(tabId: string) {
    const findInPageView =
      this.tabToFindInPageView.get(tabId) || this.createBrowserViewForControlInterface('find')

    this.browserWindow.addBrowserView(findInPageView)
    this.browserWindow.setTopBrowserView(findInPageView)
    findInPageView.setBounds({
      height: FIND_IN_PAGE_HEIGHT,
      width: FIND_IN_PAGE_WIDTH,
      y: 0,
      x: this.browserWindow.getBounds().width - (FIND_IN_PAGE_WIDTH + 32),
    })
    findInPageView.webContents.focus()
    this.tabToFindInPageView.set(tabId, findInPageView)
    this.tabToFindInPageVisibility.set(tabId, true)
  }

  hideFindInPageForTab(tabId: string) {
    const webview = this.tabToBrowserView.get(tabId)
    if (!webview) return
    webview.webContents.stopFindInPage('clearSelection')

    const view = this.tabToFindInPageView.get(tabId)
    if (!view) return
    this.browserWindow.removeBrowserView(view)
    this.tabToFindInPageVisibility.set(tabId, false)
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
    const webview = this.tabToBrowserView.get(tabId)
    if (!webview) return
    if (query === '') {
      this.stopFindInPage(tabId)
    } else {
      webview.webContents.findInPage(query, {
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
  /*                               NEW TAB DIALOG                               */
  /* -------------------------------------------------------------------------- */
  newTabView: BrowserView
  newTabOpen = false
  openNewTabPopup() {
    this.closeCurrentlyOpenGlobalDialog()
    this.currentlyOpenGlobalDialog = 'new_tab'
    this.newTabOpen = true
    this.browserWindow.addBrowserView(this.newTabView)
    this.browserWindow.setTopBrowserView(this.newTabView)
    this.newTabView.setBounds({ ...this.browserWindow.getBounds(), y: 0 })
    this.newTabView.webContents.send(NewTabEvents.SignalOpen, {
      tabs: [...this.tabs.entries()].map((x) => ({
        ...x[1],
        content: this.tabToContent.get(x[0]) || '',
      })),
      activeTab: this.activeTab,
    })
    this.newTabView.webContents.focus()
  }
  closeNewTabPopup() {
    this.newTabOpen = false
    this.browserWindow.removeBrowserView(this.newTabView)
    this.newTabView.webContents.send(NewTabEvents.Reset)
  }
  toggleNewTabPopup() {
    if (this.newTabOpen) {
      this.newTabView.webContents.send('nt__signal_close')
      // this.closeNewTabPopup()
    } else {
      this.openNewTabPopup()
    }
  }
  setupNewTabHandlers() {
    ipcMain.handle(NewTabEvents.CopyTabUrl, (_, tabId) => {
      const tab = this.tabs.get(tabId)
      if (tab) {
        clipboard.writeText(tab.url)
      }
    })
    ipcMain.handle(NewTabEvents.CloseTab, (_, tabId) => {
      this.closeTab(tabId)
    })
    ipcMain.handle(NewTabEvents.GetDefaultSearchEngine, () => {
      return preferencesStore.get('search_engine')
    })
    ipcMain.handle(NewTabEvents.Close, () => {
      this.closeNewTabPopup()
    })
    ipcMain.handle(
      NewTabEvents.Go,
      (_, urlOrSearchQuery: string, newTab = false, searchEngineOverride: SearchEngine) => {
        if (!this.activeTab) return
        let url
        if (searchEngineOverride) {
          url = `${engineToSearchUrl[searchEngineOverride]}${encodeURIComponent(urlOrSearchQuery)}`
        } else {
          const result = parse(urlOrSearchQuery)
          if (result.domain && result.isIcann) {
            url = urlOrSearchQuery.startsWith('http')
              ? urlOrSearchQuery
              : 'http://' + urlOrSearchQuery
          } else {
            const searchEngine = preferencesStore.get('search_engine') || SearchEngine.Google
            url = `${engineToSearchUrl[searchEngine]}${encodeURIComponent(urlOrSearchQuery)}`
          }
        }
        if (newTab) {
          this.createTab(url, true)
        } else {
          this.getActiveView()?.webContents.loadURL(url)
        }
        this.updateTabConfig(this.activeTab, { url })
      },
    )
  }

  /* -------------------------------------------------------------------------- */
  /*                                 ADDRESS BAR                                */
  /* -------------------------------------------------------------------------- */
  addressBarView: BrowserView
  addressBarOpen = false
  openAddressBar() {
    this.closeCurrentlyOpenGlobalDialog()
    this.currentlyOpenGlobalDialog = 'address_bar'
    this.addressBarOpen = true
    this.browserWindow.addBrowserView(this.addressBarView)
    this.browserWindow.setTopBrowserView(this.addressBarView)
    this.addressBarView.setBounds({ ...this.browserWindow.getBounds(), y: 0 })
    this.addressBarView.webContents.reload()
    this.addressBarView.webContents.focus()
  }
  closeAddressBar() {
    this.addressBarOpen = false
    this.browserWindow.removeBrowserView(this.addressBarView)
    this.addressBarView.webContents.reload()
  }
  toggleAddressBar() {
    if (this.addressBarOpen) {
      this.closeAddressBar()
    } else {
      this.openAddressBar()
    }
  }
  setupAddressBarHandlers() {
    ipcMain.handle(AddressBarEvents.Close, () => {
      this.closeAddressBar()
    })
    ipcMain.handle(AddressBarEvents.GetCurrentUrl, () => {
      return this.activeTab ? this.tabs.get(this.activeTab)?.url : ''
    })
    ipcMain.handle(AddressBarEvents.Go, (_, urlOrSearchQuery) => {
      this.closeAddressBar()
      if (!this.activeTab) return
      const result = parse(urlOrSearchQuery)
      let url
      if (result.domain && result.isIcann) {
        url = urlOrSearchQuery.startsWith('http') ? urlOrSearchQuery : 'http://' + urlOrSearchQuery
        this.getActiveView()?.webContents.loadURL(url)
      } else {
        const searchQuery = encodeURIComponent(urlOrSearchQuery)
        url = `${engineToSearchUrl[preferencesStore.get('search_engine')]}${searchQuery}`
        this.getActiveView()?.webContents.loadURL(url)
      }
      this.updateTabConfig(this.activeTab, { url })
    })
  }

  /* -------------------------------------------------------------------------- */
  /*                                  SETTINGS                                  */
  /* -------------------------------------------------------------------------- */
  settingsView: BrowserView
  settingsOpen = false

  get tabCloseBehavior() {
    return preferencesStore.get('tab_close_behavior')
  }

  get defaultSearchEngine() {
    return preferencesStore.get('search_engine')
  }

  toggleSettings() {
    if (!this.settingsOpen) {
      this.openSettings()
      this.settingsOpen = true
    } else {
      this.settingsOpen = false
      this.closeSettings()
    }
  }

  openSettings() {
    this.settingsOpen = true
    this.closeCurrentlyOpenGlobalDialog()
    this.currentlyOpenGlobalDialog = 'settings'
    this.browserWindow.addBrowserView(this.settingsView)
    this.browserWindow.setTopBrowserView(this.settingsView)
    this.settingsView.setBounds({
      ...this.browserWindow.getBounds(),
      y: 0,
    })
  }

  closeSettings() {
    this.settingsOpen = false
    this.browserWindow.removeBrowserView(this.settingsView)
    // this.settingsView.webContents.reload()
  }

  setupSettingsHandlers() {
    ipcMain.handle(SettingsDialogEvents.Close, () => {
      this.closeSettings()
    })
    ipcMain.handle(SettingsDialogEvents.GetAdblockValue, () => {
      return this.adblockEnabled
    })
    ipcMain.handle(SettingsDialogEvents.SetAdblockValue, (_, value) => {
      if (value) {
        this.enableAdblock()
      } else {
        this.disableAdblock()
      }
    })
    ipcMain.handle(SettingsDialogEvents.SetDefaultSearchEngine, (_, value: SearchEngine) => {
      preferencesStore.set('search_engine', value)
    })
    ipcMain.handle(SettingsDialogEvents.GetDefaultSearchEngine, () => {
      return preferencesStore.get('search_engine')
    })
    ipcMain.handle(SettingsDialogEvents.GetTabCloseBehavior, () => {
      return preferencesStore.get('tab_close_behavior')
    })
    ipcMain.handle(
      SettingsDialogEvents.SetTabCloseBehavior,
      (_, value: StoredPreferences['tab_close_behavior']) => {
        return preferencesStore.set('tab_close_behavior', value)
      },
    )
  }

  /* -------------------------------------------------------------------------- */
  /*                                   SIDEBAR                                  */
  /* -------------------------------------------------------------------------- */

  getSidebarWidth() {
    return this.browserWindow.getBounds().width * (this.getSidebarWidthOrDefault() / 100) + 1
  }

  emitSidebarEvent(channel: MainProcessEmittedEvents, ...args: any[]) {
    this.sidebarView.webContents.send(channel, ...args)
  }

  setupSidebarView() {
    const controlView = this.sidebarView
    controlView.setBackgroundColor('hsla(0, 0%, 100%, 100.0)')
    controlView.setBounds({
      ...this.browserWindow.getBounds(),
      height: this.browserWindow.getBounds().height,
      y: 0,
    })
    controlView.setAutoResize({ width: true, height: true, horizontal: true, vertical: true })
    // and load the index.html of the app.

    this.loadInternalViewURLOrFile(controlView, getInternalViewPath('sidebar'))

    this.browserWindow.addBrowserView(controlView)
    this.browserWindow.setTopBrowserView(controlView)
  }

  getSidebarWidthOrDefault() {
    return preferencesStore.get('sidebar_width') || 15
  }

  setupSidebarHandlers() {
    // Sidebar
    ipcMain.handle(ControlEmittedEvents.GetInitialSidebarWidth, () => {
      const storedWidth = preferencesStore.get('sidebar_width')
      return storedWidth || 15
    })
    ipcMain.on(ControlEmittedEvents.SidebarUpdateWidth, (_, sidebarWidth: number) => {
      preferencesStore.set('sidebar_width', sidebarWidth)
      this.getActiveView()?.setBounds(this.getWebviewBounds())
      for (const key in this.tabToBrowserView.keys()) {
        this.tabToBrowserView.get(key)?.setBounds(this.getWebviewBounds())
      }
    })
    ipcMain.handle(
      ControlEmittedEvents.ChangeTabParent,
      (
        _,
        tabId: string,
        parent: string | null,
        sibling: string | null = null,
        move: 'above' | 'below' | null = null,
      ) => {
        if (!this.tabs.get(tabId) || (parent && !this.tabs.get(parent))) return
        if (sibling && move) {
          let order = [...(!parent ? this.rootTabsOrder : this.tabs.get(parent)?.children || [])]

          const currentIndex = order.indexOf(tabId)
          if (currentIndex > -1) {
            order.splice(currentIndex, 1)
          }

          const siblingIndex = order.indexOf(sibling)
          const newIndex = move === 'above' ? siblingIndex : siblingIndex + 1

          order = [...order.slice(0, newIndex), tabId, ...order.slice(newIndex)]

          if (!parent) {
            this.rootTabsOrder = order
          } else {
            const tab = this.tabs.get(parent)
            if (tab) tab.children = order
          }
        }
        this.updateTabConfig(tabId, {
          parent: parent || undefined,
        })
      },
    )
  }

  /* -------------------------------------------------------------------------- */
  /*                               PUBSUB HANDLERS                              */
  /* -------------------------------------------------------------------------- */
  setupResizeAndMoveListeners() {
    this.browserWindow.on('resize', () => {
      const { width, height, x, y } = this.browserWindow.getBounds()
      // this.getActiveView()?.setBounds(this.getWebviewBounds())
      preferencesStore.set('windowBounds', { width, height, x, y })
    })
    this.browserWindow.on('move', () => {
      const { width, height, x, y } = this.browserWindow.getBounds()
      preferencesStore.set('windowBounds', { width, height, x, y })
    })
  }
  setupIpcHandlers() {
    this.setupSidebarHandlers()
    this.setupTabHandlers()
    this.setupFindInPageHandlers()
    this.setupAddressBarHandlers()
    this.setupSettingsHandlers()
    this.setupNewTabHandlers()
  }
}

export const normalizeNumber = (value: number | undefined): number =>
  value && isFinite(1 / value) ? Math.trunc(value) : 0

let window: AppWindow | undefined

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
  // await migrateToLatest()

  window = new AppWindow()
  if (Env.platform.isMac && Env.deploy.isDevelopment) {
    app.dock.setIcon(path.join(app.getAppPath(), 'assets/icon.png'))
    app.setName('Resurf Dev')
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  window?.destroy()
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    window = new AppWindow()
  }
})

app.on('open-url', (_, url) => {
  while (!window) {
    if (window) break
  }
  window?.createTab(url, true)
})
