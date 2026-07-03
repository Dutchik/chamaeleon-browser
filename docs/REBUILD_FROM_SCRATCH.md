# REBUILD_FROM_SCRATCH

新規環境でゼロから動かす手順。

## PC版 (Windows / macOS / Linux)

前提: Node.js 20+

```bash
git clone https://github.com/Dutchik/chamaeleon-browser.git
cd chamaeleon-browser
npm install
npm start            # tsc + vite build → electron 起動
```

- 開発: `npm run typecheck` で型検査。renderer は `vite`、main/preload は `tsc -p tsconfig.electron.json`
- 配布: `npm run dist:mac` / `npm run dist:win` / `npm run dist:linux`（electron-builder）

iOS版の手順は [chamaeleon-browser-ios](https://github.com/Dutchik/chamaeleon-browser-ios) を参照。

## 動作確認シナリオ（スモークテスト）

1. 起動 → URLバーに `example.com` → ページ表示
2. 🦎 バッジ → 「このサイト用に作成」→ CSSタブで `body { background: #222 !important; }` を追加
3. リロード → 背景が変わる（= パッチ注入OK）
4. ● 記録 → ページ内をクリック → ■ 停止 → マクロ保存 → ▶ 再生
