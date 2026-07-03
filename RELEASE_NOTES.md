# Release Notes — Chamaeleon Browser (PC)

> 運用ルール: リリースごとに**このファイルの先頭へ追記**し、GitHub Release と
> Awokelaプロダクトページ（awokela.com/products/chamaeleon-browser/ のRelease Notesセクション）にも同じ内容を反映する。
> 手順の詳細は docs/UPDATE_PROTOCOL.md を参照。

## v0.1.0 (2026-07-03)

初回リリース（MVP）。

### ブラウザ基本機能
- タブ・URLバー・戻る/進む/更新/停止・DevTools
- ブックマーク（☆トグル＋一覧）
- 閲覧履歴（自動記録・検索・全消去、最大5000件）
- ダウンロード管理（進捗表示・ファイルを開く・フォルダで表示）
- ホームページ設定・ユーザーエージェント設定

### Chamaeleon 中核機能
- **Site Profile**: URL / ドメイン / パス / ワイルドカード / 正規表現でページ毎の設定を保存
- **CSS Patch**: 登録ページ訪問時に自動注入（isolated worldでCSPの影響を受けない）
- **JS Patch**: 自動実行＋手動実行、実行タイミング（start / end / idle / manual）
- **DOM Rule**: コード不要の要素操作9種（非表示・削除・強調・置換・クラス追加・style・移動・クリック・入力）、要素出現待ち対応
- **Automation Recorder**: クリック・入力・スクロールを記録→マクロ保存→再生。onPageLoad / onUrlMatch / onElementAppear トリガーで自動実行
- SPAのURL変化検知とプロファイル再評価
- 実行ログ・ページ毎メモ・改修メモ（CSV出力＋AIプロンプト生成）

### 対応プラットフォーム
- macOS (Apple Silicon) — dmg / zip
- Windows x64 — インストーラ(exe) / zip
- Linux x64 — AppImage / deb
