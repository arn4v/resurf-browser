import { createId } from '@paralleldrive/cuid2'
import { app, BrowserView, WebContentsView, ipcMain, screen, BrowserWindow } from 'electron'
import contextMenu from 'electron-context-menu'
import Store from 'electron-store'
import path from 'path'
import { ShortcutManager } from './shortcut_manager'
import { KeyboardShortcuts } from '../shared-types/keyboard_shortcuts'
import { Tab, TabsMap } from '~/shared-types/tabs'
import { MainProcessEmittedEvents, ControlEmittedEvents } from '~/shared-types/ipc_events'

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
const preferencesStore = new Store<StoredPreferences>({})

class AppWindow {
	window: BrowserWindow
	controlView: BrowserView
	tabIdToBrowserView = new Map<string, BrowserView>()
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
						// transparent: true,
						// show: false,
						// backgroundColor: "#00000000",

						// backgroundColor: "hsla(0, 0%, 0%, 0.5)", // transparent hexadecimal or anything with transparency,
						// vibrancy: "under-window", // in my case...
						// visualEffectState: "followWindow",

						// frame: false,
						// transparent: true,
						// vibrancy: "under-window",
						// vibrancy: "sidebar",
						// backgroundColor: "#00000000", // transparent hexadecimal or anything with transparency,
						// vibrancy: "window", // in my case...
						// visualEffectState: "active",
						// titleBarOverlay: {
						//   height: 30,
						// },
					}
				: {}),
			webPreferences: {
				preload: preloadPath,
				nodeIntegration: true,
			},
		})

		this.controlView = new BrowserView({
			webPreferences: {
				preload: preloadPath,
				nodeIntegration: true,
				// contextIsolation: tru,
			},
		})
		this.setupControlView()

		this.shortcutManager = new ShortcutManager(this.window)
		this.registerShortcuts()
		this.setupSidebarEventListeners()
		this.setupResizeAndMoveListeners()
		this.setupTabEventListeners()

		this.restoreTabsOrCreateBlank()

		this.window.on('blur', () => {
			this.persistTabs()
		})
		this.window.on('close', () => {
			this.persistTabs()
		})
	}

	restoreTabsOrCreateBlank() {
		const tabs = new Map<string, Tab>(Object.entries(preferencesStore.get('tabs')))
		if (tabs.size > 0) {
			this.tabs = tabs

			const lastActiveTab = preferencesStore.get('lastActiveTab')
			if (lastActiveTab) {
				this.activeTab = lastActiveTab
				this.setActiveTab(lastActiveTab, true)
			} else {
				this.setActiveTab(tabs.get([...tabs.keys()][0])!.id, true)
			}
			this.emitUpdateTabs()
		} else {
			this.newTab('https://google.com', true)
		}
	}

	getActiveView() {
		if (!this.activeTab) return undefined
		return this.tabIdToBrowserView.get(this.activeTab)
	}

	registerShortcuts() {
		this.shortcutManager.registerShortcut(KeyboardShortcuts.NewTab, () => {
			this.newTab('https://bing.com', true)
		})
		this.shortcutManager.registerShortcut(KeyboardShortcuts.CloseTab, () => {
			if (this.activeTab) this.closeTab(this.activeTab)
		})
		this.shortcutManager.registerShortcut(KeyboardShortcuts.ReloadPage, () => {
			this.getActiveView()?.webContents.reload()
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
	}

	switchTab(direction: number) {
		if (!this.activeTab) return
		const tabsArray = Array.from(this.tabs.keys())
		const currentTabIndex = tabsArray.indexOf(this.activeTab)
		if (currentTabIndex === -1) return

		// Calculate the new active tab index, wrapping around if necessary
		let newActiveTabIndex = (currentTabIndex + direction + tabsArray.length) % tabsArray.length

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
			const browserView = this.tabIdToBrowserView.get(tabId)
			if (browserView) {
				this.window.contentView.removeChildView(browserView)
				browserView.webContents.close() // Ensure the BrowserView is properly cleaned up
			}
			this.tabIdToBrowserView.delete(tabId)
			this.tabs.delete(tabId)

			// Update the UI to reflect the new state of the tabs
			this.emitUpdateTabs()

			const newActiveView = this.tabIdToBrowserView.get(tabId)
			if (newActiveView) {
				newActiveView.webContents.focus() // This will focus the BrowserView's contents
			}
		}
	}

	setActiveTab(tabId: Tab['id'], noSanityChecks = false) {
		if (!this.tabs.get(tabId)) return
		if (!noSanityChecks && this.activeTab === tabId) return

		const activeView = this.getActiveView()

		let newActiveTab = this.tabs.get(tabId)
		let newActiveView = this.tabIdToBrowserView.get(tabId)
		if (newActiveTab && !newActiveView) {
			newActiveView = this.createWebview(newActiveTab.id, newActiveTab.url)
			this.tabIdToBrowserView.set(newActiveTab.id, newActiveView)
		}

		if (newActiveView) {
			this.activeTab = tabId
			newActiveView.setBounds(this.getWebviewBounds())
			newActiveView.webContents.focus()
			// Set controlView as top view first, so that controlView zIndex = 0, newActiveView zIndex = 1
			// This fixes the bug where previous active view is on top of controlView, causing it to show when the
			// sidebar is resized
			// this.window.contentView.addChildView(this.controlView)
			// this.window.addBrowserView(newActiveView)
			// this.window.setTopBrowserView(newActiveView)
			newActiveView.setVisible(true)
			activeView?.setVisible(false)
			this.emitUpdateTabs()
		}

		// Don't removeBrowserView, because it causes a glitchy flash when added back again
		// Keep as many browser views in memory as possible
		// if (activeView) {
		//   this.window.removeBrowserView(activeView);
		// }
	}

	emitUpdateTabs() {
		this.emitControlEvent(
			MainProcessEmittedEvents.Tabs_UpdateTabs,
			Object.fromEntries(this.tabs.entries()),
		)
		this.emitControlEvent(MainProcessEmittedEvents.TabsUpdateActiveTab, this.activeTab)
	}

	persistTabs() {
		preferencesStore.set('tabs', Object.fromEntries(this.tabs.entries()))
		preferencesStore.set('lastActiveTab', this.activeTab)
	}

	destroy() {
		this.window.destroy()
		this.shortcutManager.unregisterShortcuts()
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
		const tabView = this.createWebview(tabId, url)
		this.tabIdToBrowserView.set(tabId, tabView)
		this.tabs.set(tabId, tab)
		if (focus) {
			this.setActiveTab(tabId)
		}
		this.emitUpdateTabs()
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

		// tabView.webContents.setAutoResize({
		// 	width: true,
		// 	height: true,
		// 	horizontal: true,
		// 	vertical: true,
		// })
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

	updateTabConfig(id: Tab['id'], update: Partial<Tab>) {
		this.tabs.set(id, {
			...this.tabs.get(id)!,
			...update,
		})
		this.emitUpdateTabs()
	}

	emitControlEvent(channel: MainProcessEmittedEvents, ...args: any[]) {
		this.controlView.webContents.send(channel, ...args)
	}

	setupControlView() {
		const controlView = this.controlView
		controlView.setBackgroundColor('hsla(0, 0%, 100%, 0.0)')
		controlView.setBounds({
			...this.window.getBounds(),
			y: 0,
		})
		// controlView.setAutoResize({ width: true, height: true })
		// and load the index.html of the app.

		if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
			controlView.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
		} else {
			controlView.webContents.loadFile(
				path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
			)
		}
		if (Env.deploy.isDevelopment) {
			controlView.webContents.openDevTools()
		}
		this.window.contentView.addChildView(controlView)
		// this.window.contentView(controlView)
	}

	getWindowBounds() {
		const windowBounds = preferencesStore.get('windowBounds')
		const bounds = windowBounds ?? screen.getPrimaryDisplay().workAreaSize
		return bounds
	}

	getSidebarWidthOrDefault() {
		return preferencesStore.get('sidebarWidth') || 15
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

	setupSidebarEventListeners() {
		ipcMain.on(ControlEmittedEvents.SidebarReady, (event) => {
			const storedWidth = preferencesStore.get('sidebarWidth')
			event.reply(MainProcessEmittedEvents.SidebarSetInitialWidth, storedWidth || 15)
		})
		ipcMain.on(ControlEmittedEvents.SidebarUpdateWidth, (_, sidebarWidth: number) => {
			preferencesStore.set('sidebarWidth', sidebarWidth)
			this.getActiveView()?.setBounds(this.getWebviewBounds())
			for (const key in this.tabIdToBrowserView.keys()) {
				this.tabIdToBrowserView.get(key)?.setBounds(this.getWebviewBounds())
			}
		})
	}

	setupTabEventListeners() {
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
