# 開発ガイド

## プロジェクト構成

```text
github-workflow-book-private/
├── .github/
│   └── workflows/
│       ├── deploy-to-public.yml    # 自動デプロイ
│       └── quality-checks.yml      # 品質チェック
├── scripts/
│   ├── publication_manager.py      # 出版管理
│   ├── validate_links.py          # リンク検証
│   ├── build_book.py              # ビルドスクリプト
│   └── ai_metrics_calculator.py   # AIメトリクス計算
├── docs/                          # GitHub Pages用
├── kindle/                        # Kindle出版用
├── zenn/                          # Zenn公開用
├── chapter-*.md                   # 各章（16章）
├── appendix-*.md                  # 付録（7つ）
├── introduction.md                # はじめに
├── README.md                      # プロジェクト概要
├── CONTRIBUTING.md                # 貢献ガイド
├── DEVELOPMENT.md                 # 本ドキュメント
└── requirements.txt               # Python依存関係
```

## 開発ワークフロー

### 1. 環境セットアップ

```bash
# Python仮想環境の作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係のインストール
pip install -r requirements.txt
```

### 2. 新しい章の追加

1. ファイル名規則に従って作成
   ```bash
   # 例: 第17章を追加する場合
   touch chapter-17-new-topic.md
   ```

2. 章のテンプレート
   ```markdown
   # 第17章：新しいトピック

   ## 17.1 セクション名
   
   ### サブセクション
   
   ## 17.2 別のセクション
   
   ## まとめ
   
   ## 確認事項
   - [ ] チェック項目1
   - [ ] チェック項目2
   ```

### 3. ローカルでの検証

```bash
# リンクの検証
python scripts/validate_links.py

# 本のビルド
python scripts/build_book.py

# AIメトリクスの確認
python scripts/ai_metrics_calculator.py

# Markdownのリント（要npm）
npx markdownlint-cli "**/*.md"
```

### 4. GitHub Actions

#### 自動デプロイ（mainブランチへのプッシュ時）
- プライベートリポジトリ → パブリックリポジトリ
- Jekyll でのサイト生成
- GitHub Pages への公開

#### 品質チェック（PR作成時）
- リンク検証
- Markdown フォーマット
- スペルチェック
- 章番号の整合性

### 5. マルチプラットフォーム公開

#### GitHub Pages
```bash
# ローカルでJekyllを実行（要Ruby）
cd docs
bundle exec jekyll serve
```

#### Kindle
```bash
cd kindle
./build.sh
```

#### Zenn
```bash
# Zenn CLIのインストール（要npm）
npm install -g zenn-cli

# プレビュー
cd zenn
zenn preview
```

## トラブルシューティング

### よくある問題

1. **リンクエラー**
   - 相対パスを使用しているか確認
   - ファイル名の大文字小文字を確認

2. **章番号の重複**
   - `ls chapter-*.md | sort -V` で確認
   - 重複がある場合は番号を修正

3. **ビルドエラー**
   - Python依存関係が最新か確認
   - エンコーディングがUTF-8か確認

### デバッグモード

```bash
# 詳細ログを出力
VERBOSE=1 python scripts/build_book.py

# 特定の章のみ検証
python scripts/validate_links.py chapter-01-*.md
```

## リリースプロセス

1. **バージョンタグの作成**
   ```bash
   git tag -a v1.0.0 -m "Version 1.0.0 release"
   git push origin v1.0.0
   ```

2. **自動デプロイの確認**
   - GitHub Actions の実行状況を確認
   - パブリックリポジトリでの反映を確認

3. **各プラットフォームでの公開**
   - GitHub Pages: 自動
   - Kindle: 手動でKDPにアップロード
   - Zenn: `zenn publish` コマンド

## メンテナンス

### 定期的なタスク
- [ ] 外部リンクの有効性確認（月次）
- [ ] AIツールの最新情報反映（四半期）
- [ ] 読者フィードバックの反映
- [ ] セキュリティアップデート

### パフォーマンス最適化
- 画像の最適化（WebP形式推奨）
- 大きなコードブロックの外部ファイル化
- 不要な依存関係の削除

## 連絡先

- 技術的な質問: GitHub Issues
- 一般的な問い合わせ: knowledge@itdo.jp
- 緊急時: プロジェクトメンテナーに直接連絡