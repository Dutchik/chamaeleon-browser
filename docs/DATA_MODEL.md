# DATA_MODEL

**原典は `desktop/src/shared/types.ts`。** iOS版 `ios/Chamaeleon/Models.swift` は同一構造のCodable。
どちらかを変更したら必ず両方＋本ドキュメントを更新すること。

## エンティティ一覧

| 型 | 役割 | Desktop | iOS |
|---|---|---|---|
| `SiteProfile` | URL/ドメイン毎の設定単位 | ✅ | ✅ |
| `CssPatch` | 自動注入CSS | ✅ | ✅ |
| `JsPatch` | 自動実行JS | ✅ | ✅ |
| `DomRule` | ノーコードDOM操作 | ✅ | ✅ |
| `AutomationMacro` / `AutomationStep` / `AutomationTrigger` | 記録マクロ | ✅ | ⬜ 未実装(Phase M2) |
| `SiteNote` | ページ毎メモ | ✅ | ✅ |
| `ExecutionLog` | 実行ログ | ✅ | ⬜ |
| `DevReport` | 改修メモ | ✅ | ⬜ |
| `RecordedEvent` | レコーダー生イベント | ✅ | — |

各フィールドは `desktop/src/shared/types.ts` の TypeScript interface を参照（MASTER_SPEC §5〜§13,§16 と一致）。

## URLマッチ仕様（両プラットフォーム共通）

- `exact`: 文字列完全一致
- `domain`: hostname が一致、または `.pattern` で終わる（サブドメイン含む）
- `path` / `wildcard`: `*` を `.*` に変換した正規表現で全体一致
- `regex`: パターンをそのまま正規表現として評価（部分一致）
- パターンが空 / プロファイル無効 / 不正な正規表現 → マッチしない

実装: TS `matchesProfile()` / Swift `SiteProfile.matches(_:)`

## ID / 日付

- id: ランダム英数字（TS）/ UUID文字列（Swift）。形式は不問、一意であればよい
- createdAt / updatedAt: ISO8601 文字列
