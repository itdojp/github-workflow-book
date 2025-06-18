# Contributing to AI開発のためのGitHubワークフロー実践ガイド

このプロジェクトへの貢献を検討いただき、ありがとうございます！

## 貢献の方法

### 1. Issue の作成

バグ報告、機能提案、質問などは、まず Issue を作成してください。

**Issue テンプレート（第2章のCLEAR方式を使用）:**

```markdown
## Context（背景）
[問題や提案の背景を説明]

## Logic（ロジック）
[技術的な詳細や実装案]

## Examples（例）
[具体的な例やコードサンプル]

## Action（アクション）
[期待される行動や成果]

## Review（レビュー）
[成功基準や確認項目]
```

### 2. Pull Request

1. **ブランチの作成**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **変更の実施**
   - 章の番号付けルールに従う（chapter-XX-description.md）
   - 既存のスタイルガイドに準拠
   - AI協働の観点を含める

3. **コミット**
   ```bash
   git commit -m "feat: 明確で簡潔なコミットメッセージ"
   ```

4. **プッシュとPR作成**
   ```bash
   git push origin feature/your-feature-name
   ```

### 3. コーディング規約

#### Markdown スタイル
- 見出しは `#` スタイル（atx）を使用
- リストは `-` を使用
- コードブロックには言語を指定
- 日本語と英語の間に半角スペースを入れる

#### ファイル命名規則
- 章: `chapter-XX-description.md`（XX は2桁のゼロパディング）
- 付録: `appendix-X-description.md`（X はアルファベット）

#### AI 関連のコンテンツ
- AI ツールの使用例は実践的なものにする
- プロンプトエンジニアリングの例を含める
- 効果測定可能な指標を提供する

### 4. レビュープロセス

1. **自動チェック**
   - Markdown リンティング
   - スペルチェック
   - リンク検証

2. **人的レビュー**
   - 技術的正確性
   - 日本語の品質
   - AI 協働の観点

### 5. ライセンス

貢献されたコンテンツは、本プロジェクトのライセンスに従います。

## 開発環境のセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/itdojp/github-workflow-book-private.git
cd github-workflow-book-private

# Python 依存関係のインストール
pip install -r requirements.txt

# 検証スクリプトの実行
python scripts/validate_links.py
python scripts/build_book.py
```

## コミュニケーション

- 技術的な議論: GitHub Issues
- 一般的な質問: knowledge@itdo.jp

## 行動規範

- 建設的なフィードバックを心がける
- 多様性を尊重する
- AI 協働の精神で協力する

ご協力ありがとうございます！ 🤝