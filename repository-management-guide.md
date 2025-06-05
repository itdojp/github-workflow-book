# リポジトリ管理ガイド

このドキュメントでは、AI開発のためのGitHubワークフロー実践ガイドプロジェクトのリポジトリ管理方法について説明します。

## プロジェクト情報

| 項目 | 値の例 |
|------|--------|
| GitHubのユーザー名または組織名 | `itdojp` |
| 連絡先メールアドレス | `knowledge@itdo.jp` |
| 組織名 | `株式会社アイティードゥ (ITDO Inc.)` |

## リポジトリ構成

本プロジェクトは以下の2つのリポジトリで構成されています：

1. **プライベートリポジトリ** (`github-workflow-book_private`)
   - 執筆・編集作業用
   - ドラフトや未完成のコンテンツを含む
   - 限定されたメンバーのみアクセス可能

2. **パブリックリポジトリ** (`github-workflow-book_public`)
   - 完成したコンテンツの公開用
   - 誰でも閲覧・利用可能
   - プライベートリポジトリから自動デプロイ

## 著作権とライセンス

### 著作権表示

公開リポジトリには以下の著作権表示を必ず含めてください：

```
Copyright (c) 2025 ITdo Japan, Inc. All rights reserved.
```

### ライセンス

- プライベートリポジトリ：All Rights Reserved（執筆中のコンテンツ保護のため）
- パブリックリポジトリ：Creative Commons Attribution 4.0 International (CC BY 4.0)

デプロイ時に、適切なLICENSEファイルが自動的にコピーされます。

## リポジトリ設定

### プライベートリポジトリの設定

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
   - ファイル名: `itdo_logo_48x48_blue.png`
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

プライベートリポジトリでは以下のワークフローが動作します：

- **ビルドテスト**: プルリクエスト時に自動実行
- **リンクチェック**: 定期的に実行（週1回）
- **デプロイ**: main ブランチへのマージ時に実行

### デプロイメントフロー

```mermaid
graph LR
    A[プライベートリポジトリ<br/>main ブランチ] -->|プッシュ| B[GitHub Actions<br/>起動]
    B --> C[ビルド処理]
    C --> D[パブリックリポジトリ<br/>gh-pages ブランチ]
    D --> E[GitHub Pages<br/>公開]
```

詳細なデプロイ手順については、[デプロイメントガイド](deployment-guide.md)を参照してください。

## セキュリティ考慮事項

1. **機密情報の管理**
   - プライベートリポジトリでも機密情報はコミットしない
   - 必要な場合は GitHub Secrets を使用

2. **トークンの管理**
   - Personal Access Token は最小限の権限で作成
   - 定期的に更新（推奨：90日ごと）
   - 不要になったらすぐに削除

3. **アクセス監査**
   - 定期的にメンバーのアクセス権限を確認
   - 不要なアクセス権限は削除

## トラブルシューティング

### よくある問題

1. **デプロイが失敗する**
   - DEPLOY_TOKEN が正しく設定されているか確認
   - トークンの権限が適切か確認
   - ワークフローのログを確認

2. **GitHub Pages が更新されない**
   - gh-pages ブランチにコミットされているか確認
   - GitHub Pages の設定を確認
   - キャッシュのクリアを試す

3. **Jekyllビルドエラー**
   - Liquid構文エラー：`{{}}`が数式表記やMermaid内で使われていないか確認
   - _config.ymlの設定エラー：サポートされていないプラグインを使用していないか確認
   - テーマ設定の競合：themeとremote_themeが同時に設定されていないか確認

4. **Mermaidダイアグラムが表示されない**
   - _layouts/default.htmlでMermaidが正しく初期化されているか確認
   - Mermaidバージョンが最新（v10.6.1以上）か確認
   - DOMContentLoadedイベントで初期化されているか確認

## プロジェクト構造

### 重要なディレクトリとファイル

```
github-workflow-book_private/
├── .github/workflows/     # GitHub Actionsワークフロー
│   └── deploy-to-public.yml # メインのデプロイワークフロー
├── _layouts/             # Jekyllレイアウトテンプレート
│   └── default.html      # デフォルトレイアウト（favicon設定含む）
├── assets/               # 静的アセット
│   └── images/          
│       └── itdo_logo_48x48_blue.png  # favicon画像
├── chapter-*.md         # 各章のMarkdownファイル
├── appendix-*.md        # 付録のMarkdownファイル
├── _config.yml          # Jekyll設定ファイル
└── index.md             # ホームページ（README.mdから生成）
```

## 関連ドキュメント

- [デプロイメントガイド](deployment-guide.md) - デプロイの詳細手順
- [開発ガイド](development-guide.md) - 開発環境のセットアップ
- [コントリビューションガイド](CONTRIBUTING.md) - 貢献方法

## サポート

問題が発生した場合は、プライベートリポジトリの Issues で報告してください。
連絡先: knowledge@itdo.jp