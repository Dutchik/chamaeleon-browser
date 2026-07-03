# LOCAL_STORAGE_SCHEMA

## Desktop（Electron）

保存場所: `app.getPath('userData')/data/`

| ファイル | 内容 | 形式 |
|---|---|---|
| `profiles/site-profiles.json` | `SiteProfile[]` | JSON, 2-space indent |
| `logs/execution-log.json` | `ExecutionLog[]`（新しい順、最大5000件） | JSON |
| `reports/dev-reports.json` | `DevReport[]` | JSON |
| `settings.json` | `{ userAgent?, homepage? }` | JSON |

アクセスは main process の IPC のみ:
- `storage:load(key)` → 読み込み（無ければ `[]` / `{}`）
- `storage:save(key, value)` → 全置換保存
- `storage:appendLog(entry)` → 先頭追記＋5000件切り詰め

## iOS

保存場所: `Documents/chamaeleon-profiles.json`（`SiteProfile[]`、JSONEncoder標準形式）

## マイグレーション方針

- フィールド追加は optional（TS: `?` / Swift: デフォルト値付き）で行い、旧JSONをそのまま読めるようにする
- 破壊的変更が必要な場合は `schemaVersion` フィールドをトップに導入してから行う（現状は未導入 = v0）
