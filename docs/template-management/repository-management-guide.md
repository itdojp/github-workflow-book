# リポジトリ管理ガイド

このドキュメントでは、書籍テンプレートプロジェクトのリポジトリ管理方法について説明します。

## プロジェクト情報

| 項目 | 値の例 |
|------|--------|
| GitHubのユーザー名または組織名 | `yourusername` |
| 連絡先メールアドレス | `knowledge@itdo.jp` |
| 組織名 | `ITDO Inc.` |

## リポジトリ構成

本プロジェクトは以下の2つのリポジトリで構成されています：

1. **テンプレートリポジトリ** (`book-publishing-template`)
   - 執筆・編集作業用
   - ドラフトや未完成のコンテンツを含む
   - 限定されたメンバーのみアクセス可能

2. **パブリックリポジトリ** (`book-publishing-template-public`)
   - 完成したコンテンツの公開用
   - 誰でも閲覧・利用可能
   - テンプレートリポジトリから自動デプロイ

## 著作権とライセンス

### 著作権表示

公開リポジトリには以下の著作権表示を必ず含めてください：

```
Copyright (c) 2025 ITDO Inc. All rights reserved.
```

### ライセンス

- テンプレートリポジトリ：All Rights Reserved（執筆中のコンテンツ保護のため）
- パブリックリポジトリ：Creative Commons Attribution 4.0 International (CC BY 4.0)

デプロイ時に、適切なLICENSEファイルが自動的にコピーされます。

## リポジトリ設定

### テンプレートリポジトリの設定

1. **アクセス権限**
   - Settings > Manage access で適切なメンバーを追加
   - 執筆者には Write 権限を付与
   - レビュアーには Read 権限を付与

2. **ブランチ保護**
   - main ブランチに保護ルールを設定
   - プルリクエストを必須に
   - レビューを必須に（可能であれば）

3. **シークレットの設定**
   - `DEPLOY_TOKEN`: パブリックリポジトリへのデプロイ用
   - Settings > Secrets and variables > Actions で設定

### パブリックリポジトリの設定

1. **GitHub Pages の有効化**
   - Settings > Pages
   - Source: Deploy from a branch
   - Branch: gh-pages / (root)
   - Custom domain: 必要に応じて設定

2. **アクセス設定**
   - パブリックリポジトリとして設定
   - Issues や Discussions を必要に応じて有効化

3. **重要なファイル**
   - `CNAME`: カスタムドメインを使用する場合
   - **注意**: `.nojekyll`ファイルは作成しない（Jekyll処理が必要なため）

4. **favicon設定**
   - ファイル名: `favicon.png`
   - 配置場所: `/assets/images/`
   - _layouts/default.htmlで適切に参照

## Git設定

新しいリポジトリをクローンした際は、以下のようにGit設定を行います：

```bash
git config user.name "Your Name"
git config user.email "knowledge@itdo.jp"
```

組織のプロジェクトの場合は、組織のメールアドレス（`knowledge@itdo.jp`）を使用することを推奨します。

## ワークフロー管理

### 継続的インテグレーション (CI)

テンプレートリポジトリでは以下のワークフローが動作します：

- **ビルドテスト**: プルリクエスト時に自動実行

これでリポジトリ管理が効率的に行えます。