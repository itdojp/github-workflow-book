# 🚀 簡単デプロイトークンセットアップガイド

デプロイトークンの設定が簡単になりました！このガイドでは、新しい簡素化されたセットアップ方法を説明します。

## ✨ 新機能

- 🧙‍♂️ **対話的セットアップウィザード** - ステップバイステップでトークンを設定
- 🔍 **自動トークン検証** - 設定前に権限と有効性をチェック
- ⚡ **GitHub Actions統合** - デプロイ時に自動でトークンを検証
- 📋 **最小権限要求** - 必要最小限の権限スコープのみ要求

## 🚀 クイックセットアップ

### 1. セットアップウィザードを実行

```bash
npm run setup-token
```

このコマンドで以下が自動実行されます：
- 既存トークンの検証
- 新しいトークン作成のガイド
- トークンの検証
- GitHub Secretsの設定方法の説明

### 2. 完了！

セットアップが完了したら、すぐにデプロイできます：

```bash
npm run deploy:full
```

## 🔑 必要な権限スコープ（最小限）

新しいPersonal Access Tokenを作成する際は、以下のスコープのみが必要です：

### 必須スコープ
- ✅ **`repo`** - リポジトリへの完全アクセス権

### 推奨スコープ（GitHub Actions使用時）
- ⚡ **`workflow`** - GitHub Actionsワークフローの更新権限

### 組織利用時の追加スコープ（必要に応じて）
- 🏢 **`admin:org`** - 組織のサードパーティアクセス制限がある場合
- 📖 **`read:org`** - 組織メンバーシップの確認が必要な場合

> 💡 **ヒント**: 組織でリポジトリを使用する場合、組織の設定によっては追加権限が必要です。セットアップウィザードが自動で検出してガイドします。

## 🔧 手動セットアップ（上級者向け）

ウィザードを使わずに手動でセットアップする場合：

### 1. Personal Access Token作成

1. [GitHub Token作成ページ](https://github.com/settings/tokens/new)にアクセス
2. 以下を設定：
   - **Note**: `Book Publishing Template Deployment`
   - **Expiration**: `90 days`（推奨）
   - **Scopes**: `repo` + `workflow`（必要に応じて組織用スコープも）

### 2. トークン検証

```bash
GITHUB_TOKEN="your-token" npm run validate-token
```

### 3. GitHub Secrets設定

1. リポジトリの Settings → Secrets and variables → Actions
2. "New repository secret" をクリック
3. Name: `DEPLOY_TOKEN`, Value: 作成したトークン

## 🔍 トラブルシューティング

### トークン検証

いつでもトークンの状態を確認できます：

```bash
npm run validate-token
```

### よくある問題

#### 認証エラー
```
❌ 認証: 失敗
```
**解決**: トークンが正しく設定されているか確認。新しいトークンを作成してください。

#### 権限不足エラー
```
❌ 必須スコープ: 不足
```
**解決**: トークンに `repo` スコープが含まれているか確認。

#### 組織アクセスエラー
```
❌ organization/repo への アクセスが確認できませんでした
```
**解決**: 組織の管理者に確認するか、`admin:org` と `read:org` スコープを追加。

### セットアップの再実行

問題がある場合は、いつでもセットアップウィザードを再実行できます：

```bash
npm run setup-token
```

## 📚 関連ドキュメント

- [詳細デプロイガイド](deployment-guide.md) - 従来の詳細セットアップ方法
- [トラブルシューティング](docs/troubleshooting.md) - よくある問題と解決方法
- [セットアップガイド](docs/setup-guide.md) - 全体的なプロジェクトセットアップ

## ⚙️ 高度な設定

### 環境変数での設定

ローカル開発で直接環境変数を使用：

```bash
export GITHUB_TOKEN="your-token"
export DEPLOY_TOKEN="your-token"  # 代替名
export PUBLIC_REPO_URL="https://github.com/username/repo-public.git"
```

### CI/CD環境での設定

GitHub Actions以外のCI環境：

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
  PUBLIC_REPO_URL: ${{ secrets.PUBLIC_REPO_URL }}
```

### カスタム検証オプション

```bash
# 詳細情報付きで検証
npm run validate-token -- --verbose

# リポジトリアクセスチェックをスキップ
npm run validate-token -- --no-repo-check

# 期限チェックをスキップ
npm run validate-token -- --no-expiration
```

---

💡 **新しいセットアップ方法を試してみてください！** 何か問題があれば、従来の[詳細ガイド](deployment-guide.md)も参照できます。