import React, { useState } from 'react';
import type {
  AutomationMacro, CssPatch, DomAction, DomRule, ExecutionLog, JsPatch, SiteNote, SiteProfile,
} from '../../shared/types';
import { newId, nowISO } from '../../shared/types';

interface Props {
  url: string;
  profiles: SiteProfile[];
  matched: SiteProfile[];
  logs: ExecutionLog[];
  recording: boolean;
  recordedCount: number;
  onSaveProfiles(next: SiteProfile[]): void;
  onSaveRecording(profileId: string, name: string): void;
  onPlayMacro(macro: AutomationMacro): void;
  onRunJs(profileId: string, patchId: string): void;
}

type Tab = 'profile' | 'css' | 'js' | 'dom' | 'macro' | 'notes' | 'logs';

export function SitePanel(p: Props) {
  const [tab, setTab] = useState<Tab>('profile');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = p.profiles.find((x) => x.id === selectedId) ?? p.matched[0] ?? null;

  const update = (profile: SiteProfile) => {
    p.onSaveProfiles(p.profiles.map((x) => (x.id === profile.id ? { ...profile, updatedAt: nowISO() } : x)));
  };

  const createProfileForCurrent = () => {
    let domain = '';
    try { domain = new URL(p.url).hostname; } catch { /* ignore */ }
    const profile: SiteProfile = {
      id: newId(), name: domain || 'New Profile', enabled: true,
      matchType: 'domain', matchPattern: domain,
      cssPatches: [], jsPatches: [], domRules: [], automations: [], notes: [],
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    p.onSaveProfiles([...p.profiles, profile]);
    setSelectedId(profile.id);
  };

  return (
    <div className="sitepanel">
      <div className="sp-url" title={p.url}>{p.url}</div>

      {/* プロファイル選択 */}
      <div className="sp-row">
        <select value={selected?.id ?? ''} onChange={(e) => setSelectedId(e.target.value || null)}>
          <option value="">プロファイルを選択…</option>
          {p.profiles.map((x) => (
            <option key={x.id} value={x.id}>
              {(p.matched.some((m) => m.id === x.id) ? '● ' : '') + x.name}
            </option>
          ))}
        </select>
        <button onClick={createProfileForCurrent}>＋ このサイト用に作成</button>
      </div>

      <div className="sp-tabs">
        {(['profile', 'css', 'js', 'dom', 'macro', 'notes', 'logs'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {{ profile: '設定', css: 'CSS', js: 'JS', dom: 'DOM', macro: 'マクロ', notes: 'メモ', logs: 'ログ' }[t]}
          </button>
        ))}
      </div>

      <div className="sp-body">
        {!selected && <div className="sp-hint">プロファイルを選択するか、「このサイト用に作成」を押してください。</div>}

        {selected && tab === 'profile' && <ProfileEditor profile={selected} onChange={update}
          onDelete={() => { p.onSaveProfiles(p.profiles.filter((x) => x.id !== selected.id)); setSelectedId(null); }} />}

        {selected && tab === 'css' && (
          <PatchList
            items={selected.cssPatches}
            kind="css"
            onChange={(items) => update({ ...selected, cssPatches: items as CssPatch[] })}
          />
        )}

        {selected && tab === 'js' && (
          <PatchList
            items={selected.jsPatches}
            kind="js"
            onRun={(id) => p.onRunJs(selected.id, id)}
            onChange={(items) => update({ ...selected, jsPatches: items as JsPatch[] })}
          />
        )}

        {selected && tab === 'dom' && (
          <DomRuleList rules={selected.domRules}
            onChange={(rules) => update({ ...selected, domRules: rules })} />
        )}

        {selected && tab === 'macro' && (
          <MacroList
            macros={selected.automations}
            recording={p.recording}
            recordedCount={p.recordedCount}
            onSaveRecording={(name) => p.onSaveRecording(selected.id, name)}
            onPlay={p.onPlayMacro}
            onChange={(macros) => update({ ...selected, automations: macros })}
          />
        )}

        {selected && tab === 'notes' && (
          <NotesList notes={selected.notes}
            onChange={(notes) => update({ ...selected, notes })} />
        )}

        {tab === 'logs' && (
          <div className="loglist">
            {p.logs.slice(0, 100).map((l) => (
              <div key={l.id} className={'logrow ' + l.status}>
                <span className="logtype">{l.type}</span>
                <span className="logmsg">{l.status}{l.message ? ': ' + l.message : ''}</span>
              </div>
            ))}
            {p.logs.length === 0 && <div className="sp-hint">まだ実行ログはありません。</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- プロファイル基本設定 ----

function ProfileEditor({ profile, onChange, onDelete }:
  { profile: SiteProfile; onChange(p: SiteProfile): void; onDelete(): void }) {
  return (
    <div className="form">
      <label>名前<input value={profile.name} onChange={(e) => onChange({ ...profile, name: e.target.value })} /></label>
      <label>有効
        <input type="checkbox" checked={profile.enabled}
               onChange={(e) => onChange({ ...profile, enabled: e.target.checked })} />
      </label>
      <label>マッチ方式
        <select value={profile.matchType}
                onChange={(e) => onChange({ ...profile, matchType: e.target.value as SiteProfile['matchType'] })}>
          <option value="exact">exact（完全一致）</option>
          <option value="domain">domain（ドメイン）</option>
          <option value="path">path（パス＋*）</option>
          <option value="wildcard">wildcard（*）</option>
          <option value="regex">regex（正規表現）</option>
        </select>
      </label>
      <label>パターン
        <input value={profile.matchPattern} spellCheck={false}
               onChange={(e) => onChange({ ...profile, matchPattern: e.target.value })} />
      </label>
      <label>説明
        <textarea rows={2} value={profile.description ?? ''}
                  onChange={(e) => onChange({ ...profile, description: e.target.value })} />
      </label>
      <button className="danger" onClick={onDelete}>プロファイルを削除</button>
    </div>
  );
}

// ---- CSS / JS パッチ一覧＋エディタ ----

function PatchList({ items, kind, onChange, onRun }: {
  items: Array<CssPatch | JsPatch>;
  kind: 'css' | 'js';
  onChange(items: Array<CssPatch | JsPatch>): void;
  onRun?(id: string): void;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const add = () => {
    const base = {
      id: newId(), name: kind.toUpperCase() + ' Patch', enabled: true, code: '',
      runAt: 'document_end' as const, priority: items.length,
      createdAt: nowISO(), updatedAt: nowISO(),
    };
    const item = kind === 'js' ? { ...base, sandbox: true, allowDomAccess: true } : base;
    onChange([...items, item]);
    setEditing(item.id);
  };

  const patch = (id: string, diff: Partial<CssPatch & JsPatch>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...diff, updatedAt: nowISO() } : i)));

  return (
    <div>
      {items.map((item) => (
        <div key={item.id} className="patchrow">
          <div className="patchhead">
            <input type="checkbox" checked={item.enabled}
                   onChange={(e) => patch(item.id, { enabled: e.target.checked })} />
            <input className="patchname" value={item.name}
                   onChange={(e) => patch(item.id, { name: e.target.value })} />
            <select value={item.runAt} onChange={(e) => patch(item.id, { runAt: e.target.value as CssPatch['runAt'] })}>
              <option value="document_start">start</option>
              <option value="document_end">end</option>
              <option value="idle">idle</option>
              {kind === 'js' && <option value="manual">manual</option>}
            </select>
            {kind === 'js' && onRun && <button title="今すぐ実行" onClick={() => onRun(item.id)}>▶</button>}
            <button onClick={() => setEditing(editing === item.id ? null : item.id)}>✎</button>
            <button className="danger" onClick={() => onChange(items.filter((i) => i.id !== item.id))}>🗑</button>
          </div>
          {editing === item.id && (
            <textarea className="code" rows={10} spellCheck={false} value={item.code}
                      placeholder={kind === 'css' ? '.ad { display: none !important; }' : "document.title = 'patched';"}
                      onChange={(e) => patch(item.id, { code: e.target.value })} />
          )}
        </div>
      ))}
      <button onClick={add}>＋ {kind.toUpperCase()} Patch を追加</button>
    </div>
  );
}

// ---- DOM Rule ----

const DOM_ACTIONS: DomAction[] = ['hide', 'remove', 'highlight', 'replaceText', 'addClass', 'setStyle', 'move', 'click', 'input'];

function DomRuleList({ rules, onChange }: { rules: DomRule[]; onChange(rules: DomRule[]): void }) {
  const add = () => onChange([...rules, {
    id: newId(), name: 'Rule', enabled: true, selector: '', action: 'hide',
    runAt: 'document_end', waitForSelector: true, timeoutMs: 10000,
  }]);
  const patch = (id: string, diff: Partial<DomRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...diff } : r)));

  return (
    <div>
      {rules.map((r) => (
        <div key={r.id} className="patchrow">
          <div className="patchhead">
            <input type="checkbox" checked={r.enabled} onChange={(e) => patch(r.id, { enabled: e.target.checked })} />
            <select value={r.action} onChange={(e) => patch(r.id, { action: e.target.value as DomAction })}>
              {DOM_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button className="danger" onClick={() => onChange(rules.filter((x) => x.id !== r.id))}>🗑</button>
          </div>
          <input placeholder="CSSセレクタ（例: .sidebar）" spellCheck={false} value={r.selector}
                 onChange={(e) => patch(r.id, { selector: e.target.value })} />
          {['replaceText', 'addClass', 'setStyle', 'move', 'input'].includes(r.action) && (
            <input placeholder="値（テキスト / クラス / style / 移動先セレクタ / 入力値）" value={r.value ?? ''}
                   onChange={(e) => patch(r.id, { value: e.target.value })} />
          )}
        </div>
      ))}
      <button onClick={add}>＋ DOM Rule を追加</button>
    </div>
  );
}

// ---- マクロ ----

function MacroList({ macros, recording, recordedCount, onSaveRecording, onPlay, onChange }: {
  macros: AutomationMacro[];
  recording: boolean;
  recordedCount: number;
  onSaveRecording(name: string): void;
  onPlay(m: AutomationMacro): void;
  onChange(macros: AutomationMacro[]): void;
}) {
  const [name, setName] = useState('');
  const patch = (id: string, diff: Partial<AutomationMacro>) =>
    onChange(macros.map((m) => (m.id === id ? { ...m, ...diff, updatedAt: nowISO() } : m)));

  return (
    <div>
      {recording && <div className="sp-hint rec-hint">● 記録中… {recordedCount} ステップ取得済み。ナビバーの「■ 停止」で終了。</div>}
      {!recording && recordedCount > 0 && (
        <div className="form">
          <div className="sp-hint">記録済み {recordedCount} ステップ。名前を付けて保存:</div>
          <input placeholder="マクロ名" value={name} onChange={(e) => setName(e.target.value)} />
          <button disabled={!name} onClick={() => { onSaveRecording(name); setName(''); }}>保存</button>
        </div>
      )}
      {macros.map((m) => (
        <div key={m.id} className="patchrow">
          <div className="patchhead">
            <input type="checkbox" checked={m.enabled} onChange={(e) => patch(m.id, { enabled: e.target.checked })} />
            <input className="patchname" value={m.name} onChange={(e) => patch(m.id, { name: e.target.value })} />
            <select value={m.trigger.type}
                    onChange={(e) => patch(m.id, { trigger: { ...m.trigger, type: e.target.value as AutomationMacro['trigger']['type'] } })}>
              <option value="manual">manual</option>
              <option value="onPageLoad">onPageLoad</option>
              <option value="onUrlMatch">onUrlMatch</option>
              <option value="onElementAppear">onElementAppear</option>
            </select>
            <button title="再生" onClick={() => onPlay(m)}>▶</button>
            <button className="danger" onClick={() => onChange(macros.filter((x) => x.id !== m.id))}>🗑</button>
          </div>
          {(m.trigger.type === 'onUrlMatch' || m.trigger.type === 'onElementAppear') && (
            <input placeholder={m.trigger.type === 'onUrlMatch' ? 'URLに含まれる文字列' : '出現を待つセレクタ'}
                   value={m.trigger.value ?? ''}
                   onChange={(e) => patch(m.id, { trigger: { ...m.trigger, value: e.target.value } })} />
          )}
          <div className="steps">{m.steps.length} steps: {m.steps.map((s) => s.type).join(' → ')}</div>
        </div>
      ))}
      {macros.length === 0 && !recording && recordedCount === 0 &&
        <div className="sp-hint">ナビバーの「● 記録」でページ操作を記録し、ここに保存できます。</div>}
    </div>
  );
}

// ---- メモ ----

function NotesList({ notes, onChange }: { notes: SiteNote[]; onChange(notes: SiteNote[]): void }) {
  const add = () => onChange([...notes, {
    id: newId(), title: 'メモ', body: '', tags: [], createdAt: nowISO(), updatedAt: nowISO(),
  }]);
  const patch = (id: string, diff: Partial<SiteNote>) =>
    onChange(notes.map((n) => (n.id === id ? { ...n, ...diff, updatedAt: nowISO() } : n)));
  return (
    <div>
      {notes.map((n) => (
        <div key={n.id} className="patchrow">
          <div className="patchhead">
            <input className="patchname" value={n.title} onChange={(e) => patch(n.id, { title: e.target.value })} />
            <button className="danger" onClick={() => onChange(notes.filter((x) => x.id !== n.id))}>🗑</button>
          </div>
          <textarea rows={4} value={n.body} onChange={(e) => patch(n.id, { body: e.target.value })} />
        </div>
      ))}
      <button onClick={add}>＋ メモを追加</button>
    </div>
  );
}
