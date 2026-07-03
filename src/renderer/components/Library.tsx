import React, { useEffect, useState } from 'react';
import type { AppSettings, Bookmark, DownloadInfo, HistoryEntry } from '../global';
import { newId, nowISO } from '../../shared/types';

type Tab = 'bookmarks' | 'history' | 'downloads' | 'settings';

interface Props {
  currentUrl: string;
  currentTitle: string;
  onNavigate(url: string): void;
  onClose(): void;
  settings: AppSettings;
  onSaveSettings(s: AppSettings): void;
}

/// ライブラリ: ブックマーク・履歴・ダウンロード・設定（仕様§4.1）
export function Library(p: Props) {
  const [tab, setTab] = useState<Tab>('bookmarks');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [downloads, setDownloads] = useState<DownloadInfo[]>([]);
  const [search, setSearch] = useState('');
  const [homepage, setHomepage] = useState(p.settings.homepage ?? '');
  const [ua, setUa] = useState(p.settings.userAgent ?? '');

  useEffect(() => {
    void window.chamaeleon.loadData('bookmarks').then(setBookmarks);
    void window.chamaeleon.loadData('history').then(setHistory);
    void window.chamaeleon.listDownloads().then(setDownloads);
    window.chamaeleon.onDownloadsUpdate(setDownloads);
  }, []);

  const saveBookmarks = (items: Bookmark[]) => {
    setBookmarks(items);
    void window.chamaeleon.saveData('bookmarks', items);
  };

  const filteredHistory = history.filter((h) =>
    !search || h.title.includes(search) || h.url.includes(search));

  const fmtBytes = (n: number) =>
    n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB';

  return (
    <div className="reports-overlay" onClick={p.onClose}>
      <div className="reports" onClick={(e) => e.stopPropagation()}>
        <div className="reports-head">
          {(['bookmarks', 'history', 'downloads', 'settings'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'lib-on' : ''} onClick={() => setTab(t)}>
              {{ bookmarks: '☆ ブックマーク', history: '🕘 履歴', downloads: '⬇ ダウンロード', settings: '⚙ 設定' }[t]}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button onClick={p.onClose}>閉じる</button>
        </div>
        <div className="reports-body">

          {tab === 'bookmarks' && (
            <div>
              <button onClick={() => saveBookmarks([
                { id: newId(), title: p.currentTitle || p.currentUrl, url: p.currentUrl, createdAt: nowISO() },
                ...bookmarks,
              ])}>＋ 現在のページを追加</button>
              {bookmarks.map((b) => (
                <div key={b.id} className="patchrow">
                  <div className="patchhead">
                    <a className="lib-link" onClick={() => { p.onNavigate(b.url); p.onClose(); }}>
                      <div className="lib-title">{b.title}</div>
                      <div className="lib-url">{b.url}</div>
                    </a>
                    <button className="danger" onClick={() => saveBookmarks(bookmarks.filter((x) => x.id !== b.id))}>🗑</button>
                  </div>
                </div>
              ))}
              {bookmarks.length === 0 && <div className="sp-hint">ブックマークはまだありません。</div>}
            </div>
          )}

          {tab === 'history' && (
            <div>
              <div className="patchhead" style={{ marginBottom: 8 }}>
                <input placeholder="タイトル・URLで検索" value={search} onChange={(e) => setSearch(e.target.value)} />
                <button className="danger" onClick={() => {
                  setHistory([]);
                  void window.chamaeleon.saveData('history', []);
                }}>全消去</button>
              </div>
              {filteredHistory.slice(0, 200).map((h) => (
                <div key={h.id} className="patchrow">
                  <a className="lib-link" onClick={() => { p.onNavigate(h.url); p.onClose(); }}>
                    <div className="lib-title">{h.title || h.url}</div>
                    <div className="lib-url">{new Date(h.visitedAt).toLocaleString('ja-JP')} — {h.url}</div>
                  </a>
                </div>
              ))}
              {filteredHistory.length === 0 && <div className="sp-hint">履歴はありません。</div>}
            </div>
          )}

          {tab === 'downloads' && (
            <div>
              {downloads.map((d) => (
                <div key={d.id} className="patchrow">
                  <div className="patchhead">
                    <div style={{ flex: 1 }}>
                      <div className="lib-title">{d.filename}</div>
                      <div className="lib-url">
                        {d.state === 'progressing'
                          ? `${fmtBytes(d.receivedBytes)} / ${d.totalBytes ? fmtBytes(d.totalBytes) : '?'}`
                          : { completed: '完了', cancelled: 'キャンセル', interrupted: '中断' }[d.state]}
                      </div>
                      {d.state === 'progressing' && d.totalBytes > 0 && (
                        <div className="lib-progress">
                          <div style={{ width: `${(d.receivedBytes / d.totalBytes) * 100}%` }} />
                        </div>
                      )}
                    </div>
                    {d.state === 'completed' && <>
                      <button onClick={() => void window.chamaeleon.openDownloadFile(d.savePath)}>開く</button>
                      <button onClick={() => void window.chamaeleon.showDownloadInFolder(d.savePath)}>📁</button>
                    </>}
                  </div>
                </div>
              ))}
              {downloads.length === 0 && <div className="sp-hint">このセッションのダウンロードはありません。</div>}
            </div>
          )}

          {tab === 'settings' && (
            <div className="form">
              <label>ホームページ（新しいタブで開くURL）
                <input placeholder="https://duckduckgo.com" value={homepage}
                       onChange={(e) => setHomepage(e.target.value)} spellCheck={false} />
              </label>
              <label>ユーザーエージェント（空欄で既定）
                <input placeholder="Mozilla/5.0 ..." value={ua}
                       onChange={(e) => setUa(e.target.value)} spellCheck={false} />
              </label>
              <button onClick={() => {
                const next: AppSettings = { homepage: homepage || undefined, userAgent: ua || undefined };
                p.onSaveSettings(next);
                void window.chamaeleon.setUserAgent(ua);
              }}>保存</button>
              <div className="sp-hint">ユーザーエージェントの変更は次のページ読み込みから有効になります。</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
