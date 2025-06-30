# Book Publishing Template v2.0 Migration Summary

> このリポジトリは Book Publishing Template v2.0 アーキテクチャに移行されました。

## 🎯 主な変更点

### アーキテクチャ変更
- **デュアルリポジトリ** → **単一リポジトリ** に変更
- **複雑なデプロイ** → **GitHub Pages 直接デプロイ** に簡素化
- **トークン設定必須** → **トークン不要** に変更

### ビルドシステム
- **新しいビルドスクリプト**: `scripts/build-simple.js`
- **出力先変更**: `public/` → `docs/` フォルダ
- **依存関係削減**: 重い依存関係を除去し、軽量化

## 📋 新しい使用方法

### 基本コマンド
```bash
# ビルド
npm run build

# ローカルプレビュー
npm run preview

# クリーンアップ
npm run clean
```

### レガシーコマンド（従来機能）
```bash
# 従来のビルドシステム
npm run legacy:build
npm run legacy:preview
```

## 🚀 デプロイ方法

### GitHub Pages 設定
1. GitHubでリポジトリのSettings > Pagesに移動
2. Source: "Deploy from a branch"を選択
3. Branch: "main" / Folder: "/docs"を選択
4. Saveをクリック

### 自動デプロイ
- mainブランチにプッシュすると自動的にビルド・デプロイ
- GitHub Actions workflow: `.github/workflows/build.yml`

## 📝 設定変更

### book-config.json
```json
{
  "deployment": {
    "sourceFolder": "docs",
    "siteUrl": "https://itdojp.github.io/github-workflow-book-private/"
  }
}
```

### package.json
- 軽量な依存関係のみ保持
- レガシー依存関係は `legacyDependencies` に移動
- 新しいスクリプトを追加

## ⚙️ 移行作業内容

✅ v2.0ビルドシステムファイルをコピー
✅ package.jsonを更新（軽量化）
✅ book-config.jsonを単一リポジトリ用に更新
✅ GitHub Actions workflowを設定
✅ .gitignoreを更新（docs/フォルダを保持）
✅ ビルド・プレビューテスト完了

## 🔄 後方互換性

### レガシー機能の保持
- 従来のビルドスクリプトは `scripts/` に保持
- レガシーコマンドで従来機能を利用可能
- 複雑な機能が必要な場合は段階的に移行可能

### ファイル構造
- `src/` フォルダ構造は変更なし
- 全ての既存コンテンツは保持
- 追加の設定ファイルは保持

## 📊 利点

- **セットアップ時間**: 30分 → 5分
- **ビルド時間**: 大幅短縮（軽量化により）
- **エラー頻度**: 依存関係エラーが激減
- **保守性**: シンプルな構成で保守が容易
- **トークン管理**: 不要になりセキュリティリスク軽減

## 🆘 問題が発生した場合

### レガシーシステムに戻す
```bash
# レガシービルドを使用
npm run legacy:build
npm run legacy:preview
```

### サポート
- [Book Publishing Template v2.0 ドキュメント](https://github.com/itdojp/book-publishing-template2)
- Issues: GitHub Issues で報告
- 緊急時: knowledge@itdo.jp

---

**✨ v2.0移行により、より簡単で高速な書籍出版環境をお楽しみください！**