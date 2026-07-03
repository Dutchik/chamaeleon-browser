import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AutomationMacro, AutomationStep, CredentialMeta, ExecutionLog, Flow, RecordedEvent, SiteProfile,
} from '../shared/types';
import { DEFAULT_ENGINES, matchesFlow, matchesProfile, newId, nowISO } from '../shared/types';
import { SitePanel } from './components/SitePanel';
import { DevReports } from './components/DevReports';
import { Library } from './components/Library';
import { StartPage } from './components/StartPage';
import { Drawer } from './components/Drawer';
import { FlowWizard } from './components/FlowWizard';
import { Credentials } from './components/Credentials';
import { StyleEditor } from './components/StyleEditor';
import type { InspectedElement } from './components/StyleEditor';
import type { AppSettings, Bookmark } from './global';

interface Tab {
  id: string;
  url: string;       // 'chamaeleon://start' = スタート画面
  title: string;
  input: string;
  loading: boolean;
}

const START = 'chamaeleon://start';

function normalizeUrl(raw: string, engineSearchUrl: string): string {
  const t = raw.trim();
  if (!t) return START;
  if (/^https?:\/\//.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+/.test(t)) return 'https://' + t;
  return engineSearchUrl.replace('%s', encodeURIComponent(t));
}

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: newId(), url: START, title: 'ホーム', input: '', loading: false }]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [profiles, setProfiles] = useState<SiteProfile[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [credentials, setCredentials] = useState<CredentialMeta[]>([]);
  const [preloadPath, setPreloadPath] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [wizardFor, setWizardFor] = useState<Flow | null | 'new'>(null); // null=閉 / 'new'=新規 / Flow=編集
  const [pickTarget, setPickTarget] = useState<{ forStepId: string; selector: string } | null>(null);
  const [inspected, setInspected] = useState<InspectedElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<RecordedEvent[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [flowStatus, setFlowStatus] = useState<string | null>(null);

  const webviews = useRef(new Map<string, ElectronWebView>());
  const pickingStepId = useRef<string | null>(null);
  const stepResolve = useRef<((r: { status: string; message?: string }) => void) | null>(null);
  const domReadyResolve = useRef<(() => void) | null>(null);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;

  const engine = DEFAULT_ENGINES.find((e) => e.id === settings.engineId) ?? DEFAULT_ENGINES[0];

  useEffect(() => {
    window.chamaeleon.loadData('profiles').then(setProfiles);
    window.chamaeleon.loadData('flows').then(setFlows);
    window.chamaeleon.loadData('logs').then(setLogs);
    window.chamaeleon.loadData('bookmarks').then(setBookmarks);
    window.chamaeleon.loadData('settings').then(setSettings);
    window.chamaeleon.credsList().then(setCredentials);
    window.chamaeleon.webviewPreloadPath().then(setPreloadPath);
  }, []);

  const saveProfiles = useCallback((next: SiteProfile[]) => {
    setProfiles(next);
    void window.chamaeleon.saveData('profiles', next);
  }, []);
  const saveFlows = useCallback((next: Flow[]) => {
    setFlows(next);
    void window.chamaeleon.saveData('flows', next);
  }, []);
  const saveSettings = (next: AppSettings) => {
    setSettings(next);
    void window.chamaeleon.saveData('settings', next);
  };

  // ---- パッチ適用（仕様§10.1） ----
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
      for (const macro of profile.automations.filter((m) => m.enabled)) {
        const t = macro.trigger;
        if (t.type === 'onPageLoad' || (t.type === 'onUrlMatch' && t.value && url.includes(t.value))) {
          wv.send('chm:playSteps', macro.steps);
        }
        if (t.type === 'onElementAppear' && t.value) {
          wv.send('chm:playSteps', [{ id: newId(), type: 'waitForSelector', selector: t.value, timeoutMs: 15000 }, ...macro.steps]);
        }
      }
    }
  }, []);

  // ---- webview 配線 ----
  const wireWebview = useCallback((tabId: string, el: ElectronWebView | null) => {
    if (!el || webviews.current.get(tabId) === el) return;
    webviews.current.set(tabId, el);
    const updateTab = (patch: Partial<Tab>) => setTabs((ts) => ts.map((t) => (t.id === tabId ? { ...t, ...patch } : t)));

    el.addEventListener('did-start-loading', () => updateTab({ loading: true }));
    el.addEventListener('did-stop-loading', () => updateTab({ loading: false }));
    el.addEventListener('did-navigate', (e) => {
      const url = (e as unknown as { url: string }).url;
      updateTab({ url, input: url });
      applyPatches(tabId, url);
      if (url.startsWith('http')) {
        void window.chamaeleon.appendHistory({ id: newId(), title: el.getTitle(), url, visitedAt: nowISO() });
      }
    });
    el.addEventListener('did-navigate-in-page', (e) => updateTab({ url: (e as unknown as { url: string }).url, input: (e as unknown as { url: string }).url }));
    el.addEventListener('page-title-updated', (e) => updateTab({ title: (e as unknown as { title: string }).title }));
    el.addEventListener('dom-ready', () => {
      applyPatches(tabId, el.getURL());
      if (tabId === activeIdRef.current && domReadyResolve.current) {
        const r = domReadyResolve.current; domReadyResolve.current = null;
        setTimeout(r, 350); // レンダリング安定待ち
      }
    });
    el.addEventListener('ipc-message', (e) => {
      const ev = e as unknown as { channel: string; args: unknown[] };
      if (ev.channel === 'chm:recorded') {
        setRecorded((r) => [...r, ev.args[0] as RecordedEvent]);
      } else if (ev.channel === 'chm:urlChanged') {
        const url = (ev.args[0] as { url: string }).url;
        updateTab({ url, input: url });
        applyPatches(tabId, url);
      } else if (ev.channel === 'chm:log') {
        const a = ev.args[0] as { type: 'css' | 'js' | 'dom'; id: string; status: 'success' | 'error'; message?: string; url: string };
        const entry: ExecutionLog = { id: newId(), profileId: '', patchId: a.id, type: a.type, status: a.status, message: a.message, url: a.url, createdAt: nowISO() };
        setLogs((l) => [entry, ...l].slice(0, 500));
        void window.chamaeleon.appendLog(entry);
      } else if (ev.channel === 'chm:stepResult') {
        if (stepResolve.current) { const r = stepResolve.current; stepResolve.current = null; r(ev.args[0] as { status: string; message?: string }); }
      } else if (ev.channel === 'chm:picked') {
        const sel = (ev.args[0] as { selector: string }).selector;
        if (pickingStepId.current) { setPickTarget({ forStepId: pickingStepId.current, selector: sel }); pickingStepId.current = null; }
      } else if (ev.channel === 'chm:inspected') {
        setInspected(ev.args[0] as InspectedElement);
      }
    });
  }, [applyPatches]);

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // ---- タブ・ナビゲーション ----
  const addTab = () => {
    const t: Tab = { id: newId(), url: START, title: 'ホーム', input: '', loading: false };
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  };
  const goHome = () => setTabs((ts) => ts.map((t) => (t.id === active.id ? { ...t, url: START, input: '' } : t)));
  const closeTab = (id: string) => {
    webviews.current.delete(id);
    setTabs((ts) => {
      const next = ts.filter((t) => t.id !== id);
      return next.length === 0 ? [{ id: newId(), url: START, title: 'ホーム', input: '', loading: false }] : next;
    });
    if (activeId === id) setActiveId((cur) => tabs.find((t) => t.id !== id)?.id ?? cur);
  };
  const navigate = (raw: string) => {
    const url = normalizeUrl(raw, engine.searchUrl);
    setTabs((ts) => ts.map((t) => (t.id === active.id ? { ...t, url, input: url === START ? '' : url } : t)));
    const wv = webviews.current.get(active.id);
    if (wv && url !== START) wv.src = url;
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
    const macro: AutomationMacro = { id: newId(), name, enabled: true, trigger: { type: 'manual' }, steps, createdAt: nowISO(), updatedAt: nowISO() };
    saveProfiles(profiles.map((p) => (p.id === profileId ? { ...p, automations: [...p.automations, macro], updatedAt: nowISO() } : p)));
    setRecorded([]);
  };
  const playMacro = (macro: AutomationMacro) => webviews.current.get(active.id)?.send('chm:playSteps', macro.steps);
  const runJsManually = (profileId: string, patchId: string) => {
    const patch = profiles.find((p) => p.id === profileId)?.jsPatches.find((j) => j.id === patchId);
    if (patch) webviews.current.get(active.id)?.send('chm:runJs', patch);
  };

  // ---- 要素ピッカー ----
  const requestPick = (stepId: string) => {
    const wv = webviews.current.get(active.id);
    if (!wv || active.url === START) { setFlowStatus('ページを開いてから要素を選んでください'); return; }
    pickingStepId.current = stepId;
    wv.send('chm:pick');
    setFlowStatus('ページ上で要素をクリックしてください（Escで中止）');
    setTimeout(() => setFlowStatus(null), 4000);
  };

  // ---- フロー実行（renderer駆動・ページ遷移をまたいで継続） ----
  const runFlow = async (flow: Flow) => {
    setFlowStatus(`▶ ${flow.name} を実行中…`);
    let cred: { username: string; password: string } | null = null;
    if (flow.useCredentials && flow.credentialId) cred = await window.chamaeleon.credsReveal(flow.credentialId);

    const waitDomReady = () => new Promise<void>((resolve) => { domReadyResolve.current = resolve; });
    const runOne = (step: Record<string, unknown>) => new Promise<{ status: string; message?: string }>((resolve) => {
      stepResolve.current = resolve;
      webviews.current.get(active.id)?.send('chm:runStep', step);
    });

    // 開始URLを開く
    if (flow.startUrl && flow.startUrl !== active.url) {
      const p = waitDomReady();
      navigate(flow.startUrl);
      await Promise.race([p, new Promise<void>((r) => setTimeout(r, 12000))]);
    }

    for (const step of flow.steps) {
      if (step.type === 'navigate' && step.url) {
        const p = waitDomReady();
        navigate(step.url);
        await Promise.race([p, new Promise<void>((r) => setTimeout(r, 12000))]);
        continue;
      }
      let toSend: Record<string, unknown> = { ...step };
      if (step.type === 'fillUsername') toSend = { ...step, type: 'input', value: cred?.username ?? '' };
      if (step.type === 'fillPassword') toSend = { ...step, type: 'input', value: cred?.password ?? '' };
      const res = await Promise.race([
        runOne(toSend),
        new Promise<{ status: string; message?: string }>((r) => setTimeout(() => r({ status: 'error', message: 'timeout' }), (step.timeoutMs ?? 12000) + 3000)),
      ]);
      if (res.status === 'error') {
        setFlowStatus(`⚠ 停止: 「${step.type}」で失敗 (${res.message ?? ''})`);
        setTimeout(() => setFlowStatus(null), 6000);
        return;
      }
    }
    setFlowStatus(`✓ ${flow.name} が完了しました`);
    setTimeout(() => setFlowStatus(null), 4000);
  };

  // ---- スタイルインスペクタ ----
  const startInspect = () => {
    const wv = webviews.current.get(active.id);
    if (!wv || active.url === START) { setFlowStatus('ページを開いてから要素を選んでください'); setTimeout(() => setFlowStatus(null), 3000); return; }
    setInspected(null);
    wv.send('chm:inspect');
    setFlowStatus('編集したい要素をクリックしてください（Escで中止）');
    setTimeout(() => setFlowStatus(null), 4000);
  };
  const previewCss = (cssText: string) => webviews.current.get(active.id)?.send('chm:previewCss', cssText);
  const registerCss = (selector: string, cssText: string) => {
    // 現在ドメインのProfileを探すか新規作成し、CSS Patchとして追加
    let domain = '';
    try { domain = new URL(active.url).hostname; } catch { /* noop */ }
    const patch = {
      id: newId(), name: `${selector} スタイル`, enabled: true, code: cssText,
      runAt: 'document_end' as const, priority: 0, createdAt: nowISO(), updatedAt: nowISO(),
    };
    const existing = profiles.find((pr) => matchesProfile(active.url, pr))
      ?? profiles.find((pr) => pr.matchType === 'domain' && pr.matchPattern === domain);
    let next: SiteProfile[];
    if (existing) {
      next = profiles.map((pr) => (pr.id === existing.id ? { ...pr, cssPatches: [...pr.cssPatches, patch], updatedAt: nowISO() } : pr));
    } else {
      next = [...profiles, {
        id: newId(), name: domain || 'New Profile', enabled: true, matchType: 'domain' as const, matchPattern: domain,
        cssPatches: [patch], jsPatches: [], domRules: [], automations: [], notes: [], createdAt: nowISO(), updatedAt: nowISO(),
      }];
    }
    saveProfiles(next);
    setInspected(null);
    // プレビューはそのまま残す（保存済みパッチとして次回以降も適用される）
    setFlowStatus(`CSSを登録しました（${domain}）`);
    setTimeout(() => setFlowStatus(null), 3000);
  };

  const matchedProfiles = profiles.filter((p) => matchesProfile(active.url, p));
  const matchedFlows = flows.filter((f) => active.url !== START && matchesFlow(active.url, f));
  const isBookmarked = bookmarks.some((b) => b.url === active.url);
  const toggleBookmark = () => {
    const next = isBookmarked
      ? bookmarks.filter((b) => b.url !== active.url)
      : [{ id: newId(), title: active.title || active.url, url: active.url, createdAt: nowISO() }, ...bookmarks];
    setBookmarks(next);
    void window.chamaeleon.saveData('bookmarks', next);
  };

  const wizardFlow: Flow | null = wizardFor === 'new' ? null : (wizardFor as Flow | null);

  return (
    <div className="app">
      {/* タブバー */}
      <div className="tabbar">
        {tabs.map((t) => (
          <div key={t.id} className={'tab' + (t.id === activeId ? ' active' : '')} onClick={() => setActiveId(t.id)}>
            <span className="tab-title">{t.title || t.url}</span>
            <button className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}>×</button>
          </div>
        ))}
        <button className="tab-add" onClick={addTab}>＋</button>
      </div>

      {/* ナビゲーションバー（左端にハンバーガー） */}
      <div className="navbar">
        <button className="hamburger" title="メニュー" onClick={() => setDrawerOpen(true)}>☰</button>
        <button onClick={() => webviews.current.get(active.id)?.goBack()}>←</button>
        <button onClick={() => webviews.current.get(active.id)?.goForward()}>→</button>
        {active.loading
          ? <button title="停止" onClick={() => webviews.current.get(active.id)?.stop()}>✕</button>
          : <button title="再読み込み" onClick={() => { active.url === START ? goHome() : webviews.current.get(active.id)?.reload(); }}>⟳</button>}
        <form className="urlform" onSubmit={(e) => { e.preventDefault(); navigate(active.input); }}>
          <input className="urlbar" value={active.input} spellCheck={false} placeholder={`${engine.name} で検索、またはURL`}
                 onChange={(e) => setTabs((ts) => ts.map((t) => (t.id === active.id ? { ...t, input: e.target.value } : t)))} />
        </form>

        {/* マッチしたフローのスタートボタン（ヘッダー） */}
        {matchedFlows.map((f) => (
          <button key={f.id} className="flow-run" title={`フロー「${f.name}」を実行`} onClick={() => runFlow(f)}>
            ▶ {f.name}
          </button>
        ))}

        <button className={isBookmarked ? 'badge on' : 'badge'} title="ブックマーク" onClick={toggleBookmark}>{isBookmarked ? '★' : '☆'}</button>
        <button title="要素のCSSを編集（DevToolsライク）" onClick={startInspect}>🎨</button>
        <button className={matchedProfiles.length ? 'badge on' : 'badge'} title="サイトパネル" onClick={() => setPanelOpen(!panelOpen)}>🦎 {matchedProfiles.length}</button>
        <button className={recording ? 'rec on' : 'rec'} onClick={toggleRecord} title="操作を記録">{recording ? '■' : '●'}</button>
      </div>

      {/* 本体 */}
      <div className="body">
        <div className="webarea">
          {active.url === START ? (
            <StartPage engineId={engine.id}
                       onEngineChange={(id) => saveSettings({ ...settings, engineId: id })}
                       onSearch={navigate}
                       bookmarks={bookmarks} />
          ) : null}
          {preloadPath && tabs.filter((t) => t.url !== START).map((t) => (
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
          <SitePanel url={active.url} profiles={profiles} matched={matchedProfiles} logs={logs}
                     recording={recording} recordedCount={recorded.length}
                     onSaveProfiles={saveProfiles} onSaveRecording={saveRecordingAsMacro}
                     onPlayMacro={playMacro} onRunJs={runJsManually} />
        )}

        {inspected && (
          <StyleEditor target={inspected}
                       onPreview={previewCss}
                       onReinspect={startInspect}
                       onRegister={registerCss}
                       onClose={() => { setInspected(null); webviews.current.get(active.id)?.send('chm:clearPreview'); }} />
        )}
        {wizardFor !== null && (
          <FlowWizard currentUrl={active.url === START ? '' : active.url}
                      editing={wizardFlow}
                      credentials={credentials}
                      pickTarget={pickTarget}
                      onRequestPick={requestPick}
                      onAddCredential={() => setCredsOpen(true)}
                      onSave={(flow) => {
                        const exists = flows.some((f) => f.id === flow.id);
                        saveFlows(exists ? flows.map((f) => (f.id === flow.id ? flow : f)) : [...flows, flow]);
                        setWizardFor(null); setPickTarget(null);
                        setFlowStatus(`フロー「${flow.name}」を保存しました`);
                        setTimeout(() => setFlowStatus(null), 3000);
                      }}
                      onClose={() => { setWizardFor(null); setPickTarget(null); }} />
        )}
      </div>

      {/* フロー実行ステータス（下部トースト） */}
      {flowStatus && <div className="flow-toast">{flowStatus}</div>}

      {/* 左ドロワー（検索画面の上にオーバーレイ） */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} groups={[
        { title: 'ナビゲーション', items: [
          { icon: '🏠', label: 'ホーム（エンジン選択）', onClick: goHome },
          { icon: '＋', label: '新しいタブ', onClick: addTab },
        ] },
        { title: '自動化', items: [
          { icon: '✨', label: 'フローを作成', onClick: () => setWizardFor('new') },
          ...flows.map((f) => ({ icon: '▶', label: f.name, onClick: () => setWizardFor(f) })),
          { icon: '🔐', label: '認証情報', onClick: () => setCredsOpen(true) },
        ] },
        { title: 'カスタマイズ', items: [
          { icon: '🦎', label: 'サイトパネル', onClick: () => setPanelOpen(true), active: panelOpen },
          { icon: '🎨', label: '要素のCSSを編集', onClick: startInspect },
          { icon: recording ? '■' : '●', label: recording ? '記録を停止' : '操作を記録', onClick: toggleRecord },
          { icon: '🛠', label: 'DevTools', onClick: () => webviews.current.get(active.id)?.openDevTools() },
          { icon: '📝', label: '改修メモ', onClick: () => setReportsOpen(true) },
        ] },
        { title: 'ライブラリ', items: [
          { icon: '📚', label: 'ブックマーク・履歴・DL・設定', onClick: () => setLibraryOpen(true) },
        ] },
      ]} />

      {reportsOpen && <DevReports onClose={() => setReportsOpen(false)} />}
      {credsOpen && <Credentials onClose={() => setCredsOpen(false)} onChange={() => window.chamaeleon.credsList().then(setCredentials)} />}
      {libraryOpen && (
        <Library currentUrl={active.url} currentTitle={active.title} onNavigate={navigate}
                 onClose={() => setLibraryOpen(false)} settings={settings} onSaveSettings={saveSettings} />
      )}
    </div>
  );
}
