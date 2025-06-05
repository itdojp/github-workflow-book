# デプロイメントガイド

このドキュメントでは、プライベートリポジトリからパブリックリポジトリへのデプロイプロセスについて詳しく説明します。

## 概要

本プロジェクトでは、GitHub Actions を使用して、プライベートリポジトリの main ブランチへのプッシュ時に自動的にパブリックリポジトリへデプロイします。

## 前提条件

1. **リポジトリのセットアップ**
   - プライベートリポジトリ: `itdojp/theoretical-computer-science-textbook-private`
   - パブリックリポジトリ: `itdojp/theoretical-computer-science-textbook`

2. **必要な権限**
   - プライベートリポジトリへの Write アクセス
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

#### 2. プライベートリポジトリの準備

プロジェクトに応じた最小限の`package.json`を作成：

**本教科書プロジェクトの場合：**
```json
{
  "name": "theoretical-computer-science-textbook",
  "version": "1.0.0",
  "scripts": {
    "build": "node scripts/build.js"
  },
  "dependencies": {}
}
```

**他の静的サイトジェネレーターの場合：**
- VitePress: `vitepress build`でビルド、`dist/`に出力
- Hugo: `hugo`コマンドでビルド、`public/`に出力
- Next.js Static Export: `next build && next export`でビルド、`out/`に出力

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
4. 生成されたトークンをコピー（この画面を離れると二度と表示されません）

### 2. GitHub Secrets の設定

1. プライベートリポジトリの Settings > Secrets and variables > Actions へアクセス
2. "New repository secret" をクリック
3. 以下の情報を入力：
   - **Name**: `DEPLOY_TOKEN`
   - **Value**: 先ほどコピーしたトークン
4. "Add secret" をクリック

### 3. ワークフローファイルの設定

プライベートリポジトリの `.github/workflows/deploy-to-public.yml` ファイルを作成：

```yaml
name: Deploy to Public Repository

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout private repository
      uses: actions/checkout@v4
      with:
        path: private

    - name: Checkout public repository
      uses: actions/checkout@v4
      with:
        repository: YOUR_GITHUB_USERNAME/your-public-repo  # 要変更
        token: ${{ secrets.DEPLOY_TOKEN }}
        path: public
        ref: gh-pages

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install dependencies
      run: |
        cd private
        npm ci

    - name: Build
      run: |
        cd private
        npm run build

    - name: Copy build files to public repository
      run: |
        # 既存のファイルを削除（.gitと特定のファイルを除く）
        cd public
        find . -mindepth 1 -not -path './.git*' -not -name 'CNAME' -not -name '.nojekyll' -delete
        
        # ビルド結果をコピー（VitePressの場合）
        cp -r ../private/dist/* .
        
        # 他の静的サイトジェネレーターの場合は以下のように変更：
        # Hugo: cp -r ../private/public/* .
        # Jekyll: cp -r ../private/_site/* .
        # Next.js: cp -r ../private/out/* .
        
        # 必要なファイルをコピー
        if [ -f ../private/README.md ]; then
          cp ../private/README.md .
        fi
        if [ -f ../private/LICENSE ]; then
          cp ../private/LICENSE .
        fi
        
        # GitHub Pages用のファイルが存在しない場合は作成
        if [ ! -f .nojekyll ]; then
          touch .nojekyll
        fi

    - name: Deploy to public repository
      run: |
        cd public
        git config user.name "GitHub Actions"
        git config user.email "actions@github.com"
        git add -A
        git diff --staged --quiet || (git commit -m "Deploy from private repository: ${{ github.sha }}" && git push)
```

## デプロイプロセス

### 自動デプロイ

1. プライベートリポジトリの main ブランチに変更をプッシュ
2. GitHub Actions が自動的に起動
3. 以下の処理が実行される：
   - プライベートリポジトリのチェックアウト
   - 依存関係のインストール
   - ビルドの実行
   - パブリックリポジトリへのファイルコピー
   - 変更のコミットとプッシュ

### 手動デプロイ

必要に応じて、GitHub Actions のページから手動でワークフローを実行することも可能です：

1. プライベートリポジトリの Actions タブへアクセス
2. "Deploy to Public Repository" ワークフローを選択
3. "Run workflow" をクリック
4. ブランチを選択（通常は main）
5. "Run workflow" をクリック

## ビルド設定

### ビルドコマンド

プロジェクトタイプ別のビルドコマンド例：

**VitePress:**
```json
{
  "scripts": {
    "build": "vitepress build",
    "preview": "vitepress preview"
  }
}
```

**Hugo:**
```toml
# config.toml
baseURL = "https://YOUR_USERNAME.github.io/your-repo/"
```

**Jekyll:**
```yaml
# _config.yml
baseurl: "/your-repo"
```

### ビルド出力ディレクトリ

| ジェネレーター | デフォルト出力ディレクトリ |
|--------------|------------------------|
| VitePress | `dist/` |
| Hugo | `public/` |
| Jekyll | `_site/` |
| Next.js | `out/` |
| Gatsby | `public/` |

## デプロイ対象ファイル

