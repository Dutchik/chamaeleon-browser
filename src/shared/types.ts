// Chamaeleon Browser 共有型定義（docs/DATA_MODEL.md と同期すること）

export type MatchType = 'exact' | 'domain' | 'path' | 'wildcard' | 'regex';
export type RunAt = 'document_start' | 'document_end' | 'idle';
export type JsRunAt = RunAt | 'manual';

export interface CssPatch {
  id: string;
  name: string;
  enabled: boolean;
  code: string;
  runAt: RunAt;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface JsPatch {
  id: string;
  name: string;
  enabled: boolean;
  code: string;
  runAt: JsRunAt;
  priority: number;
  sandbox: boolean;
  allowDomAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DomAction =
  | 'hide' | 'remove' | 'highlight' | 'replaceText'
  | 'addClass' | 'setStyle' | 'move' | 'click' | 'input';

export interface DomRule {
  id: string;
  name: string;
  enabled: boolean;
  selector: string;
  action: DomAction;
  value?: string;
  runAt: RunAt;
  waitForSelector: boolean;
  timeoutMs: number;
}

export interface AutomationTrigger {
  type: 'manual' | 'onPageLoad' | 'onUrlMatch' | 'onElementAppear' | 'schedule';
  value?: string;
}

export type StepType =
  | 'click' | 'input' | 'keydown' | 'scroll' | 'wait' | 'waitForSelector'
  | 'navigate' | 'submit' | 'select' | 'check' | 'uncheck'
  | 'extractText' | 'runJavaScript';

export interface AutomationStep {
  id: string;
  type: StepType;
  selector?: string;
  value?: string;
  delayMs?: number;
  timeoutMs?: number;
  url?: string;
}

export interface AutomationMacro {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  steps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
}

export interface SiteNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SiteProfile {
  id: string;
  name: string;
  enabled: boolean;
  matchType: MatchType;
  matchPattern: string;
  description?: string;
  cssPatches: CssPatch[];
  jsPatches: JsPatch[];
  domRules: DomRule[];
  automations: AutomationMacro[];
  notes: SiteNote[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLog {
  id: string;
  profileId: string;
  patchId?: string;
  automationId?: string;
  type: 'css' | 'js' | 'dom' | 'automation';
  status: 'success' | 'error' | 'skipped';
  message?: string;
  url: string;
  createdAt: string;
}

export interface DevReport {
  id: string;
  title: string;
  body: string;
  status: 'todo' | 'doing' | 'done' | 'hold';
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  relatedFile?: string;
  screenshotPath?: string;
  createdAt: string;
  updatedAt: string;
}

/// 記録された1操作（レコーダーがwebviewから受け取る生イベント）
export interface RecordedEvent {
  type: 'click' | 'input' | 'keydown' | 'scroll' | 'navigate' | 'submit';
  selector?: string;
  fallbackSelectors?: string[];
  textHint?: string;
  value?: string;
  url?: string;
  key?: string;
  scrollX?: number;
  scrollY?: number;
  timestamp: number;
}

// ---- URLマッチ判定（main/renderer/preload すべてで共用）----

export function matchesProfile(url: string, profile: SiteProfile): boolean {
  if (!profile.enabled) return false;
  const p = profile.matchPattern.trim();
  if (!p) return false;
  try {
    switch (profile.matchType) {
      case 'exact':
        return url === p;
      case 'domain': {
        const host = new URL(url).hostname;
        return host === p || host.endsWith('.' + p);
      }
      case 'path':
      case 'wildcard':
        return wildcardToRegex(p).test(url);
      case 'regex':
        return new RegExp(p).test(url);
    }
  } catch {
    return false;
  }
  return false;
}

export function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function nowISO(): string {
  return new Date().toISOString();
}

// ============================================================
// 自動化フロー / 検索エンジン / 認証情報（v0.2 追加）
// ============================================================

/// 検索エンジン。%s が検索語に置換される。
export interface SearchEngine {
  id: string;
  name: string;
  searchUrl: string; // 例: https://www.google.com/search?q=%s
  homeUrl: string;
}

export const DEFAULT_ENGINES: SearchEngine[] = [
  { id: 'google', name: 'Google', searchUrl: 'https://www.google.com/search?q=%s', homeUrl: 'https://www.google.com' },
  { id: 'bing', name: 'Bing', searchUrl: 'https://www.bing.com/search?q=%s', homeUrl: 'https://www.bing.com' },
  { id: 'duckduckgo', name: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q=%s', homeUrl: 'https://duckduckgo.com' },
  { id: 'brave', name: 'Brave Search', searchUrl: 'https://search.brave.com/search?q=%s', homeUrl: 'https://search.brave.com' },
  { id: 'yahoo-jp', name: 'Yahoo! JAPAN', searchUrl: 'https://search.yahoo.co.jp/search?p=%s', homeUrl: 'https://www.yahoo.co.jp' },
];

/// フロー内の1アクション。設定された順番に実行される（仕様§9.4を拡張）。
export type FlowActionType =
  | 'navigate'        // 指定URLへ移動
  | 'click'           // クリック
  | 'input'           // テキスト入力
  | 'check'           // チェックボックスをオン
  | 'uncheck'         // チェックボックスをオフ
  | 'select'          // セレクトボックスの値を選択
  | 'submit'          // フォーム送信
  | 'wait'            // 指定ミリ秒待機
  | 'waitForSelector' // 要素の出現を待つ
  | 'runJavaScript'   // 任意JS実行
  | 'fillUsername'    // 保存済みユーザー名を入力
  | 'fillPassword';   // 保存済みパスワードを入力

export interface FlowStep {
  id: string;
  type: FlowActionType;
  selector?: string;
  value?: string;
  url?: string;
  delayMs?: number;
  timeoutMs?: number;
  description?: string;
}

/// 保存する自動化フロー。該当ページ訪問時にヘッダーの▶から起動できる。
export interface Flow {
  id: string;
  name: string;
  enabled: boolean;
  matchType: MatchType;
  matchPattern: string;
  startUrl: string;        // フロー開始時に最初に開くURL
  useCredentials: boolean;
  credentialId?: string;   // fillUsername/fillPassword で使う認証情報
  steps: FlowStep[];
  createdAt: string;
  updatedAt: string;
}

/// 認証情報のメタデータ（パスワード本体は main の safeStorage で暗号化保存）
export interface CredentialMeta {
  id: string;
  domain: string;
  username: string;
  createdAt: string;
}

export function matchesFlow(url: string, flow: Flow): boolean {
  if (!flow.enabled) return false;
  const pseudo: SiteProfile = {
    id: flow.id, name: flow.name, enabled: true,
    matchType: flow.matchType, matchPattern: flow.matchPattern,
    cssPatches: [], jsPatches: [], domRules: [], automations: [], notes: [],
    createdAt: flow.createdAt, updatedAt: flow.updatedAt,
  };
  return matchesProfile(url, pseudo);
}

export const FLOW_ACTION_LABELS: Record<FlowActionType, string> = {
  navigate: 'ページ移動',
  click: 'クリック',
  input: 'テキスト入力',
  check: 'チェックを入れる',
  uncheck: 'チェックを外す',
  select: '選択（プルダウン）',
  submit: 'フォーム送信',
  wait: '待機（ミリ秒）',
  waitForSelector: '要素の出現を待つ',
  runJavaScript: 'JavaScript実行',
  fillUsername: 'ユーザー名を入力',
  fillPassword: 'パスワードを入力',
};
