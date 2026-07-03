// renderer(UI)用 preload: ストレージとアプリ操作の安全な橋渡し
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chamaeleon', {
  loadData: (key: 'profiles' | 'logs' | 'reports' | 'settings' | 'bookmarks' | 'history') =>
    ipcRenderer.invoke('storage:load', key),
  saveData: (key: 'profiles' | 'reports' | 'settings' | 'bookmarks' | 'history', value: unknown) =>
    ipcRenderer.invoke('storage:save', key, value),
  appendLog: (entry: unknown) => ipcRenderer.invoke('storage:appendLog', entry),
  appendHistory: (entry: unknown) => ipcRenderer.invoke('storage:appendHistory', entry),
  webviewPreloadPath: () => ipcRenderer.invoke('app:webviewPreloadPath'),
  setUserAgent: (ua: string) => ipcRenderer.invoke('app:setUserAgent', ua),
  listDownloads: () => ipcRenderer.invoke('downloads:list'),
  showDownloadInFolder: (savePath: string) => ipcRenderer.invoke('downloads:showInFolder', savePath),
  openDownloadFile: (savePath: string) => ipcRenderer.invoke('downloads:openFile', savePath),
  onDownloadsUpdate: (cb: (items: unknown[]) => void) => {
    ipcRenderer.on('downloads:update', (_e, items) => cb(items));
  },
});
