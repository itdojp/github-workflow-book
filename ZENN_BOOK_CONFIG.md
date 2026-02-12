# Zenn Book Configuration

## 書籍基本情報

```yaml
title: "AI開発のためのGitHubワークフロー実践ガイド"
summary: "AI協働時代に対応した、世界初の実践的GitHubワークフローガイドブック"
author: "株式会社アイティードゥ 太田和彦"
published_date: "2025-06-01"
type: "book"
published: true
price: 1980  # 円（有料の場合）
# price: 0  # 無料の場合
topics: ["github", "ai", "copilot", "workflow", "collaboration"]
cover: "./images/book-cover.png"
```

## Zenn用チャプター構成

### chapters/
```text
chapters/
├── 01-introduction.md
├── 02-part1-intro.md
├── 03-git-github-basics.md
├── 04-ai-collaboration-fundamentals.md  # ⭐ 核心章
├── 05-essential-commands-ai.md
├── 06-github-collaboration-ai.md
├── 07-account-repository-ai.md
├── 08-part2-intro.md
├── 09-github-copilot-advanced.md
├── 10-ai-code-review-practice.md
├── 11-github-advanced-security-ai.md
├── 12-part3-intro.md
├── 13-access-permissions-ai.md
├── 14-organization-management-ai.md
├── 15-security-practice-ai.md
├── 16-part4-intro.md
├── 17-practical-workflow.md
├── 18-cicd-pipeline.md
├── 19-large-scale-data-model-ai.md
├── 20-github-pages.md
├── 21-part5-intro.md
├── 22-external-collaboration.md
├── 23-compliance-governance.md
├── 24-appendix-intro.md
├── 25-github-glossary.md
├── 26-troubleshooting.md
├── 27-pricing-comparison.md
├── 28-ai-cost-calculation.md
├── 29-git-aliases.md
└── 30-vscode-extensions.md
```

## Zenn記事フォーマット例

### chapters/04-ai-collaboration-fundamentals.md
```markdown
---
title: "第2章：AI時代のGitHub協働基礎 ⭐"
---

# 第2章：AI時代のGitHub協働基礎

:::message
**🎯 この章の重要度: ★★★★★**

この章は本書の核心です。AI協働の基礎となるCLEARフレームワークを確実に習得してください。以降の全ての章でこの概念を使用します。
:::

## 2.1 なぜAI協働が必要なのか

現代のソフトウェア開発において、AIは単なるツールではなく、開発チームの一員として機能します...

:::details CLEAR方式の概要
- **C**ontext: コンテキスト設定
- **L**ogic: 論理的思考促進
- **E**xample: 具体例提示
- **A**ction: アクション明確化
- **R**eview: レビューポイント
:::

## 2.2 AIが理解しやすいIssueの書き方

### ❌ 従来の書き方
```markdown
# バグ報告
ログイン機能がうまく動かない。たまにエラーが出る。
```

### ✅ AI協働最適化版
```markdown
# [BUG] ログイン認証でランダムに401エラーが発生

## 環境情報
 - OS: Ubuntu 22.04 LTS
- Python: 3.9.7
- Django: 4.1.2
- 発生頻度: 約20%のログイン試行

## AI調査依頼
以下の観点で原因を分析してください：
1. 認証トークンの生成/検証ロジック
2. 並行処理での競合状態の可能性
3. セッション管理の問題
```

:::message alert
**重要**: この構造化されたIssue作成により、AI分析の精度が大幅に向上します。
:::

## 2.3 AI協働を前提としたPull Request

[PR テンプレートの詳細内容...]

## まとめ

この章で学んだCLEARフレームワークは、以降の全ての章で活用します。特に：

- 第6章：Copilotでの高度なプロンプトエンジニアリング
- 第7章：AIレビューとの効果的な協働
- 第12〜13章：ワークフロー・CI/CDでの実践

次の章では、これらの基礎を実際のGitコマンドに適用していきます。
```text

## Zenn公開用のconfig.yaml

```yaml
# books/github-workflow-ai/config.yaml
title: "AI開発のためのGitHubワークフロー実践ガイド"
summary: |-
  AI協働時代に対応した実践的GitHubワークフローガイド。
  
  ChatGPT、GitHub Copilot、Claudeなどを活用して、
  チーム開発の生産性を飛躍的に向上させる方法を
  体系的に学べます。
  
  ⭐ 特徴:
  - 即実践可能なテンプレート・パターン
  - 測定可能なAI協働メトリクス  
  - 個人〜エンタープライズまで対応
  - 2025年最新のAI開発環境に最適化
  
  📖 著者: 株式会社アイティードゥ 太田和彦
  📅 発行日: 2025年6月1日

topics: ["github", "ai", "copilot", "workflow", "devops", "collaboration", "productivity"]
published: true
price: 1980  # 有料版
cover: "./images/cover.png"
chapters:
  - "01-introduction"
  - "02-part1-intro" 
  - "03-git-github-basics"
  - "04-ai-collaboration-fundamentals"
  - "05-essential-commands-ai"
  - "06-github-collaboration-ai"
  - "07-account-repository-ai"
  - "08-part2-intro"
  - "09-github-copilot-advanced"
  - "10-ai-code-review-practice"
  - "11-github-advanced-security-ai"
  - "12-part3-intro"
  - "13-access-permissions-ai"
  - "14-organization-management-ai"
  - "15-security-practice-ai"
  - "16-part4-intro"
  - "17-practical-workflow"
  - "18-cicd-pipeline"
  - "19-large-scale-data-model-ai"
  - "20-github-pages"
  - "21-part5-intro"
  - "22-external-collaboration"
  - "23-compliance-governance"
  - "24-appendix-intro"
  - "25-github-glossary"
  - "26-troubleshooting"
  - "27-pricing-comparison"
  - "28-ai-cost-calculation"
  - "29-git-aliases"
  - "30-vscode-extensions"
```

## Zenn 投稿用スクリプト

```bash
#!/bin/bash
# zenn_publish.sh

# Zenn CLIのインストール確認
if ! command -v zenn &> /dev/null; then
    echo "Zenn CLIをインストールしています..."
    npm install -g zenn-cli
fi

# 書籍ディレクトリの作成
if [ ! -d "zenn-book" ]; then
    mkdir zenn-book
    cd zenn-book
    
    # Zenn書籍の初期化
    zenn init
    
    # 書籍ディレクトリの作成
    mkdir -p books/github-workflow-ai/chapters
    mkdir -p books/github-workflow-ai/images
else
    cd zenn-book
fi

# 既存のMarkdownファイルをZenn形式に変換
echo "Markdownファイルを変換中..."
python ../scripts/convert_to_zenn.py

# プレビューの起動
echo "Zennプレビューを起動します..."
zenn preview

echo "✅ Zenn書籍の準備が完了しました！"
echo "📖 プレビュー: http://localhost:8000"
echo "🚀 公開: zenn-cli で公開してください"
```
