import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "path";
import Store from "electron-store";
import { writeFile } from "fs/promises";

const store = new Store({
  주민등록번호:
    "\\d{2}([0]\\d|[1][0-2])([0][1-9]|[1-2]\\d|[3][0-1])[-]*[1-4]\\d{6}",
  전화번호: "0\\d{2}-?\\d{3,4}-?d{4}",
});

const createWindow = () => {
  // const dirname = fileURLToPath(new URL(".", import.meta.url));
  const dirname = join(app.getAppPath(), "src");
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 960,
    frame: false, // Basic Frame Hide
    webPreferences: {
      preload: join(dirname, "preload.js"),
      additionalArguments: [
        `--content-security-policy=default-src 'self';
        script-src 'self';
        style-src 'self' 'unsafe-inline';    
        worker-src 'self' blob:;     
        img-src 'self' data: blob:;    
        font-src 'self' data:;`,
      ],
    },
  });

  mainWindow.loadFile(join(dirname, "index.html")).catch((error) => {
    console.error("Error loading main window:", error);
    app.quit();
  });
  // 디버깅 시 사용할 개발자 도구
  // mainWindow.webContents.openDevTools();
};

// 'window-control' 채널에서 메시지를 수신 대기
ipcMain.on("window-control", (event, arg) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  switch (arg) {
    case "minimize":
      win.minimize();
      break;

    case "maximize":
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      break;

    case "close":
      win.close();
      break;

    default:
      break;
  }
});

// Store 통신 ---------------------------------------------------
ipcMain.on("set-store", (event, arg) => {
  store.set(arg.key, arg.value);
});

ipcMain.on("get-store", (event, key) => {
  event.reply("get-reply", store.get(key));
});

ipcMain.on("get-all", (event) => {
  const reply = store.store;
  event.reply("store-reply", reply);
});

ipcMain.on("delete-key", (event, key) => {
  store.delete(key);
});

ipcMain.on("clear-store", () => {
  store.clear();
});

// -------------------------------------------------------------
ipcMain.handle("save-file", async (event, data, defaultPath) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: defaultPath,
    filters: [{ name: "PDF Files", extensions: ["pdf"] }],
  });

  if (filePath) {
    try {
      await writeFile(filePath, data);
      return true;
    } catch (error) {
      console.error("파일 저장 실패: ", error);
      return false;
    }
  }
  return false;
});

// 초기화가 끝나면 createWindow 호출
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// macOS가 아닐 경우(즉, Windows나 Linux인 경우)
// 모든 창이 닫혔을 때 앱을 종료한다.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
