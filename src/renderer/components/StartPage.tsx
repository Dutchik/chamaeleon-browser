import React, { useState } from 'react';
import type { SearchEngine } from '../../shared/types';
import { DEFAULT_ENGINES } from '../../shared/types';
import type { Bookmark } from '../global';

interface Props {
  engineId: string;
  onEngineChange(id: string): void;
  onSearch(url: string): void;
  bookmarks: Bookmark[];
  preloadPath: string;
  panes: string[];                 // 分割ダッシュボードに開くURL群
  onSavePanes(panes: string[]): void;
}

/// ホーム（新規タブ）: 検索エンジン選択 ＋ 複数サイト分割ダッシュボード。
export function StartPage(p: Props) {
  const [mode, setMode] = useState<'search' | 'split'>(p.panes.length > 0 ? 'split' : 'search');
  const [query, setQuery] = useState('');
  const engine = DEFAULT_ENGINES.find((e) => e.id === p.engineId) ?? DEFAULT_ENGINES[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (/^https?:\/\//.test(q) || /^[\w-]+(\.[\w-]+)+/.test(q)) {
      p.onSearch(/^https?:\/\//.test(q) ? q : 'https://' + q);
    } else {
      p.onSearch(engine.searchUrl.replace('%s', encodeURIComponent(q)));
    }
  };

  return (
    <div className="startpage">
      <div className="start-modebar">
        <button className={mode === 'search' ? 'on' : ''} onClick={() => setMode('search')}>🔍 検索</button>
        <button className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')}>▦ 分割ダッシュボード</button>
      </div>

      {mode === 'search' && (
        <div className="start-inner">
          <div className="start-logo">🦎 Chamaeleon</div>
          <div className="engine-row">
            {DEFAULT_ENGINES.map((eng: SearchEngine) => (
              <button key={eng.id} className={'engine-chip' + (eng.id === p.engineId ? ' on' : '')}
                      onClick={() => p.onEngineChange(eng.id)}>{eng.name}</button>
            ))}
          </div>
          <form className="start-search" onSubmit={submit}>
            <input autoFocus value={query} spellCheck={false}
                   placeholder={`${engine.name} で検索、またはURLを入力`}
                   onChange={(e) => setQuery(e.target.value)} />
            <button type="submit">検索</button>
          </form>
          {p.bookmarks.length > 0 && (
            <div className="start-bookmarks">
              {p.bookmarks.slice(0, 12).map((b) => (
                <button key={b.id} className="start-bm" title={b.url} onClick={() => p.onSearch(b.url)}>
                  <span className="start-bm-fav">{b.title.slice(0, 1).toUpperCase()}</span>
                  <span className="start-bm-title">{b.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'split' && (
        <SplitDashboard panes={p.panes} onSave={p.onSavePanes} preloadPath={p.preloadPath} engine={engine} />
      )}
    </div>
  );
}

/// 複数サイトを分割表示するダッシュボード（各セルが独立したwebview）
function SplitDashboard({ panes, onSave, preloadPath, engine }:
  { panes: string[]; onSave(p: string[]): void; preloadPath: string; engine: SearchEngine }) {

  const setPane = (i: number, url: string) => {
    const next = [...panes];
    next[i] = url;
    onSave(next);
  };
  const addPane = () => onSave([...panes, engine.homeUrl]);
  const removePane = (i: number) => onSave(panes.filter((_, j) => j !== i));

  if (panes.length === 0) {
    return (
      <div className="split-empty">
        <p>複数のサイトを並べて表示できます。</p>
        <button className="engine-chip on" onClick={addPane}>＋ サイトを追加</button>
      </div>
    );
  }

  // 列数: 1→1, 2→2, 3-4→2, 5-6→3, それ以上→3
  const cols = panes.length === 1 ? 1 : panes.length <= 4 ? 2 : 3;

  return (
    <div className="split-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {panes.map((url, i) => (
        <div key={i} className="split-cell">
          <div className="split-cellbar">
            <PaneUrlInput url={url} onChange={(u) => setPane(i, u)} engine={engine} />
            <button title="閉じる" onClick={() => removePane(i)}>×</button>
          </div>
          {preloadPath && React.createElement('webview', {
            src: normalizePane(url, engine),
            preload: preloadPath,
            style: { flex: 1, width: '100%', height: '100%' },
          })}
        </div>
      ))}
      {panes.length < 6 && <button className="split-add" onClick={addPane}>＋</button>}
    </div>
  );
}

function PaneUrlInput({ url, onChange, engine }: { url: string; onChange(u: string): void; engine: SearchEngine }) {
  const [text, setText] = useState(url);
  React.useEffect(() => setText(url), [url]);
  return (
    <form style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); onChange(normalizePane(text, engine)); }}>
      <input className="split-url" value={text} spellCheck={false}
             onChange={(e) => setText(e.target.value)} />
    </form>
  );
}

function normalizePane(raw: string, engine: SearchEngine): string {
  const t = raw.trim();
  if (!t) return engine.homeUrl;
  if (/^https?:\/\//.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+/.test(t)) return 'https://' + t;
  return engine.searchUrl.replace('%s', encodeURIComponent(t));
}
