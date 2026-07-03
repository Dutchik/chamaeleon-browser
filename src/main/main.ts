// main process: ウィンドウ管理・JSONストレージ・ダウンロード管理・IPC
import { app, BrowserWindow, ipcMain, session, shell, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const isDev = !!process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;

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

function storageFiles() {
  const dir = dataDir();
  return {
    profiles: path.join(dir, 'profiles', 'site-profiles.json'),
    logs: path.join(dir, 'logs', 'execution-log.json'),
    reports: path.join(dir, 'reports', 'dev-reports.json'),
    settings: path.join(dir, 'settings.json'),
    bookmarks: path.join(dir, 'bookmarks.json'),
    history: path.join(dir, 'history.json'),
    flows: path.join(dir, 'flows.json'),
  } as const;
}

type StorageKey = keyof ReturnType<typeof storageFiles>;

function registerStorageIPC(): void {
  const files = storageFiles();

  ipcMain.handle('storage:load', (_e, key: StorageKey) => {
    return readJSON(files[key], key === 'settings' ? {} : []);
  });
  ipcMain.handle('storage:save', (_e, key: StorageKey, value: unknown) => {
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
  // 閲覧履歴も追記型（最大5000件）
  ipcMain.handle('storage:appendHistory', (_e, entry: unknown) => {
    const items = readJSON<unknown[]>(files.history, []);
    items.unshift(entry);
    writeJSON(files.history, items.slice(0, 5000));
    return true;
  });
}

// ---- ダウンロード管理（仕様§4.1） ----

interface DownloadItemInfo {
  id: string;
  filename: string;
  savePath: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  startedAt: string;
}

const downloads: DownloadItemInfo[] = [];

function registerDownloadHandling(): void {
  session.defaultSession.on('will-download', (_event, item) => {
    const info: DownloadItemInfo = {
      id: Math.random().toString(36).slice(2, 10),
      filename: item.getFilename(),
      savePath: '',
      url: item.getURL(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      startedAt: new Date().toISOString(),
    };
    downloads.unshift(info);

    const notify = () => mainWindow?.webContents.send('downloads:update', [...downloads]);

    item.on('updated', (_e2, state) => {
      info.receivedBytes = item.getReceivedBytes();
      info.savePath = item.getSavePath();
      info.state = state === 'interrupted' ? 'interrupted' : 'progressing';
      notify();
    });
    item.once('done', (_e2, state) => {
      info.receivedBytes = item.getReceivedBytes();
      info.savePath = item.getSavePath();
      info.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted';
      notify();
    });
    notify();
  });

  ipcMain.handle('downloads:list', () => [...downloads]);
  ipcMain.handle('downloads:showInFolder', (_e, savePath: string) => {
    if (savePath) shell.showItemInFolder(savePath);
    return true;
  });
  ipcMain.handle('downloads:openFile', (_e, savePath: string) => {
    if (savePath) void shell.openPath(savePath);
    return true;
  });
}

// ---- 認証情報の暗号化保管庫（仕様§14: 端末内保存） ----

interface CredentialRecord {
  id: string;
  domain: string;
  username: string;
  encrypted: string; // base64(safeStorage.encryptString(password))
  createdAt: string;
}

function credFile(): string { return path.join(dataDir(), 'credentials.json'); }

function registerCredentialIPC(): void {
  const file = credFile();

  // 一覧（パスワード本体は返さない）
  ipcMain.handle('creds:list', () => {
    const recs = readJSON<CredentialRecord[]>(file, []);
    return recs.map((r) => ({ id: r.id, domain: r.domain, username: r.username, createdAt: r.createdAt }));
  });

  ipcMain.handle('creds:save', (_e, domain: string, username: string, password: string) => {
    const recs = readJSON<CredentialRecord[]>(file, []);
    const encrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(password).toString('base64')
      : Buffer.from(password, 'utf-8').toString('base64'); // 暗号化不可環境のフォールバック
    const id = Math.random().toString(36).slice(2, 10);
    // 同一 domain+username は上書き
    const idx = recs.findIndex((r) => r.domain === domain && r.username === username);
    const rec: CredentialRecord = { id: idx >= 0 ? recs[idx].id : id, domain, username, encrypted, createdAt: new Date().toISOString() };
    if (idx >= 0) recs[idx] = rec; else recs.unshift(rec);
    writeJSON(file, recs);
    return { id: rec.id, domain, username, createdAt: rec.createdAt };
  });

  // 復号してパスワードを返す（フロー実行時のみ呼ぶ）
  ipcMain.handle('creds:reveal', (_e, id: string) => {
    const rec = readJSON<CredentialRecord[]>(file, []).find((r) => r.id === id);
    if (!rec) return null;
    try {
      const buf = Buffer.from(rec.encrypted, 'base64');
      const pw = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buf)
        : buf.toString('utf-8');
      return { username: rec.username, password: pw };
    } catch {
      return null;
    }
  });

  ipcMain.handle('creds:delete', (_e, id: string) => {
    const recs = readJSON<CredentialRecord[]>(file, []).filter((r) => r.id !== id);
    writeJSON(file, recs);
    return true;
  });

  ipcMain.handle('creds:encryptionAvailable', () => safeStorage.isEncryptionAvailable());
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

  mainWindow = win;
  win.on('closed', () => { mainWindow = null; });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  registerStorageIPC();
  registerDownloadHandling();
  registerCredentialIPC();

  // 起動時に保存済みUAを適用
  const saved = readJSON<{ userAgent?: string }>(storageFiles().settings, {});
  const defaultUA = session.defaultSession.getUserAgent();
  if (saved.userAgent) session.defaultSession.setUserAgent(saved.userAgent);

  // webview 内ページ用の preload（パッチ注入・レコーダー橋渡し）を配布
  ipcMain.handle('app:webviewPreloadPath', () =>
    'file://' + path.join(__dirname, '../preload/webviewPreload.js'));

  // UA変更（仕様§4.1）。空文字で既定に戻す
  ipcMain.handle('app:setUserAgent', (_e, ua: string) => {
    session.defaultSession.setUserAgent(ua || defaultUA);
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
