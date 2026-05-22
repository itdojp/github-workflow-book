# merge queue 対応のCI最小例

この例は、GitHub の merge queue を有効にしたリポジトリで、必須チェック（required status checks）を
満たすために GitHub Actions を `pull_request` と `merge_group` の両方で起動する構成を示します。

- 参照（公式）:
  - merge queue: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
  - `merge_group` イベント: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group

## 含まれるファイル

- `.github/workflows/ci.yml`: `pull_request` と `merge_group` の双方で起動するワークフロー

## 使い方（例）

1. `.github/workflows/ci.yml` を対象リポジトリへコピーします。
2. rulesets / branch protection で、このワークフローのチェック名を「必須チェック」として要求します。
3. merge queue を有効化します。

## 運用チェック

- [ ] `pull_request` と `merge_group` の両方で同じ check 名が成功する
- [ ] merge queue に入れる前に review thread が 0 件である
- [ ] 失敗時に queue から外れた理由を PR / Issue に記録する
- [ ] Secrets や deploy は fork PR / merge_group イベントの信頼境界に合わせて job を分離する

このサンプルは「トリガー設計」を示すための最小構成です。実プロジェクトでは `Run checks` を実際のテスト/静的解析/セキュリティ検査に置き換えてください。
