# 🦎 Chamaeleon Browser

Webページを「見る」だけでなく、**自分の使いやすい形へ変形し、操作を記録し、再訪問時に再現する**カスタムブラウザ。

| プラットフォーム | 技術 | 状態 |
|---|---|---|
| **Windows / macOS / Linux** | Electron + React + TypeScript + Vite (`desktop/`) | MVP実装済み |
| **iPhone / iPad** | SwiftUI + WKWebView (`ios/`) | MVP実装済み |

## 中核機能

1. **Site Profile** — URL / ドメイン / パス / ワイルドカード / 正規表現ごとに設定を保存
2. **CSS / JS Patch** — 登録ページ訪問時に自動注入・自動実行
3. **DOM Rule** — コードを書かずに要素の非表示・削除・強調・置換・自動クリック等
4. **Automation Recorder** — クリック・入力・スクロールを記録してマクロとして再生（デスクトップ版）
5. **改修メモ** — バグ・改善案を記録し、AI向け改修プロンプトを生成

## 開発

### デスクトップ版

```bash
cd desktop
npm install
npm start          # ビルドして Electron 起動
npm run typecheck  # 型チェック
npm run dist:mac   # macOS 配布物 (dmg/zip)
npm run dist:win   # Windows 配布物 (nsis/zip)
```

### iOS版

```bash
cd ios
xcodegen generate   # brew install xcodegen
open Chamaeleon.xcodeproj
```

Xcode で ▶ 実行（iOS 16+）。

## ドキュメント

設計・データモデル・再構築手順は [`docs/`](docs/) を参照。AIエージェント（GitHub Copilot coding agent / Claude / Codex）が引き継げるように書かれています。

- [MASTER_SPEC.md](docs/MASTER_SPEC.md) — 全体仕様（原典）
- [FILE_STRUCTURE.md](docs/FILE_STRUCTURE.md) — ファイル構造と責務
- [DATA_MODEL.md](docs/DATA_MODEL.md) — 型定義と保存形式
- [REBUILD_FROM_SCRATCH.md](docs/REBUILD_FROM_SCRATCH.md) — ゼロから再構築する手順
- [UPDATE_PROTOCOL.md](docs/UPDATE_PROTOCOL.md) — 機能追加・修正時の手順

## セキュリティ方針（抜粋・仕様§14）

- ユーザーが明示的に登録したページにのみパッチを適用する（全サイト適用は不可）
- パスワード欄の値は記録しない
- CAPTCHA回避・不正アクセス支援・機密情報の外部送信は実装しない

## License

MIT
