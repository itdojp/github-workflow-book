# Book Publishing Template v2.0 セットアップガイド

## 🚀 クイックスタート

### 1. 依存関係のインストール
```bash
PUPPETEER_SKIP_DOWNLOAD=true npm ci --ignore-scripts
```

### 2. 初回ビルド
```bash
npm run build
```

### 3. ローカルプレビュー
```bash
npm run preview
```
ブラウザで http://localhost:8080 にアクセス

### 4. GitHub Pages 設定
1. GitHubでリポジトリのSettings > Pagesに移動
2. Source: "Deploy from a branch"を選択
3. Branch: "main" / Folder: "/docs"を選択
4. Saveをクリック

### 5. 初回デプロイ
```bash
git add .
git commit -m "Migrate to v2.0 architecture"
git push origin main
```

## 📋 確認事項

- [ ] ビルドが正常に完了する
- [ ] ローカルプレビューで内容が表示される
- [ ] GitHub Pages設定が完了している
- [ ] GitHubにプッシュして自動デプロイが動作する

## 🎯 次のステップ

コンテンツの編集・追加を行い、`npm run build` でビルドしてGitHubにプッシュするだけで自動的に公開されます。

詳細は [V2_MIGRATION_SUMMARY.md](V2_MIGRATION_SUMMARY.md) を参照してください。