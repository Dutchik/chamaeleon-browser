# Copilot Instructions — Chamaeleon Browser

このリポジトリは「Webページ毎にCSS/JS/DOM操作/自動化マクロを登録し再訪問時に自動適用するカスタムブラウザ」です。

## 必読ドキュメント（実装前に必ず読む）

1. `docs/MASTER_SPEC.md` — 全体仕様の原典。機能の意味・データ構造・フェーズ計画はすべてここ
2. `docs/FILE_STRUCTURE.md` — どこに何を書くか
3. `docs/UPDATE_PROTOCOL.md` — 変更手順（データモデルはTS原典→Swift→docsの順で同期）

## 構成

- `desktop/` — Electron + React + TypeScript + Vite（Windows/macOS/Linux）
- `ios/` — SwiftUI + WKWebView（xcodegen。`ios/project.yml` から `.xcodeproj` を生成）
- データモデルの原典は `desktop/src/shared/types.ts`

## 検証コマンド（PR前に必ず通すこと）

```bash
cd desktop && npm install && npm run typecheck && npm run build
```

iOSを変更した場合（macOSランナーのみ）:

```bash
cd ios && xcodegen generate && \
xcodebuild -project Chamaeleon.xcodeproj -scheme Chamaeleon -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' build
```

## 守るべきルール

- MASTER_SPEC §14（セキュリティ）: 全サイト一括適用の既定化、パスワード値の記録、CAPTCHA回避、外部送信は実装しない
- webview内で実行が必要な処理は `desktop/src/preload/webviewPreload.ts` に置き、renderer からは `chm:*` チャンネルで指示する
- ストレージアクセスは main process の `storage:*` IPC 経由のみ
- UIテキストは日本語で統一
