// main process: ウィンドウ管理・JSONストレージ・IPC
import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// ---- JSONストレージ（data/ 以下に保存。仕様§12） ----

function dataDir(): string {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(path.join(dir, 'profiles'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true });
  return dir;
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf-8');
}

function registerStorageIPC(): void {
  const dir = dataDir();
  const files = {
    profiles: path.join(dir, 'profiles', 'site-profiles.json'),
    logs: path.join(dir, 'logs', 'execution-log.json'),
    reports: path.join(dir, 'reports', 'dev-reports.json'),
    settings: path.join(dir, 'settings.json'),
  } as const;

  ipcMain.handle('storage:load', (_e, key: keyof typeof files) => {
    return readJSON(files[key], key === 'settings' ? {} : []);
  });
  ipcMain.handle('storage:save', (_e, key: keyof typeof files, value: unknown) => {
    writeJSON(files[key], value);
    return true;
  });
  // 実行ログは追記型（最大5000件で切り詰め）
  ipcMain.handle('storage:appendLog', (_e, entry: unknown) => {
    const logs = readJSON<unknown[]>(files.logs, []);
    logs.unshift(entry);
    writeJSON(files.logs, logs.slice(0, 5000));
    return true;
  });
}

// ---- ウィンドウ ----

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Chamaeleon Browser',
    backgroundColor: '#101014',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // renderer 内の <webview> タグでページを表示する（タブUIを作りやすくするため）
      webviewTag: true,
    },
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  registerStorageIPC();

  // webview 内ページ用の preload（パッチ注入・レコーダー橋渡し）を配布
  ipcMain.handle('app:webviewPreloadPath', () =>
    'file://' + path.join(__dirname, '../preload/webviewPreload.js'));

  // UA変更（仕様§4.1）
  ipcMain.handle('app:setUserAgent', (_e, ua: string) => {
    session.defaultSession.setUserAgent(ua || session.defaultSession.getUserAgent());
    return true;
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
