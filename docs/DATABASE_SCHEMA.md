# DATABASE_SCHEMA

現状は全データJSON（LOCAL_STORAGE_SCHEMA.md 参照）。
実行ログが肥大した場合に SQLite 化する際のテーブル定義案。

```sql
CREATE TABLE execution_log (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  patch_id TEXT,
  automation_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('css','js','dom','automation')),
  status TEXT NOT NULL CHECK (status IN ('success','error','skipped')),
  message TEXT,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_log_profile ON execution_log(profile_id, created_at DESC);
CREATE INDEX idx_log_created ON execution_log(created_at DESC);
```

プロファイル本体は編集頻度が低くサイズも小さいためJSONのままとする。
