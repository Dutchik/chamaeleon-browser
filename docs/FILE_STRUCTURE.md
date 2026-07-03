# FILE_STRUCTURE

## リポジトリ構成

このリポジトリはPC版（Windows/macOS/Linux）。iOS版は別リポジトリ
[chamaeleon-browser-ios](https://github.com/Dutchik/chamaeleon-browser-ios)。

```
chamaeleon-browser/
  src/
      main/main.ts         # main process: ウィンドウ管理・JSONストレージIPC・UA設定
      preload/preload.ts   # renderer(UI)用ブリッジ (window.chamaeleon)
      preload/webviewPreload.ts  # ★中核: webview内で動くパッチ適用エンジン+レコーダー+再生
      renderer/
        App.tsx            # タブ管理・ナビバー・webview配線・パッチ適用トリガー
        components/SitePanel.tsx   # プロファイル/CSS/JS/DOM/マクロ/メモ/ログ編集UI
        components/DevReports.tsx  # 改修メモ (CSV出力・AIプロンプト生成)
      shared/types.ts      # ★データモデルの原典 + URLマッチ関数 (matchesProfile)
  tsconfig.json            # renderer用 (noEmit)
  tsconfig.electron.json   # main/preload用 (CJS, dist-electron/へ出力)
  vite.config.ts           # renderer ビルド
  electron-builder.yml     # mac/win/linux パッケージング
  docs/                    # 本ドキュメント群
  .github/
    workflows/ci.yml       # push/PR毎: ubuntu/macos/windows で typecheck+build
    copilot-instructions.md
```

## 責務のルール

- **データモデルは `src/shared/types.ts` が原典**。変更したら iOS リポジトリの `Chamaeleon/Models.swift` と `docs/DATA_MODEL.md`（両リポジトリ）を同時に更新する。
- webview内で実行が必要なもの（DOM操作・記録・再生）は `webviewPreload.ts` に置く。renderer からは `webview.send('chm:*')` で指示する。
- ストレージはすべて main process の IPC (`storage:load` / `storage:save` / `storage:appendLog`) を経由する。renderer から直接 fs には触れない。

## 命名規則

- IPCチャンネル: `storage:*`（main⇔renderer）、`chm:*`（renderer⇔webview preload）
- データファイル: `userData/data/profiles/site-profiles.json` ほか（DATA_MODEL.md 参照）
