# デプロイメントガイド

このドキュメントでは、プライベートリポジトリからパブリックリポジトリへのデプロイプロセスについて詳しく説明します。

## 概要

本プロジェクトでは、GitHub Actions を使用して、プライベートリポジトリの main ブランチへのプッシュ時に自動的にパブリックリポジトリへデプロイします。

## 前提条件

1. **リポジトリのセットアップ**
   - プライベートリポジトリ: `itdojp/github-workflow-book_private`
   - パブリックリポジトリ: `itdojp/github-workflow-book_public`

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
   git clone https://github.com/itdojp/github-workflow-book_public.git
   cd github-workflow-book_public
   git checkout -b gh-pages
   git push origin gh-pages
   ```

#### 2. プライベートリポジトリの準備

本プロジェクトは純粋なMarkdownファイルの構成のため、ビルドプロセスは不要です。
そのため、`package.json`の作成も不要で、Markdownファイルを直接パブリックリポジトリにコピーします。

#### 3. ディレクトリ構造の作成

```bash
mkdir -p .github/workflows
mkdir -p _layouts
mkdir -p assets/images
```

## セットアップ手順

### 1. Personal Access Token の作成

1. GitHub の Settings > Developer settings > Personal access tokens > Tokens (classic) へアクセス
2. "Generate new token" をクリック
3. 以下の設定でトークンを作成：
   - **Note**: `Deploy to github-workflow-book_public`
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
        repository: itdojp/github-workflow-book_public
        token: ${{ secrets.DEPLOY_TOKEN }}
        path: public
        ref: gh-pages

    # Markdownプロジェクトのため、Node.jsセットアップとビルドは不要

    - name: Copy files to public repository
      run: |
        # 既存のファイルを削除（.gitと特定のファイルを除く）
        cd public
        find . -mindepth 1 -not -path './.git*' -not -name 'CNAME' -delete
        
        # Jekyll設定ファイルをコピー
        if [ -f ../private/_config.yml ]; then
          cp ../private/_config.yml .
        fi
        
        # README.mdをindex.mdとしてコピー（Jekyll用front matterを追加）
        if [ -f ../private/README.md ]; then
          echo "---" > ./index.md
          echo "layout: default" >> ./index.md
          echo "title: Home" >> ./index.md
          echo "---" >> ./index.md
          echo "" >> ./index.md
          cat ../private/README.md >> ./index.md
        fi
        
        # 他のMarkdownファイルをコピー（README.md以外）
        find ../private -name "*.md" -not -name "README.md" -exec cp {} . \;
        
        # レイアウトファイルをコピー
        if [ -d ../private/_layouts ]; then
          cp -r ../private/_layouts .
        fi
        
        # アセットファイルをコピー
        if [ -d ../private/assets ]; then
          cp -r ../private/assets .
        fi
        
        # LICENSEファイルをコピー
        if [ -f ../private/LICENSE ]; then
          cp ../private/LICENSE .
        fi
        
        # .nojekyllファイルを削除（Jekyll処理を有効にするため）
        rm -f .nojekyll

    - name: Deploy to public repository using peaceiris/actions-gh-pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        personal_token: ${{ secrets.DEPLOY_TOKEN }}
        external_repository: itdojp/github-workflow-book_public
        publish_branch: gh-pages
        publish_dir: ./public
        force_orphan: true
        enable_jekyll: true
```

## デプロイプロセス

### 自動デプロイ

1. プライベートリポジトリの main ブランチに変更をプッシュ
2. GitHub Actions が自動的に起動
3. 以下の処理が実行される：
   - プライベートリポジトリのチェックアウト
   - Markdownファイルとアセットのコピー
   - Jekyll設定ファイルのコピー
   - パブリックリポジトリへのデプロイ

### 手動デプロイ

必要に応じて、GitHub Actions のページから手動でワークフローを実行することも可能です：

1. プライベートリポジトリの Actions タブへアクセス
2. "Deploy to Public Repository" ワークフローを選択
3. "Run workflow" をクリック
4. ブランチを選択（通常は main）
5. "Run workflow" をクリック

## Jekyll設定

### GitHub Pages設定

Markdownプロジェクトの場合、Jekyll（GitHub Pagesのデフォルト）を使用します：

**_config.yml の例:**
```yaml
# GitHub Pages + Jekyll設定
title: "AI開発のためのGitHubワークフロー実践ガイド"
description: "GitHubとAIツールを活用した効率的な開発ワークフロー"
baseurl: "/github-workflow-book_public"
url: "https://itdojp.github.io"

# Jekyll設定
markdown: kramdown
highlighter: rouge
# theme: minima（コメントアウト推奨）
remote_theme: pages-themes/minimal@v0.2.0

# プラグイン
plugins:
  - jekyll-feed
  - jekyll-sitemap
  - jekyll-seo-tag
```

