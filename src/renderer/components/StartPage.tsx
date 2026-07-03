import React, { useState } from 'react';
import type { SearchEngine } from '../../shared/types';
import { DEFAULT_ENGINES } from '../../shared/types';
import type { Bookmark } from '../global';

interface Props {
  engineId: string;
  onEngineChange(id: string): void;
  onSearch(url: string): void;
  bookmarks: Bookmark[];
}

/// ホーム（新規タブ）: 検索エンジンの選択からスタートする画面。
export function StartPage(p: Props) {
  const [query, setQuery] = useState('');
  const engine = DEFAULT_ENGINES.find((e) => e.id === p.engineId) ?? DEFAULT_ENGINES[0];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // URLらしければ直接、そうでなければ選択中エンジンで検索
    if (/^https?:\/\//.test(q) || /^[\w-]+(\.[\w-]+)+/.test(q)) {
      p.onSearch(/^https?:\/\//.test(q) ? q : 'https://' + q);
    } else {
      p.onSearch(engine.searchUrl.replace('%s', encodeURIComponent(q)));
    }
  };

  return (
    <div className="startpage">
      <div className="start-logo">🦎 Chamaeleon</div>

      {/* エンジン選択 */}
      <div className="engine-row">
        {DEFAULT_ENGINES.map((eng: SearchEngine) => (
          <button key={eng.id}
                  className={'engine-chip' + (eng.id === p.engineId ? ' on' : '')}
                  onClick={() => p.onEngineChange(eng.id)}>
            {eng.name}
          </button>
        ))}
      </div>

      {/* 検索ボックス */}
      <form className="start-search" onSubmit={submit}>
        <input autoFocus value={query} spellCheck={false}
               placeholder={`${engine.name} で検索、またはURLを入力`}
               onChange={(e) => setQuery(e.target.value)} />
        <button type="submit">検索</button>
      </form>

      {/* ブックマークショートカット */}
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
  );
}
