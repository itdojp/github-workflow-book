# タグ起点のリリース自動化（最小例）

この例は、タグ push をトリガーに **GitHub Release を自動作成**し、成果物を添付する最小構成です。

## 含まれるファイル

- `.github/workflows/release.yml`

## 使い方（例）

1. `.github/workflows/release.yml` を対象リポジトリへコピーします。
2. `tags: ["v*"]` のパターンを運用ルールに合わせます。
3. 生成する成果物（`dist.tgz`）の中身を実プロジェクトに合わせて置き換えます。
4. `git tag v1.0.0` → `git push --tags` で動作確認します。

## 注意

- `gh release create` は `GITHUB_TOKEN` を利用します。Release作成には `permissions: contents: write` が必要になることがあります。
- fork PR など不特定入力の実行では、公開系処理を走らせない設計に分離してください。

