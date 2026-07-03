import React, { useEffect, useMemo, useState } from 'react';

export interface InspectedElement {
  selector: string;
  tag: string;
  id: string;
  className: string;
  styles: Record<string, string>;
}

interface Props {
  target: InspectedElement;
  onPreview(cssText: string): void;     // 編集中のライブプレビュー
  onReinspect(): void;                  // 別の要素を選び直す
  onRegister(selector: string, cssText: string): void; // CSSパッチとして登録
  onClose(): void;
}

// 編集フォームに出す代表プロパティ（種類ごと）
const FIELDS: { key: string; label: string; type: 'color' | 'text' }[] = [
  { key: 'color', label: '文字色', type: 'color' },
  { key: 'background-color', label: '背景色', type: 'color' },
  { key: 'font-size', label: '文字サイズ', type: 'text' },
  { key: 'font-weight', label: '太さ', type: 'text' },
  { key: 'display', label: '表示(display)', type: 'text' },
  { key: 'opacity', label: '不透明度', type: 'text' },
  { key: 'width', label: '幅', type: 'text' },
  { key: 'height', label: '高さ', type: 'text' },
  { key: 'max-width', label: '最大幅', type: 'text' },
  { key: 'margin', label: 'margin', type: 'text' },
  { key: 'padding', label: 'padding', type: 'text' },
  { key: 'border', label: 'border', type: 'text' },
  { key: 'border-radius', label: '角丸', type: 'text' },
  { key: 'text-align', label: '揃え', type: 'text' },
  { key: 'box-shadow', label: '影', type: 'text' },
];

// rgb(a) を #hex に（color input 用）
function toHex(v: string): string {
  const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return v.startsWith('#') ? v : '#000000';
  const h = (n: string) => Number(n).toString(16).padStart(2, '0');
  return '#' + h(m[1]) + h(m[2]) + h(m[3]);
}

/// DevToolsライクなスタイル編集。編集した差分だけをCSSルールとして登録できる。
export function StyleEditor(p: Props) {
  // 元のスタイル（差分検出用）と編集後の値
  const base = p.target.styles;
  const [values, setValues] = useState<Record<string, string>>({});
  const [freeform, setFreeform] = useState('');

  useEffect(() => { setValues({}); setFreeform(''); }, [p.target.selector]);

  // 変更されたプロパティのみを集めてCSSルールを生成
  const cssText = useMemo(() => {
    const decls: string[] = [];
    for (const f of FIELDS) {
      const v = values[f.key];
      if (v != null && v !== '' && v !== base[f.key]) decls.push(`  ${f.key}: ${v} !important;`);
    }
    if (freeform.trim()) decls.push('  ' + freeform.trim().replace(/;?\s*$/, ';'));
    if (decls.length === 0) return '';
    return `${p.target.selector} {\n${decls.join('\n')}\n}`;
  }, [values, freeform, base, p.target.selector]);

  // 編集のたびにライブプレビュー
  useEffect(() => { p.onPreview(cssText); }, [cssText]);

  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));

  return (
    <div className="sitepanel styleeditor">
      <div className="wiz-head">
        <strong>🎨 スタイル編集</strong>
        <button className="wiz-x" onClick={p.onClose}>×</button>
      </div>

      <div className="se-target">
        <code>{p.target.selector}</code>
        <button className="mini" onClick={p.onReinspect}>別の要素を選ぶ</button>
      </div>

      <div className="wiz-body">
        {FIELDS.map((f) => {
          const cur = values[f.key] ?? base[f.key] ?? '';
          return (
            <div key={f.key} className="se-row">
              <label>{f.label}</label>
              {f.type === 'color' ? (
                <div className="se-color">
                  <input type="color" value={toHex(cur)} onChange={(e) => set(f.key, e.target.value)} />
                  <input value={values[f.key] ?? base[f.key] ?? ''} spellCheck={false}
                         onChange={(e) => set(f.key, e.target.value)} />
                </div>
              ) : (
                <input value={values[f.key] ?? base[f.key] ?? ''} spellCheck={false}
                       placeholder={base[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </div>
          );
        })}

        <div className="se-row">
          <label>その他のCSS（自由記述）</label>
          <textarea rows={3} className="code" spellCheck={false} value={freeform}
                    placeholder="filter: grayscale(1); transform: scale(1.1);"
                    onChange={(e) => setFreeform(e.target.value)} />
        </div>

        <div className="se-preview">
          <div className="se-preview-title">生成されるCSS（プレビュー中）</div>
          <pre>{cssText || '（変更したプロパティがここに表示されます）'}</pre>
        </div>

        <button className="se-register" disabled={!cssText}
                onClick={() => p.onRegister(p.target.selector, cssText)}>
          このCSSを登録（このサイトに保存）
        </button>
        <div className="sp-hint">登録すると Site Profile の CSS Patch として保存され、次回以降このページを開くたびに自動適用されます。</div>
      </div>
    </div>
  );
}
