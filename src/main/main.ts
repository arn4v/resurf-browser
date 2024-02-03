import { createId } from "@paralleldrive/cuid2";
import { app, BrowserView, BrowserWindow, ipcMain, screen } from "electron";
import contextMenu from "electron-context-menu";
import Store from "electron-store";
import path from "path";
import { ShortcutManager } from "./shortcut_manager";
import { KeyboardShortcuts } from "../shared-types/keyboard_shortcuts";
import { Tab } from "~/shared-types/tabs";
import {
  MainProcessEmittedEvents,
  RendererEmittedEvents,
} from "~/shared-types/ipc_events";

export type Brand<Name extends string, T> = T & { __brand: Name };

export const Env = {
  platform: {
    isWin: process.platform === "win32",
    isMac: process.platform === "darwin",
    isLinux: process.platform === "linux",
  },
  app: {
    version: app.getVersion(),
  },
  deploy: {
    isDevelopment: process.env.NODE_ENV !== "production",
    isProduction: process.env.NODE_ENV === "production",
  },
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const preloadPath = path.resolve(__dirname, "./preload.js");

type StoredPreferences = {
  windowBounds: ReturnType<typeof screen.getPrimaryDisplay>["bounds"];
  sidebarWidth: number;
};
const preferencesStore = new Store<StoredPreferences>({});

class AppWindow {
  window: BrowserWindow;
  controlView: BrowserView;
  tabIdToBrowserView = new Map<string, BrowserView>();
  tabs = new Map<string, Tab>();
  activeTab: string | null = null;
  shortcutManager: ShortcutManager;

  constructor() {
    this.window = new BrowserWindow({
      ...this.getWindowBounds(),
      y: 0,
      ...(Env.platform.isMac
        ? {
            titleBarStyle: "hiddenInset",
            trafficLightPosition: { x: 16, y: 8 },
            titleBarOverlay: {
              height: 30,
            },
          }
        : {}),
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: true,
      },
    });
    this.controlView = new BrowserView({
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: true,
        // contextIsolation: tru,
      },
    });
    this.setupControlView();
    this.newTab("https://google.com", true);
    this.setupResizeAndMoveListeners(this);
    this.setupSidebarIPCListeners(this);

    this.shortcutManager = new ShortcutManager(this.window);
    this.registerShortcuts();
  }

  getActiveView() {
    if (!this.activeTab) return undefined;
    return this.tabIdToBrowserView.get(this.activeTab);
  }

  registerShortcuts() {
    this.shortcutManager.registerShortcut(KeyboardShortcuts.NewTab, () => {
      this.newTab("https://bing.com", true);
    });

    this.shortcutManager.registerShortcut(KeyboardShortcuts.NewTab, () => {
      this.newTab("https://bing.com", true);
    });
  }

  destroy() {
    this.window.destroy();
    this.tabIdToBrowserView.clear();
    this.shortcutManager.unregisterShortcuts();
  }

  newTab(url?: string, focus?: boolean): string {
    if (!url) url = "about:blank";
    const tabId = createId();
    const tab = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        devTools: true,
        contextIsolation: true,
        sandbox: true,
        scrollBounce: true,
        safeDialogs: true,
        autoplayPolicy: "user-gesture-required",
      },
    });
    tab.setAutoResize({
      width: true,
      height: true,
      horizontal: true,
      vertical: true,
    });
    tab.setBounds(this.getStageBounds());
    tab.webContents.loadURL(url ?? "about:blank");

    contextMenu({
      window: tab,
      showSelectAll: true,
      showCopyImage: true,
      showCopyImageAddress: true,
      showSaveImage: true,
      showSaveLinkAs: true,
      showInspectElement: true,
    });

    this.tabIdToBrowserView.set(tabId, tab);
    this.tabs.set(tabId, {
      id: tabId,
      url,
      title: url,
    });
    if (focus) {
      this.activeTab = tabId;
      this.window.addBrowserView(tab);
      this.window.setTopBrowserView(tab);
    }

    tab.webContents.on("page-favicon-updated", (_, favicons) => {
      this.updateTabConfig(tabId, {
        favicon: favicons[0],
      });
    });

    return tabId;
  }

  updateTabConfig(id: Tab["id"], update: Partial<Tab>) {
    this.tabs.set(id, {
      ...this.tabs.get(id)!,
      ...update,
    });
    this.emitControlEvent(
      MainProcessEmittedEvents.TabsUpdateTabConfig,
      this.tabs.get(id)!
    );
  }

  emitControlEvent(channel: MainProcessEmittedEvents, ...args: any[]) {
    this.controlView.webContents.emit(channel, ...args);
  }

  setupControlView() {
    const controlView = this.controlView;
    controlView.setBounds({
      ...this.window.getBounds(),
      y: 0,
    });
    controlView.setAutoResize({ width: true, height: true });
    // and load the index.html of the app.
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      controlView.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      controlView.webContents.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }
    if (Env.deploy.isDevelopment) {
      controlView.webContents.openDevTools();
    }
    this.window.addBrowserView(controlView);
    this.window.setTopBrowserView(controlView);
  }

  getWindowBounds() {
    const windowBounds = preferencesStore.get("windowBounds");
    const bounds = windowBounds ?? screen.getPrimaryDisplay().workAreaSize;
    return bounds;
  }

  getSidebarWidthOrDefault() {
    return preferencesStore.get("sidebarWidth") || 15;
  }

  getStageBounds() {
    const winBounds = this.window.getBounds();
    return {
      width: normalizeNumber(
        winBounds.width -
          winBounds.width * (this.getSidebarWidthOrDefault() / 100)
      ),
      height: winBounds.height,
      x: normalizeNumber(
        winBounds.width * (this.getSidebarWidthOrDefault() / 100)
      ),
      y: 0,
    };
  }

  setupSidebarIPCListeners(app: AppWindow) {
    ipcMain.on(RendererEmittedEvents.SidebarReady, (event) => {
      const storedWidth = preferencesStore.get("sidebarWidth");
      this.emitControlEvent(
        MainProcessEmittedEvents.SidebarSetInitialWidth,
        storedWidth || 15
      );
    });
    ipcMain.once(RendererEmittedEvents.TabsReady, () => {
      this.emitControlEvent(
        MainProcessEmittedEvents.TabsSetInitialTabs,
        Object.fromEntries(this.tabs.entries())
      );
      console.log(this.tabs.entries());
    });
    ipcMain.on(
      RendererEmittedEvents.SidebarUpdateWidth,
      (_, sidebarWidth: number) => {
        preferencesStore.set("sidebarWidth", sidebarWidth);
        app.getActiveView()?.setBounds(app.getStageBounds());
      }
    );
  }

  setupResizeAndMoveListeners(app: AppWindow) {
    app.window.on("resize", () => {
      const { width, height, x, y } = app.window.getBounds();
      app.getActiveView()?.setBounds(app.getStageBounds());
      preferencesStore.set("windowBounds", { width, height, x, y });
    });
    app.window.on("move", () => {
      const { width, height, x, y } = app.window.getBounds();
      preferencesStore.set("windowBounds", { width, height, x, y });
    });
  }
}

export const normalizeNumber = (value: number | undefined): number =>
  value && isFinite(1 / value) ? Math.trunc(value) : 0;

let window: AppWindow;
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  window = new AppWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    window?.destroy();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    window = new AppWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
