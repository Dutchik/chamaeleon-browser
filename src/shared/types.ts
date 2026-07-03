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
