// renderer(UI)用 preload: ストレージとアプリ操作の安全な橋渡し
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chamaeleon', {
  loadData: (key: 'profiles' | 'logs' | 'reports' | 'settings') =>
    ipcRenderer.invoke('storage:load', key),
  saveData: (key: 'profiles' | 'reports' | 'settings', value: unknown) =>
    ipcRenderer.invoke('storage:save', key, value),
  appendLog: (entry: unknown) => ipcRenderer.invoke('storage:appendLog', entry),
  webviewPreloadPath: () => ipcRenderer.invoke('app:webviewPreloadPath'),
  setUserAgent: (ua: string) => ipcRenderer.invoke('app:setUserAgent', ua),
});
