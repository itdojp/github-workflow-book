# OIDC（短命クレデンシャル）でAWS STSを呼ぶ最小例

この例は、GitHub Actions の **OIDC** を使ってAWSの role を引き受け、`sts:GetCallerIdentity` を実行する最小構成です。

## 含まれるファイル

- `.github/workflows/aws-oidc-sts.yml`

## 前提

- AWS 側で OIDC provider（`token.actions.githubusercontent.com`）を作成済み
- `sts:AssumeRoleWithWebIdentity` を許可する role を作成済み
- role の trust policy で `aud`/`sub` 等を絞り込む（値は環境依存のため、過度に広げない）

## 使い方（例）

1. `.github/workflows/aws-oidc-sts.yml` を対象リポジトリへコピーします。
2. `role-to-assume` / `aws-region` のプレースホルダを自分の環境に合わせて置き換えます。
3. Actions の `workflow_dispatch` で実行し、`get-caller-identity` の出力を確認します。

## 注意

- OIDC を使うには `permissions: id-token: write` が必要です。
- fork PR など不特定入力の実行では、クラウド操作を走らせない設計に分離してください。

