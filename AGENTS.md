# Copilot Instructions — Chamaeleon Browser (PC版)

このリポジトリは「Webページ毎にCSS/JS/DOM操作/自動化マクロを登録し再訪問時に自動適用するカスタムブラウザ」の
**PC版（Windows / macOS / Linux, Electron + React + TypeScript + Vite）**です。
iOS版は別リポジトリ: https://github.com/Dutchik/chamaeleon-browser-ios

## 必読ドキュメント（実装前に必ず読む）

1. `docs/MASTER_SPEC.md` — 全体仕様の原典
2. `docs/FILE_STRUCTURE.md` — どこに何を書くか
3. `docs/UPDATE_PROTOCOL.md` — 変更手順

## 検証コマンド（PR前に必ず通すこと）

```bash
npm install && npm run typecheck && npm run build
```

## 守るべきルール

- データモデルの原典は `src/shared/types.ts`。変更したら docs/DATA_MODEL.md を更新し、iOSリポジトリへの同期Issueを起こす
- MASTER_SPEC §14（セキュリティ）: 全サイト一括適用の既定化、パスワード値の記録、CAPTCHA回避、外部送信は実装しない
- webview内で実行が必要な処理は `src/preload/webviewPreload.ts` に置き、renderer からは `chm:*` チャンネルで指示する
- ストレージアクセスは main process の `storage:*` IPC 経由のみ
- UIテキストは日本語で統一
