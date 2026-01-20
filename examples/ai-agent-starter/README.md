# ai-agent-starter（サンプル：Issue→Agent→PR→レビュー）

このディレクトリは、Copilot coding agent を前提にした「そのまま使える最小の `.github/` 一式」を同梱するサンプルです。

## 目的

- Issueに仕様（受入条件/制約/テスト）を書き、Agentに割り当ててPRを作らせる
- PRテンプレで「AI利用の開示」と「人間の検証責任」を固定する
- `copilot-instructions.md` とチェックリストで、レビュー観点のブレを抑える

## 含まれるもの

- `.github/ISSUE_TEMPLATE/agent-task.yml`：Agentに割り当てやすいIssueテンプレ
- `.github/PULL_REQUEST_TEMPLATE.md`：AI利用開示と検証のテンプレ
- `.github/copilot-instructions.md`：リポジトリ規約とレビュー観点（チェックリスト参照）
- `security-checklist.md`：セキュリティ観点の最小チェックリスト

## 使い方（コピー）

1. 自分のリポジトリに `.github/` と `security-checklist.md` をコピーします。
2. `copilot-instructions.md` の「プロジェクト固有の手順（ビルド/テスト/禁止事項）」を追記します。
3. Issue作成時に `agent-task.yml` を使い、Copilot coding agent に割り当てます。

注意：Copilot機能の利用可否・UI・権限はプランや組織ポリシーで変わります。公式ドキュメントも併せて参照してください。