### 自動的にコピーされるファイル

- ビルド出力ディレクトリ内のすべてのファイル
- `README.md`（存在する場合）
- `LICENSE`（存在する場合）
- `assets/`ディレクトリ（favicon画像を含む）
- `_config.yml`（Jekyll設定）
- `_layouts/`ディレクトリ（テンプレート）

### 保持されるファイル

以下のファイルはパブリックリポジトリ側で管理され、デプロイ時に削除されません：

- `CNAME`（カスタムドメイン設定）
- `.nojekyll`（Jekyll処理のスキップ）
- `.git/`（Gitの履歴）

### 著作権表示

デプロイ時に、すべてのページに以下の著作権表示が含まれることを確認してください：

```
Copyright (c) 2025 ITdo Japan, Inc. All rights reserved.
```

## トラブルシューティング

### 初回デプロイ時の問題

1. **エラー: failed to push refs to**
   - gh-pagesブランチが存在しない可能性
   - 解決方法：パブリックリポジトリでgh-pagesブランチを手動作成

2. **エラー: npm ci can only install packages with an existing package-lock.json**
   - package-lock.jsonがコミットされていない
   - 解決方法：`npm install`を実行してpackage-lock.jsonを生成し、コミット

3. **GitHub Pagesが404エラー**
   - GitHub Pagesの設定確認
   - gh-pagesブランチが選択されているか確認
   - index.htmlが存在するか確認

### デプロイが失敗する場合

1. **エラー: Permission denied**
   - DEPLOY_TOKEN が正しく設定されているか確認
   - トークンに `repo` スコープがあるか確認
   - トークンの有効期限が切れていないか確認

2. **エラー: Build failed**
   - ローカルでビルドが成功するか確認
   - `npm ci` と `npm run build` を実行してエラーを確認

3. **変更が反映されない**
   - GitHub Pages のデプロイ状況を確認
   - ブラウザのキャッシュをクリア
   - パブリックリポジトリの gh-pages ブランチに変更がコミットされているか確認

### ログの確認方法

1. プライベートリポジトリの Actions タブへアクセス
2. 該当するワークフローの実行を選択
3. 各ステップをクリックして詳細ログを確認

## チェックリスト

新規プロジェクトでの導入時は、以下の項目を確認してください：

- [ ] パブリックリポジトリを作成済み
- [ ] gh-pagesブランチを作成済み
- [ ] GitHub Pagesを有効化済み
- [ ] Personal Access Tokenを作成済み
- [ ] DEPLOY_TOKENをSecretsに設定済み
- [ ] .github/workflows/deploy-to-public.ymlを作成済み
- [ ] ワークフロー内のリポジトリ名を変更済み
- [ ] ビルドコマンドを確認済み
- [ ] ビルド出力ディレクトリを確認済み
- [ ] 初回デプロイをテスト済み

## ベストプラクティス

1. **コミットメッセージ**
   - 明確で簡潔なメッセージを使用
   - 大きな変更の場合は詳細な説明を含める

2. **ブランチ戦略**
   - feature ブランチで開発
   - プルリクエストを通じて main にマージ
   - main ブランチは常にデプロイ可能な状態を保つ

3. **テスト**
   - デプロイ前にローカルでビルドとプレビューを確認
   - リンクチェッカーを定期的に実行

4. **セキュリティ**
   - トークンは定期的に更新
   - 不要な権限は付与しない
   - シークレットは GitHub Secrets でのみ管理

## Jekyll設定の注意点

### 必須設定

1. **_config.yml**
   - baseurlを正しく設定: `/theoretical-computer-science-textbook-public`
   - remote_themeを使用（themeとの競合を避ける）
   - GitHub Pagesでサポートされているプラグインのみ使用

2. **_layouts/default.html**
   - Mermaid v10.6.1以上を使用
   - DOMContentLoadedイベントでMermaidを初期化
   - language-mermaidクラスのコードブロックを処理

3. **Liquid構文の回避**
   - 数式表記で`{{u, v}}`の代わりに`{(u, v)}`を使用
   - Mermaidダイアグラム内で`{{}}`を`[]`に変更

4. **favicon設定**
   - 画像ファイル: `assets/images/itdo_logo_48x48_blue.png`
   - _layouts/default.htmlで以下のように設定:
     ```html
     <link rel="icon" type="image/png" sizes="48x48" href="{{ '/assets/images/itdo_logo_48x48_blue.png' | relative_url }}">
     <link rel="shortcut icon" type="image/png" href="{{ '/assets/images/itdo_logo_48x48_blue.png' | relative_url }}">
     ```

## 関連リソース

- [GitHub Actions ドキュメント](https://docs.github.com/actions)
- [GitHub Pages ドキュメント](https://docs.github.com/pages)
- [VitePress ドキュメント](https://vitepress.dev/)
- [Hugo ドキュメント](https://gohugo.io/)
- [Jekyll ドキュメント](https://jekyllrb.com/)

## 組織情報

- **組織名**: 株式会社アイティードゥ (ITDO Inc.)
- **GitHub組織**: itdojp
- **連絡先**: knowledge@itdo.jp