# UPDATE_PROTOCOL

機能追加・修正時の手順。AIエージェント（Copilot coding agent / Claude / Codex）もこの手順に従うこと。

1. **仕様確認**: `docs/MASTER_SPEC.md` の該当セクションを読む。仕様にない機能は Issue で合意してから実装する
2. **データモデル変更がある場合**:
   - `src/shared/types.ts` を先に変更（原典）
   - iOSリポジトリ（chamaeleon-browser-ios）の `Chamaeleon/Models.swift` を同じ構造に更新（Issueを立てて連携）
   - `docs/DATA_MODEL.md` / `docs/LOCAL_STORAGE_SCHEMA.md` を更新
   - 旧JSONが読めること（optionalフィールド追加のみ）を確認
3. **実装**: FILE_STRUCTURE.md の責務分担に従う。webview内で動くものは `webviewPreload.ts` に置く
4. **検証**（必須・CIも同じ）:
   - `npm run typecheck && npm run build`
5. **セキュリティ確認**: MASTER_SPEC §14 に反していないか（全サイト適用の既定化・パスワード記録・外部送信の禁止）
6. **PR**: 変更点 / 仕様該当セクション / 検証コマンドの結果を本文に書く

## リリース手順（機能追加・修正を公開するとき）

1. `package.json` の `version` を上げる
2. **`RELEASE_NOTES.md` の先頭に新バージョンの節を追記**（日付＋変更点。ユーザー向けの言葉で）
3. 配布物をビルド:
   `npm run build && npx electron-builder --mac --arm64 && npx electron-builder --win --x64 && npx electron-builder --linux --x64`
4. GitHub Release を作成し、`release/` の dmg / exe / AppImage / deb / zip を添付:
   `gh release create vX.Y.Z release/ChamaeleonBrowser-* --title "vX.Y.Z" --notes-file <(該当節を抜粋)`
5. **Awokelaプロダクトページに追記**: `awokela.com/products/chamaeleon-browser/` の
   Release Notes セクション（`<!-- RELEASE_NOTES:APPEND_HERE -->` マーカーの直後）に同じ内容を追加し、
   ダウンロードリンクのバージョンを更新してデプロイする
   （ローカルミラー: `/Users/sr/product/StudyB/deploy/awokela-existing/products/chamaeleon-browser/index.html` → onamaeへSSHアップロード）
