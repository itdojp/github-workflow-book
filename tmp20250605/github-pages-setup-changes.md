# GitHub Pages設定の変更点まとめ

このドキュメントは、GitHub Pagesを正しく動作させるために行った重要な変更点をまとめたものです。

## 主要な変更点

### 1. .nojekyllファイルの削除
**問題**: `.nojekyll`ファイルが存在するとJekyllが無効化され、MarkdownファイルがHTMLに変換されない
**解決策**: 
- デプロイワークフローで`.nojekyll`の作成を削除
- `rm -f .nojekyll`コマンドで明示的に削除
- `enable_jekyll: true`をpeaceiris/actions-gh-pagesに追加

### 2. リポジトリ名の修正
**変更前**: `theoretical-computer-science-textbook`
**変更後**: `theoretical-computer-science-textbook-public`
- _config.ymlのbaseurlを修正: `/theoretical-computer-science-textbook-public`
- 正しいURL: `https://itdojp.github.io/theoretical-computer-science-textbook-public/`

### 3. GitHub Actions設定
**シークレット名**: `DEPLOY_TOKEN` → `PUBLIC_REPO_TOKEN`
**重要な設定**:
- `force_orphan: true` - 既存のコミット履歴との競合を回避
- `enable_jekyll: true` - Jekyllを有効化し、.nojekyllの自動生成を防ぐ

### 4. 重複したワークフローの無効化
以下のファイルを`.disabled`にリネーム:
- `deploy-simple.yml` → `deploy-simple.yml.disabled`
- `deploy-updated.yml` → `deploy-updated.yml.disabled`
- アクティブなワークフロー: `deploy.yml`のみ

### 5. Jekyll設定の修正

#### _config.yml
```yaml
# 修正前
theme: minima
remote_theme: pages-themes/minimal@v0.2.0

# 修正後（themeをコメントアウト）
# theme: minima
remote_theme: pages-themes/minimal@v0.2.0
```

**サポートされていないプラグインの無効化**:
- jekyll-optional-front-matter
- jekyll-readme-index
- jekyll-titles-from-headings

#### _layouts/default.html
**Mermaidの更新**:
- バージョン: v9.4.3 → v10.6.1
- DOMContentLoadedイベントで初期化
- language-mermaidクラスのコードブロックを処理

### 6. Liquid構文エラーの修正
**問題**: `{{u, v}}`がLiquidテンプレートとして解釈される
**修正例**:
- 数式: `{{u, v}}` → `{(u, v)}`
- Mermaid: `Decision{{"text"}}` → `Decision["text"]`

### 7. ビルドスクリプトの修正
**scripts/build.js**:
- 独自のindex.md生成を削除
- ルートのindex.mdをそのままコピーするように変更
- _layoutsディレクトリのコピーを追加

### 8. index.mdレイアウトの改善
章構成の表示を改善:
- 各理論層（基礎理論層、中核理論層など）を独立したセクションに
- 見出しをグリッドの外に配置
- より明確な視覚的階層構造

### 9. favicon設定の追加
**ファイル構造**:
- favicon画像: `assets/images/itdo_logo_48x48_blue.png`
- レイアウト設定: `_layouts/default.html`

**実装**:
```html
<link rel="icon" type="image/png" sizes="48x48" href="{{ '/assets/images/itdo_logo_48x48_blue.png' | relative_url }}">
<link rel="shortcut icon" type="image/png" href="{{ '/assets/images/itdo_logo_48x48_blue.png' | relative_url }}">
```

**ビルドスクリプトの更新**:
- ルートレベルのassetsディレクトリもコピーするように修正
- src/assetsとルートassetsの両方をサポート

## トラブルシューティングチェックリスト

### GitHub Pages 404エラーの場合
1. ✅ 公開リポジトリのSettings → PagesでSource: gh-pages, Folder: /rootを確認
2. ✅ `.nojekyll`ファイルが存在しないことを確認
3. ✅ _config.ymlが存在し、baseurlが正しいことを確認
4. ✅ _layoutsディレクトリが存在することを確認
5. ✅ index.mdが存在することを確認

### Jekyllビルドエラーの場合
1. ✅ Liquid構文エラー（`{{}}`）がないか確認
2. ✅ _config.ymlのthemeとremote_themeが競合していないか確認
3. ✅ サポートされていないプラグインを使用していないか確認

### Mermaidダイアグラムが表示されない場合
1. ✅ Mermaidバージョンがv10.6.1以上か確認
2. ✅ DOMContentLoadedイベントで初期化されているか確認
3. ✅ ブラウザのキャッシュをクリア

## 重要なファイルパス
- ワークフロー: `.github/workflows/deploy.yml`
- Jekyll設定: `_config.yml`
- レイアウト: `_layouts/default.html`
- ビルドスクリプト: `scripts/build.js`
- ホームページ: `index.md`
- favicon: `assets/images/itdo_logo_48x48_blue.png`

## 今後の注意点
1. **`.nojekyll`ファイルを作成しない** - Jekyllでの処理が必要
2. **Liquid構文の競合に注意** - 特に数式やダイアグラム内
3. **GitHub Pagesでサポートされているプラグインのみ使用**
4. **ワークフローは1つだけ有効にする** - 競合を避けるため