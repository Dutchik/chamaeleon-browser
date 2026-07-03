import React, { useState } from 'react';
import type { CredentialMeta, Flow, FlowActionType, FlowStep, MatchType } from '../../shared/types';
import { FLOW_ACTION_LABELS, newId, nowISO } from '../../shared/types';

interface Props {
  currentUrl: string;
  editing: Flow | null;              // 編集中フロー（新規はnull）
  credentials: CredentialMeta[];
  pickTarget: { forStepId: string; selector: string } | null; // ピッカーで取得したセレクタ
  onRequestPick(stepId: string): void;    // 要素ピッカー起動
  onSave(flow: Flow): void;
  onClose(): void;
  onAddCredential(): void;
}

const ACTION_TYPES: FlowActionType[] = [
  'navigate', 'click', 'input', 'fillUsername', 'fillPassword',
  'check', 'uncheck', 'select', 'submit', 'wait', 'waitForSelector', 'runJavaScript',
];

const needsSelector = (t: FlowActionType) =>
  ['click', 'input', 'check', 'uncheck', 'select', 'submit', 'waitForSelector', 'fillUsername', 'fillPassword'].includes(t);
const needsValue = (t: FlowActionType) => ['input', 'select', 'wait', 'runJavaScript'].includes(t);

/// 自動化フロー作成ウィザード（右パネル。ページを遷移しながら操作を追加できる）
export function FlowWizard(p: Props) {
  const [flow, setFlow] = useState<Flow>(() => p.editing ?? blankFlow(p.currentUrl));
  const [phase, setPhase] = useState<1 | 2 | 3>(p.editing ? 2 : 1);

  // ピッカーで取得したセレクタを該当ステップへ反映
  React.useEffect(() => {
    if (p.pickTarget) {
      setFlow((f) => ({
        ...f,
        steps: f.steps.map((s) => s.id === p.pickTarget!.forStepId ? { ...s, selector: p.pickTarget!.selector } : s),
      }));
    }
  }, [p.pickTarget]);

  const patch = (diff: Partial<Flow>) => setFlow((f) => ({ ...f, ...diff }));
  const patchStep = (id: string, diff: Partial<FlowStep>) =>
    setFlow((f) => ({ ...f, steps: f.steps.map((s) => (s.id === id ? { ...s, ...diff } : s)) }));

  const addStep = () => setFlow((f) => ({
    ...f, steps: [...f.steps, { id: newId(), type: 'click', timeoutMs: 12000, delayMs: 300 }],
  }));
  const removeStep = (id: string) => setFlow((f) => ({ ...f, steps: f.steps.filter((s) => s.id !== id) }));
  const move = (id: string, dir: -1 | 1) => setFlow((f) => {
    const i = f.steps.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= f.steps.length) return f;
    const steps = [...f.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    return { ...f, steps };
  });

  const save = () => {
    p.onSave({ ...flow, updatedAt: nowISO(), useCredentials: flow.steps.some((s) => s.type === 'fillUsername' || s.type === 'fillPassword') });
  };

  return (
    <div className="sitepanel wizard">
      <div className="wiz-head">
        <strong>{p.editing ? 'フローを編集' : '自動化フローを作成'}</strong>
        <button className="wiz-x" onClick={p.onClose}>×</button>
      </div>

      <div className="wiz-steps-nav">
        {[1, 2, 3].map((n) => (
          <button key={n} className={phase === n ? 'on' : ''} onClick={() => setPhase(n as 1 | 2 | 3)}>
            {n}. {{ 1: '対象', 2: 'アクション', 3: '保存' }[n as 1 | 2 | 3]}
          </button>
        ))}
      </div>

      <div className="wiz-body">
        {/* Phase 1: 対象ページ */}
        {phase === 1 && (
          <div className="form">
            <label>フロー名<input value={flow.name} onChange={(e) => patch({ name: e.target.value })} placeholder="例: 勤怠を打刻" /></label>
            <label>開始URL（▶実行時に最初に開く）
              <input value={flow.startUrl} spellCheck={false} onChange={(e) => patch({ startUrl: e.target.value })} />
              <button type="button" className="mini" onClick={() => patch({ startUrl: p.currentUrl })}>現在のページを使う</button>
            </label>
            <label>このフローを出すページ（マッチ方式）
              <select value={flow.matchType} onChange={(e) => patch({ matchType: e.target.value as MatchType })}>
                <option value="domain">domain（ドメイン）</option>
                <option value="path">path（パス＋*）</option>
                <option value="exact">exact（完全一致）</option>
                <option value="wildcard">wildcard（*）</option>
                <option value="regex">regex（正規表現）</option>
              </select>
            </label>
            <label>パターン
              <input value={flow.matchPattern} spellCheck={false} onChange={(e) => patch({ matchPattern: e.target.value })} placeholder="例: example.com" />
              <button type="button" className="mini" onClick={() => {
                try { patch({ matchPattern: new URL(p.currentUrl).hostname }); } catch { /* noop */ }
              }}>現在のドメインを使う</button>
            </label>
            <div className="sp-hint">対象を決めたら「アクション」タブでボタンのクリックや入力の手順を追加します。</div>
            <button onClick={() => setPhase(2)}>次へ（アクション設定）</button>
          </div>
        )}

        {/* Phase 2: アクション（順番に実行される） */}
        {phase === 2 && (
          <div>
            <div className="sp-hint">設定した順番に上から実行されます。ページ移動を挟んでも継続します。「🎯」で画面から要素を選べます。</div>
            {flow.steps.map((step, idx) => (
              <div key={step.id} className="patchrow">
                <div className="patchhead">
                  <span className="wiz-idx">{idx + 1}</span>
                  <select value={step.type} onChange={(e) => patchStep(step.id, { type: e.target.value as FlowActionType })}>
                    {ACTION_TYPES.map((t) => <option key={t} value={t}>{FLOW_ACTION_LABELS[t]}</option>)}
                  </select>
                  <button title="上へ" onClick={() => move(step.id, -1)}>↑</button>
                  <button title="下へ" onClick={() => move(step.id, 1)}>↓</button>
                  <button className="danger" title="削除" onClick={() => removeStep(step.id)}>🗑</button>
                </div>
                {step.type === 'navigate' && (
                  <input placeholder="移動先URL" value={step.url ?? ''} spellCheck={false}
                         onChange={(e) => patchStep(step.id, { url: e.target.value })} />
                )}
                {needsSelector(step.type) && (
                  <div className="wiz-selrow">
                    <input placeholder="CSSセレクタ" value={step.selector ?? ''} spellCheck={false}
                           onChange={(e) => patchStep(step.id, { selector: e.target.value })} />
                    <button title="画面から要素を選ぶ" onClick={() => p.onRequestPick(step.id)}>🎯</button>
                  </div>
                )}
                {needsValue(step.type) && (
                  <input placeholder={step.type === 'wait' ? '待機ミリ秒（例: 1000）' : step.type === 'runJavaScript' ? 'JavaScript' : '入力値'}
                         value={step.value ?? ''}
                         onChange={(e) => patchStep(step.id, { value: e.target.value })} />
                )}
                {(step.type === 'fillUsername' || step.type === 'fillPassword') && (
                  <div className="sp-hint">保存済みの認証情報から{step.type === 'fillUsername' ? 'ユーザー名' : 'パスワード'}を入力します（下で選択）。</div>
                )}
              </div>
            ))}
            <button onClick={addStep}>＋ アクションを追加</button>
            <button className="wiz-next" onClick={() => setPhase(3)}>次へ（保存）</button>
          </div>
        )}

        {/* Phase 3: 認証と保存 */}
        {phase === 3 && (
          <div className="form">
            {flow.steps.some((s) => s.type === 'fillUsername' || s.type === 'fillPassword') && (
              <>
                <label>使用する認証情報
                  <select value={flow.credentialId ?? ''} onChange={(e) => patch({ credentialId: e.target.value || undefined })}>
                    <option value="">選択してください</option>
                    {p.credentials.map((c) => <option key={c.id} value={c.id}>{c.domain} — {c.username}</option>)}
                  </select>
                </label>
                <button type="button" className="mini" onClick={p.onAddCredential}>＋ 認証情報を追加</button>
                <div className="warn-box">
                  ⚠ 認証情報は<b>この端末内のみ</b>にOSの暗号化ストレージで保存され、外部には送信されません。共有PCでの利用は避けてください。
                </div>
              </>
            )}
            <label>有効<input type="checkbox" checked={flow.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /></label>
            <div className="sp-hint">保存すると、対象ページを開いたときにヘッダーの「▶ フロー」ボタンから実行できます。</div>
            <button onClick={save} disabled={!flow.name || !flow.matchPattern}>フローを保存</button>
          </div>
        )}
      </div>
    </div>
  );
}

function blankFlow(url: string): Flow {
  let domain = '';
  try { domain = new URL(url).hostname; } catch { /* noop */ }
  return {
    id: newId(), name: '', enabled: true,
    matchType: 'domain', matchPattern: domain,
    startUrl: url, useCredentials: false, steps: [],
    createdAt: nowISO(), updatedAt: nowISO(),
  };
}
