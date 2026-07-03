# FILE_STRUCTURE

## リポジトリ構成

```
chamaeleon-browser/
  desktop/                 # Electron + React + TS (Windows/macOS/Linux)
    src/
      main/main.ts         # main process: ウィンドウ管理・JSONストレージIPC・UA設定
      preload/preload.ts   # renderer(UI)用ブリッジ (window.chamaeleon)
      preload/webviewPreload.ts  # ★中核: webview内で動くパッチ適用エンジン+レコーダー+再生
      renderer/
        App.tsx            # タブ管理・ナビバー・webview配線・パッチ適用トリガー
        components/SitePanel.tsx   # プロファイル/CSS/JS/DOM/マクロ/メモ/ログ編集UI
        components/DevReports.tsx  # 改修メモ (CSV出力・AIプロンプト生成)
      shared/types.ts      # ★データモデルの原典 + URLマッチ関数 (matchesProfile)
    tsconfig.json          # renderer用 (noEmit)
    tsconfig.electron.json # main/preload用 (CJS, dist-electron/へ出力)
    vite.config.ts         # renderer ビルド
    electron-builder.yml   # mac/win パッケージング
  ios/                     # SwiftUI + WKWebView (iPhone/iPad)
    project.yml            # xcodegen 定義
    Chamaeleon/
      ChamaeleonApp.swift
      Models.swift         # SiteProfile等 Codable (desktop/shared/types.ts と同期)
      BrowserView.swift    # WKWebView + PatchEngine (CSS/JS/DOMルール注入)
      ContentView.swift    # URLバー・ナビ・🦎バッジ
      SitePanelView.swift  # プロファイル/パッチ/ルール/メモ編集
  docs/                    # 本ドキュメント群
  .github/
    workflows/ci.yml       # PR毎: desktop typecheck+build
    copilot-instructions.md
```

## 責務のルール

- **データモデルは `desktop/src/shared/types.ts` が原典**。変更したら `ios/Chamaeleon/Models.swift` と `docs/DATA_MODEL.md` を同時に更新する。
- webview内で実行が必要なもの（DOM操作・記録・再生）は `webviewPreload.ts` に置く。renderer からは `webview.send('chm:*')` で指示する。
- ストレージはすべて main process の IPC (`storage:load` / `storage:save` / `storage:appendLog`) を経由する。renderer から直接 fs には触れない。

## 命名規則

- IPCチャンネル: `storage:*`（main⇔renderer）、`chm:*`（renderer⇔webview preload）
- データファイル: `userData/data/profiles/site-profiles.json` ほか（DATA_MODEL.md 参照）
