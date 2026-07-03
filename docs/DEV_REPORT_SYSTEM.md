# DEV_REPORT_SYSTEM

改修メモ（MASTER_SPEC §16）の実装仕様。

## UI

- ナビバー右端の 📝 ボタンでオーバーレイを開閉（`desktop/src/renderer/components/DevReports.tsx`）
- 項目: status (todo/doing/done/hold), priority (low/medium/high/critical), タイトル, 本文
- フィルタ: status別
- CSV書き出し: `dev-reports.csv`（id,title,body,status,priority,tags,createdAt）

## AIプロンプト生成

各メモの 🤖 ボタンで以下の形式をクリップボードにコピーする:

```
# Chamaeleon Browser 改修依頼
## タイトル / 内容 / 優先度 / (関連ファイル)
## 指示
上記の改修を実装してください。docs/MASTER_SPEC.md の仕様に従うこと。
```

生成したプロンプトは GitHub Issue に貼って Copilot coding agent に割り当てる、
または Claude Code / Codex に直接渡す運用を想定。

## 保存

`userData/data/reports/dev-reports.json`（DevReport[]）
