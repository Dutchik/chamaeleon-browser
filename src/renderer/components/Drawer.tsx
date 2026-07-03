import React from 'react';

export interface DrawerAction {
  icon: string;
  label: string;
  onClick(): void;
  active?: boolean;
}

interface Props {
  open: boolean;
  onClose(): void;
  groups: { title: string; items: DrawerAction[] }[];
}

/// 左ハンバーガーメニュー（展開式ドロワー）。検索画面の上にオーバーレイ表示される。
export function Drawer({ open, onClose, groups }: Props) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="drawer-logo">🦎 Chamaeleon</span>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          {groups.map((g) => (
            <div key={g.title} className="drawer-group">
              <div className="drawer-group-title">{g.title}</div>
              {g.items.map((it) => (
                <button key={it.label}
                        className={'drawer-item' + (it.active ? ' active' : '')}
                        onClick={() => { it.onClick(); onClose(); }}>
                  <span className="drawer-icon">{it.icon}</span>
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
