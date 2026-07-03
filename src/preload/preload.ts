// renderer(UI)用 preload: ストレージとアプリ操作の安全な橋渡し
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chamaeleon', {
  loadData: (key: 'profiles' | 'logs' | 'reports' | 'settings' | 'bookmarks' | 'history' | 'flows') =>
    ipcRenderer.invoke('storage:load', key),
  saveData: (key: 'profiles' | 'reports' | 'settings' | 'bookmarks' | 'history' | 'flows', value: unknown) =>
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
  // 認証情報（端末内・暗号化）
  credsList: () => ipcRenderer.invoke('creds:list'),
  credsSave: (domain: string, username: string, password: string) =>
    ipcRenderer.invoke('creds:save', domain, username, password),
  credsReveal: (id: string) => ipcRenderer.invoke('creds:reveal', id),
  credsDelete: (id: string) => ipcRenderer.invoke('creds:delete', id),
  credsEncryptionAvailable: () => ipcRenderer.invoke('creds:encryptionAvailable'),
  // Chrome拡張（アンパック版）
  extList: () => ipcRenderer.invoke('ext:list'),
  extAdd: () => ipcRenderer.invoke('ext:add'),
  extRemove: (id: string, path: string) => ipcRenderer.invoke('ext:remove', id, path),
});
