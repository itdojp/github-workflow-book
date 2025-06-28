# デプロイメントガイド

このドキュメントでは、テンプレートリポジトリからパブリックリポジトリへのデプロイプロセスについて詳しく説明します。

## 概要

本プロジェクトでは、GitHub Actions を使用して、テンプレートリポジトリの main ブランチへのプッシュ時に自動的にパブリックリポジトリへデプロイします。

## 前提条件

1. **リポジトリのセットアップ**
   - テンプレートリポジトリ: `yourusername/book-publishing-template`
   - パブリックリポジトリ: `yourusername/book-publishing-template-public`

2. **必要な権限**
   - テンプレートリポジトリへの Write アクセス
   - パブリックリポジトリへの Write アクセス（DEPLOY_TOKEN 経由）

3. **GitHub Pages の設定**
   - パブリックリポジトリで GitHub Pages が有効化されている
   - gh-pages ブランチからデプロイするよう設定

## 初期セットアップ

### 新規プロジェクトでの準備

#### 1. パブリックリポジトリの作成

1. GitHubで新しいパブリックリポジトリを作成
2. README.mdのみで初期化（Initialize this repository with a READMEをチェック）
3. gh-pagesブランチを作成：
   ```bash
   git clone https://github.com/YOUR_USERNAME/your-public-repo.git
   cd your-public-repo
   git checkout -b gh-pages
   git push origin gh-pages
   ```

#### 2. テンプレートリポジトリの準備

プロジェクトに応じた最小限の`package.json`を作成：

```json
{
  "name": "book-publishing-template",
  "version": "1.0.0",
  "scripts": {
    "build": "node scripts/build.js"
  },
  "dependencies": {}
}
```

#### 3. ディレクトリ構造の作成

```bash
mkdir -p .github/workflows
```

## セットアップ手順

### 1. Personal Access Token の作成

1. GitHub の Settings > Developer settings > Personal access tokens > Tokens (classic) へアクセス
2. "Generate new token" をクリック
3. 以下の設定でトークンを作成：
   - **Note**: `Deploy to public repo`
   - **Expiration**: 適切な期限を設定（推奨: 90日）
   - **Scopes**:
     - `repo` (Full control of private repositories)
     - `workflow` (Update GitHub Action workflows) ※必要に応じて

これでテンプレートリポジトリからパブリックリポジトリへのデプロイが自動化されます。