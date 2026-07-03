import React, { useEffect, useState } from 'react';

interface Ext { id: string; name: string; version: string; path: string; }

/// Chrome拡張（アンパック版フォルダ）の管理。
/// 注: Chrome Web Store からの直接インストールは Electron の制約で不可。
/// 展開済み（unpacked）拡張のフォルダを読み込む方式（開発者モード相当）。
export function Extensions({ onClose }: { onClose(): void }) {
  const [items, setItems] = useState<Ext[]>([]);
  const [msg, setMsg] = useState('');

  const reload = () => window.chamaeleon.extList().then(setItems);
  useEffect(() => { reload(); }, []);

  const add = async () => {
    const res = await window.chamaeleon.extAdd();
    if (res && 'error' in res) setMsg('読み込み失敗: ' + res.error);
    else if (res) setMsg(`「${res.name}」を追加しました`);
    reload();
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div className="reports-overlay" onClick={onClose}>
      <div className="reports" onClick={(e) => e.stopPropagation()}>
        <div className="reports-head">
          <strong>🧩 Chrome拡張機能</strong>
          <button onClick={add}>＋ フォルダから追加</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>閉じる</button>
        </div>
        <div className="reports-body">
          <div className="warn-box" style={{ borderColor: 'rgba(148,163,184,.3)', background: 'rgba(148,163,184,.08)', color: '#c4ccda' }}>
            展開済み（unpacked）拡張のフォルダ（<code>manifest.json</code> を含む）を読み込みます。<br />
            Chrome Web Store の <code>.crx</code> を直接インストールすることは Electron の仕様上できません。
            Web Storeの拡張を使うには、拡張のソース（GitHub等）を入手してフォルダで読み込むか、
            Chromeの「拡張機能を管理」→ デベロッパーモードで <code>.crx</code> を展開してから読み込んでください。
          </div>
          {msg && <div className="sp-hint" style={{ color: 'var(--accent)' }}>{msg}</div>}
          {items.map((e) => (
            <div key={e.id} className="patchrow">
              <div className="patchhead">
                <div style={{ flex: 1 }}>
                  <div className="lib-title">{e.name} <span style={{ color: 'var(--muted)', fontSize: 11 }}>v{e.version}</span></div>
                  <div className="lib-url">{e.path}</div>
                </div>
                <button className="danger" onClick={async () => { await window.chamaeleon.extRemove(e.id, e.path); reload(); }}>削除</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="sp-hint">読み込み済みの拡張はありません。</div>}
        </div>
      </div>
    </div>
  );
}
