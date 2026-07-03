import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AutomationMacro, AutomationStep, ExecutionLog, RecordedEvent, SiteProfile,
} from '../shared/types';
import { matchesProfile, newId, nowISO } from '../shared/types';
import { SitePanel } from './components/SitePanel';
import { DevReports } from './components/DevReports';

interface Tab {
  id: string;
  url: string;
  title: string;
  input: string; // URLバーの編集中テキスト
}

const HOME = 'https://duckduckgo.com';

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return HOME;
  if (/^https?:\/\//.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+/.test(t)) return 'https://' + t;
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(t);
}

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: newId(), url: HOME, title: 'New Tab', input: HOME }]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [profiles, setProfiles] = useState<SiteProfile[]>([]);
  const [preloadPath, setPreloadPath] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<RecordedEvent[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const webviews = useRef(new Map<string, ElectronWebView>());

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;

  // ---- 起動時ロード ----
  useEffect(() => {
    window.chamaeleon.loadData('profiles').then(setProfiles);
    window.chamaeleon.loadData('logs').then(setLogs);
    window.chamaeleon.webviewPreloadPath().then(setPreloadPath);
  }, []);

  const saveProfiles = useCallback((next: SiteProfile[]) => {
    setProfiles(next);
    void window.chamaeleon.saveData('profiles', next);
  }, []);

  // ---- パッチ適用（仕様§10.1: URL→Profile検索→CSS→DOM→JS→Automation） ----
  const applyPatches = useCallback((tabId: string, url: string) => {
    const wv = webviews.current.get(tabId);
    if (!wv) return;
    const matched = profilesRef.current.filter((p) => matchesProfile(url, p));
    for (const profile of matched) {
      wv.send('chm:apply', {
        profileId: profile.id,
        css: profile.cssPatches.filter((c) => c.enabled),
        js: profile.jsPatches.filter((j) => j.enabled && j.runAt !== 'manual'),
        dom: profile.domRules.filter((d) => d.enabled),
      });
      // onPageLoad / onUrlMatch トリガーのマクロを自動実行（仕様§9.3）
      for (const macro of profile.automations.filter((m) => m.enabled)) {
        const t = macro.trigger;
        const shouldRun =
          t.type === 'onPageLoad' ||
          (t.type === 'onUrlMatch' && t.value && url.includes(t.value));
        if (shouldRun) wv.send('chm:playSteps', macro.steps);
        if (t.type === 'onElementAppear' && t.value) {
          wv.send('chm:playSteps', [
            { id: newId(), type: 'waitForSelector', selector: t.value, timeoutMs: 15000 },
            ...macro.steps,
          ]);
        }
      }
    }
  }, []);

  // ---- webview のイベント配線 ----
  const wireWebview = useCallback((tabId: string, el: ElectronWebView | null) => {
    if (!el || webviews.current.get(tabId) === el) return;
    webviews.current.set(tabId, el);

    const updateTab = (patch: Partial<Tab>) =>
      setTabs((ts) => ts.map((t) => (t.id === tabId ? { ...t, ...patch } : t)));

    el.addEventListener('did-navigate', (e) => {
      const url = (e as unknown as { url: string }).url;
      updateTab({ url, input: url });
      applyPatches(tabId, url);
    });
    el.addEventListener('did-navigate-in-page', (e) => {
      const url = (e as unknown as { url: string }).url;
      updateTab({ url, input: url });
    });
    el.addEventListener('page-title-updated', (e) => {
      updateTab({ title: (e as unknown as { title: string }).title });
    });
    el.addEventListener('dom-ready', () => {
      applyPatches(tabId, el.getURL());
    });
    // webview内preloadからのメッセージ
    el.addEventListener('ipc-message', (e) => {
      const ev = e as unknown as { channel: string; args: unknown[] };
      if (ev.channel === 'chm:recorded') {
        setRecorded((r) => [...r, ev.args[0] as RecordedEvent]);
      } else if (ev.channel === 'chm:urlChanged') {
        // SPA遷移（仕様§10.2）: プロファイル再評価
        const url = (ev.args[0] as { url: string }).url;
        updateTab({ url, input: url });
        applyPatches(tabId, url);
      } else if (ev.channel === 'chm:log') {
        const a = ev.args[0] as { type: 'css' | 'js' | 'dom'; id: string; status: 'success' | 'error'; message?: string; url: string };
        const entry: ExecutionLog = {
          id: newId(), profileId: '', patchId: a.id, type: a.type,
          status: a.status, message: a.message, url: a.url, createdAt: nowISO(),
        };
        setLogs((l) => [entry, ...l].slice(0, 500));
        void window.chamaeleon.appendLog(entry);
      }
    });
  }, [applyPatches]);

  // ---- タブ操作 ----
  const addTab = () => {
    const t: Tab = { id: newId(), url: HOME, title: 'New Tab', input: '' };
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  };
  const closeTab = (id: string) => {
    webviews.current.delete(id);
    setTabs((ts) => {
      const next = ts.filter((t) => t.id !== id);
      if (next.length === 0) return [{ id: newId(), url: HOME, title: 'New Tab', input: HOME }];
      return next;
    });
    if (activeId === id) setActiveId((cur) => tabs.find((t) => t.id !== id)?.id ?? cur);
  };
  const navigate = (raw: string) => {
    const url = normalizeUrl(raw);
    const wv = webviews.current.get(active.id);
    if (wv) wv.src = url;
    setTabs((ts) => ts.map((t) => (t.id === active.id ? { ...t, url, input: url } : t)));
  };

  // ---- レコーダー ----
  const toggleRecord = () => {
    const wv = webviews.current.get(active.id);
    if (!wv) return;
    if (!recording) setRecorded([]);
    wv.send('chm:record', !recording);
    setRecording(!recording);
  };

  const saveRecordingAsMacro = (profileId: string, name: string) => {
    const steps: AutomationStep[] = recorded.map((ev, i) => {
      const prev = recorded[i - 1];
      const delayMs = prev ? Math.min(ev.timestamp - prev.timestamp, 5000) : 0;
      const base = { id: newId(), delayMs, timeoutMs: 10000 };
      switch (ev.type) {
        case 'click': return { ...base, type: 'click' as const, selector: ev.selector };
        case 'input': return { ...base, type: 'input' as const, selector: ev.selector, value: ev.value };
        case 'scroll': return { ...base, type: 'scroll' as const, value: String(ev.scrollY ?? 0) };
        default: return { ...base, type: 'wait' as const, value: '300' };
      }
    });
    const macro: AutomationMacro = {
      id: newId(), name, enabled: true,
      trigger: { type: 'manual' }, steps,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    saveProfiles(profiles.map((p) => p.id === profileId
      ? { ...p, automations: [...p.automations, macro], updatedAt: nowISO() } : p));
    setRecorded([]);
  };

  const playMacro = (macro: AutomationMacro) => {
    webviews.current.get(active.id)?.send('chm:playSteps', macro.steps);
  };
  const runJsManually = (profileId: string, patchId: string) => {
    const patch = profiles.find((p) => p.id === profileId)?.jsPatches.find((j) => j.id === patchId);
    if (patch) webviews.current.get(active.id)?.send('chm:runJs', patch);
  };

  const matchedProfiles = profiles.filter((p) => matchesProfile(active.url, p));

  return (
    <div className="app">
      {/* タブバー */}
      <div className="tabbar">
        {tabs.map((t) => (
          <div key={t.id} className={'tab' + (t.id === activeId ? ' active' : '')}
               onClick={() => setActiveId(t.id)}>
            <span className="tab-title">{t.title || t.url}</span>
            <button className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}>×</button>
          </div>
        ))}
        <button className="tab-add" onClick={addTab}>＋</button>
      </div>

      {/* ナビゲーションバー */}
      <div className="navbar">
        <button onClick={() => webviews.current.get(active.id)?.goBack()}>←</button>
        <button onClick={() => webviews.current.get(active.id)?.goForward()}>→</button>
        <button onClick={() => webviews.current.get(active.id)?.reload()}>⟳</button>
        <form className="urlform" onSubmit={(e) => { e.preventDefault(); navigate(active.input); }}>
          <input className="urlbar" value={active.input} spellCheck={false}
                 onChange={(e) => setTabs((ts) => ts.map((t) => t.id === active.id ? { ...t, input: e.target.value } : t))} />
        </form>
        <button className={matchedProfiles.length ? 'badge on' : 'badge'}
                title="適用中プロファイル数" onClick={() => setPanelOpen(!panelOpen)}>
          🦎 {matchedProfiles.length}
        </button>
        <button className={recording ? 'rec on' : 'rec'} onClick={toggleRecord}
                title="操作を記録">{recording ? '■ 停止' : '● 記録'}</button>
        <button onClick={() => webviews.current.get(active.id)?.openDevTools()} title="DevTools">🛠</button>
        <button onClick={() => setReportsOpen(!reportsOpen)} title="改修メモ">📝</button>
      </div>

      {/* 本体 */}
      <div className="body">
        <div className="webarea">
          {preloadPath && tabs.map((t) => (
            // React は webview を知らないので createElement で生成
            React.createElement('webview', {
              key: t.id,
              ref: (el: ElectronWebView | null) => wireWebview(t.id, el),
              src: t.url,
              preload: preloadPath,
              allowpopups: 'true',
              style: { display: t.id === activeId ? 'flex' : 'none', flex: 1, width: '100%', height: '100%' },
            })
          ))}
        </div>
        {panelOpen && (
          <SitePanel
            url={active.url}
            profiles={profiles}
            matched={matchedProfiles}
            logs={logs}
            recording={recording}
            recordedCount={recorded.length}
            onSaveProfiles={saveProfiles}
            onSaveRecording={saveRecordingAsMacro}
            onPlayMacro={playMacro}
            onRunJs={runJsManually}
          />
        )}
      </div>

      {reportsOpen && <DevReports onClose={() => setReportsOpen(false)} />}
    </div>
  );
}
