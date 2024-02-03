import { app, BrowserView, BrowserWindow, ipcMain, screen } from "electron";
import Store from "electron-store";
import path from "path";

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

const preloadPath = path.join(__dirname, "preload.js");

type StoredPreferences = {
  windowBounds: ReturnType<typeof screen.getPrimaryDisplay>["bounds"];
  sidebarWidth: number;
};
const preferencesStore = new Store<StoredPreferences>({});

const createWindow = () => {
  const windowBounds = preferencesStore.get("windowBounds");
  const bounds = windowBounds ?? screen.getPrimaryDisplay().workAreaSize;

  const mainWindow = new BrowserWindow({
    ...bounds,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: preloadPath,
    },
  });

  const controlView = new BrowserView({
    webPreferences: {
      preload: preloadPath,
    },
  });
  controlView.setBounds(bounds);
  controlView.setAutoResize({ width: true });
  // and load the index.html of the app.
  console.log(MAIN_WINDOW_VITE_DEV_SERVER_URL);
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
  mainWindow.addBrowserView(controlView);

  // const frameView = new BrowserView({
  //   webPreferences: {
  //     preload: preloadPath,
  //   },
  // });
  // frameView.webContents.loadURL("https://google.com");

  ipcMain.on("sidebar-ready", (event) => {
    const storedWidth = preferencesStore.get("sidebarWidth");
    if (storedWidth) {
      event.reply("set-initial-sidebar-width", storedWidth);
    }
  });
  ipcMain.on("sidebar-width-update", (_, sidebarWidth: number) => {
    preferencesStore.set("sidebarWidth", sidebarWidth);
  });

  // Save the window bounds on resize or move
  mainWindow.on("resize", () => {
    const { width, height, x, y } = mainWindow.getBounds();
    preferencesStore.set("windowBounds", { width, height, x, y });
  });
  mainWindow.on("move", () => {
    const { width, height, x, y } = mainWindow.getBounds();
    preferencesStore.set("windowBounds", { width, height, x, y });
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
