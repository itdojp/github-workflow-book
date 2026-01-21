# AI協働の「品質ゲート」ワークフロー最小例

この例は、AI生成PRを含む開発で「品質ゲート（必須チェック）」を安定運用するための GitHub Actions 最小構成です。

ポイント:
- PR の検証（`pull_request`）だけでなく、merge queue を使う場合に必要になる `merge_group` にも対応します。
- 「AI利用の開示」を PR テンプレートで固定し、CI 側でも最低限の検査（例: 欄の存在確認）を行う設計例を示します。

参考（公式）:
- merge queue: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- `merge_group` イベント: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group

## 含まれるファイル
- `.github/workflows/ai-collaboration-quality-gate.yml`

## 使い方（例）
1. このフォルダ配下の `.github/workflows/ai-collaboration-quality-gate.yml` を対象リポジトリへコピーします。
2. rulesets / branch protection で、このワークフローのチェック名を必須チェック（required status checks）として要求します。
3. `Run checks` を、実プロジェクトのテスト/静的解析/セキュリティ検査に置き換えます。

このサンプルは「トリガー設計」と「最小の品質ゲート構造」を示すことを目的としています。組織のポリシーやリポジトリ事情に合わせて調整してください。
