import React, { useEffect, useState } from 'react';
import type { DevReport } from '../../shared/types';
import { newId, nowISO } from '../../shared/types';

const STATUSES: DevReport['status'][] = ['todo', 'doing', 'done', 'hold'];
const PRIORITIES: DevReport['priority'][] = ['low', 'medium', 'high', 'critical'];

/// 改修メモ（仕様§16）: ブラウザ自体のバグ・改善案を記録し、AI向けプロンプトも生成できる
export function DevReports({ onClose }: { onClose(): void }) {
  const [reports, setReports] = useState<DevReport[]>([]);
  const [filter, setFilter] = useState<DevReport['status'] | 'all'>('all');

  useEffect(() => {
    window.chamaeleon.loadData('reports').then(setReports);
  }, []);

  const save = (next: DevReport[]) => {
    setReports(next);
    void window.chamaeleon.saveData('reports', next);
  };

  const add = () => save([{
    id: newId(), title: '', body: '', status: 'todo', priority: 'medium',
    tags: [], createdAt: nowISO(), updatedAt: nowISO(),
  }, ...reports]);

  const patch = (id: string, diff: Partial<DevReport>) =>
    save(reports.map((r) => (r.id === id ? { ...r, ...diff, updatedAt: nowISO() } : r)));

  const exportCsv = () => {
    const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const rows = [
      ['id', 'title', 'body', 'status', 'priority', 'tags', 'createdAt'].join(','),
      ...reports.map((r) => [r.id, esc(r.title), esc(r.body), r.status, r.priority, esc(r.tags.join(';')), r.createdAt].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dev-reports.csv';
    a.click();
  };

  const copyPrompt = (r: DevReport) => {
    const prompt = [
      '# Chamaeleon Browser 改修依頼',
      `## タイトル\n${r.title}`,
      `## 内容\n${r.body}`,
      `## 優先度\n${r.priority}`,
      r.relatedFile ? `## 関連ファイル\n${r.relatedFile}` : '',
      '## 指示\n上記の改修を実装してください。docs/MASTER_SPEC.md の仕様に従うこと。',
    ].filter(Boolean).join('\n\n');
    void navigator.clipboard.writeText(prompt);
  };

  const visible = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  return (
    <div className="reports-overlay">
      <div className="reports">
        <div className="reports-head">
          <strong>改修メモ</strong>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">すべて</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={add}>＋ 追加</button>
          <button onClick={exportCsv}>CSV書き出し</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>閉じる</button>
        </div>
        <div className="reports-body">
          {visible.map((r) => (
            <div key={r.id} className="patchrow">
              <div className="patchhead">
                <select value={r.status} onChange={(e) => patch(r.id, { status: e.target.value as DevReport['status'] })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={r.priority} onChange={(e) => patch(r.id, { priority: e.target.value as DevReport['priority'] })}>
                  {PRIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="patchname" placeholder="タイトル" value={r.title}
                       onChange={(e) => patch(r.id, { title: e.target.value })} />
                <button title="AI用プロンプトをコピー" onClick={() => copyPrompt(r)}>🤖</button>
                <button className="danger" onClick={() => save(reports.filter((x) => x.id !== r.id))}>🗑</button>
              </div>
              <textarea rows={3} placeholder="詳細（バグ内容・改善案・再現手順）" value={r.body}
                        onChange={(e) => patch(r.id, { body: e.target.value })} />
            </div>
          ))}
          {visible.length === 0 && <div className="sp-hint">メモはまだありません。</div>}
        </div>
      </div>
    </div>
  );
}
