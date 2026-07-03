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
