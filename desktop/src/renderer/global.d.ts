import type { DevReport, ExecutionLog, SiteProfile } from '../shared/types';

declare global {
  interface Window {
    chamaeleon: {
      loadData(key: 'profiles'): Promise<SiteProfile[]>;
      loadData(key: 'logs'): Promise<ExecutionLog[]>;
      loadData(key: 'reports'): Promise<DevReport[]>;
      loadData(key: 'settings'): Promise<Record<string, unknown>>;
      saveData(key: 'profiles' | 'reports' | 'settings', value: unknown): Promise<boolean>;
      appendLog(entry: ExecutionLog): Promise<boolean>;
      webviewPreloadPath(): Promise<string>;
      setUserAgent(ua: string): Promise<boolean>;
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
