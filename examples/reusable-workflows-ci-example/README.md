# Reusable workflows（workflow_call）でCIを再利用する最小例

この例は、GitHub Actions の **Reusable workflow**（`workflow_call`）を使って、CIをジョブ単位で再利用する構成を示します。

- 呼び出し先（再利用される側）：`.github/workflows/reusable-ci.yml`
- 呼び出し側：`.github/workflows/ci.yml`

## 含まれるファイル

- `.github/workflows/reusable-ci.yml`
- `.github/workflows/ci.yml`

## 使い方（例）

1. 上記2ファイルを、対象リポジトリの `.github/workflows/` にコピーします。
2. `node-version` などの入力値をプロジェクトに合わせて調整します。
3. branch protection / rulesets / merge queue を使う場合は、必要なイベント（`pull_request`/`merge_group`）で起動するようにします。

## 注意

- Reusable workflow は「呼び出し側の設計（権限/Secrets/トリガー）」の影響を受けます。`permissions:` を明示し、最小権限を基本にしてください。
- fork PR では Secrets が渡らないため、Secrets/外部操作が必要な処理は実行経路を分離してください。

