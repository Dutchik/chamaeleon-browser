import type { DevReport, ExecutionLog, SiteProfile } from '../shared/types';

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: string;
}

export interface AppSettings {
  homepage?: string;
  userAgent?: string;
}

export interface DownloadInfo {
  id: string;
  filename: string;
  savePath: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  startedAt: string;
}

declare global {
  interface Window {
    chamaeleon: {
      loadData(key: 'profiles'): Promise<SiteProfile[]>;
      loadData(key: 'logs'): Promise<ExecutionLog[]>;
      loadData(key: 'reports'): Promise<DevReport[]>;
      loadData(key: 'settings'): Promise<AppSettings>;
      loadData(key: 'bookmarks'): Promise<Bookmark[]>;
      loadData(key: 'history'): Promise<HistoryEntry[]>;
      saveData(key: 'profiles' | 'reports' | 'settings' | 'bookmarks' | 'history', value: unknown): Promise<boolean>;
      appendLog(entry: ExecutionLog): Promise<boolean>;
      appendHistory(entry: HistoryEntry): Promise<boolean>;
      webviewPreloadPath(): Promise<string>;
      setUserAgent(ua: string): Promise<boolean>;
      listDownloads(): Promise<DownloadInfo[]>;
      showDownloadInFolder(savePath: string): Promise<boolean>;
      openDownloadFile(savePath: string): Promise<boolean>;
      onDownloadsUpdate(cb: (items: DownloadInfo[]) => void): void;
    };
  }

  // Electron <webview> タグの最小型
  interface ElectronWebView extends HTMLElement {
    src: string;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
    reload(): void;
    stop(): void;
    getURL(): string;
    getTitle(): string;
    openDevTools(): void;
    send(channel: string, ...args: unknown[]): void;
  }
}

export {};