### レイアウトファイル

**_layouts/default.html の例:**
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ page.title | default: site.title }}</title>
    
    <!-- favicon設定 -->
    <link rel="icon" type="image/png" sizes="48x48" href="{{ '/assets/images/itdo_logo_48x48_blue.png' | relative_url }}">
    <link rel="shortcut icon" type="image/png" href="{{ '/assets/images/itdo_logo_48x48_blue.png' | relative_url }}">
    
    <!-- Mermaid.js for diagrams -->
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.esm.min.mjs';
        
        document.addEventListener('DOMContentLoaded', function() {
            mermaid.initialize({
                startOnLoad: true,
                theme: 'default',
                securityLevel: 'loose'
            });
            
            // Process language-mermaid code blocks
            document.querySelectorAll('code.language-mermaid').forEach((block) => {
                const div = document.createElement('div');
                div.className = 'mermaid';
                div.textContent = block.textContent;
                block.parentNode.replaceChild(div, block);
            });
            
            mermaid.run();
        });
    </script>
</head>
<body>
    <div class="container">
        {{ content }}
    </div>
</body>
</html>
```

## GitHub Pages用ファイル構成

| ファイル | 用途 |
|----------|------|
| `index.md` | トップページ（README.mdから生成、front matter付き） |
| `_config.yml` | Jekyll設定ファイル |
| `_layouts/default.html` | レイアウトテンプレート |
| `assets/images/` | 画像ファイル（favicon含む） |
| `chapter-*.md` | 各章のMarkdownファイル |
| `appendix-*.md` | 付録のMarkdownファイル |

## トラブルシューティング

### 初回デプロイ時の問題

1. **エラー: failed to push refs to**
   - gh-pagesブランチが存在しない可能性
   - 解決方法：パブリックリポジトリでgh-pagesブランチを手動作成

2. **GitHub Pagesが404エラー**
   - GitHub Pagesの設定確認：Settings > Pages
   - gh-pagesブランチが選択されているか確認
   - index.mdが存在するか確認

### Jekyll関連の問題

1. **エラー: Permission denied**
   - DEPLOY_TOKEN が正しく設定されているか確認
   - トークンに `repo` スコープがあるか確認
   - トークンの有効期限が切れていないか確認

2. **Jekyllビルドエラー**
   - Liquid構文エラー：`{{}}`が数式表記やMermaid内で使われていないか確認
   - _config.ymlの設定エラー：サポートされていないプラグインを使用していないか確認
   - テーマ設定の競合：themeとremote_themeが同時に設定されていないか確認

3. **Mermaidダイアグラムが表示されない**
   - _layouts/default.htmlでMermaidが正しく初期化されているか確認
   - Mermaidバージョンが最新（v10.6.1以上）か確認
   - ブラウザのキャッシュをクリア

### デプロイが反映されない場合

1. **変更が反映されない**
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
- [ ] GitHub Pagesを有効化済み（Settings > Pages）
- [ ] Personal Access Tokenを作成済み
- [ ] DEPLOY_TOKENをSecretsに設定済み
- [ ] .github/workflows/deploy-to-public.ymlを作成済み
- [ ] ワークフロー内のリポジトリ名を確認済み
- [ ] _config.ymlの設定を確認済み
- [ ] _layouts/default.htmlを作成済み（favicon設定含む）
- [ ] assets/images/itdo_logo_48x48_blue.pngを配置済み
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
   - デプロイ前にローカルでJekyllの動作を確認
   - リンクチェッカーを定期的に実行

4. **セキュリティ**
   - トークンは定期的に更新
   - 不要な権限は付与しない
   - シークレットは GitHub Secrets でのみ管理

5. **Jekyll設定の注意点**
   - `.nojekyll`ファイルを作成しない
   - Liquid構文の競合に注意（特に数式やダイアグラム内）
   - GitHub Pagesでサポートされているプラグインのみ使用

## 関連リソース

- [GitHub Actions ドキュメント](https://docs.github.com/actions)
- [GitHub Pages ドキュメント](https://docs.github.com/pages)
- [Jekyll ドキュメント](https://jekyllrb.com/)
- [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages)

## 組織情報

- **組織名**: 株式会社アイティードゥ (ITDO Inc.)
- **GitHub組織**: itdojp
- **連絡先**: knowledge@itdo.jp