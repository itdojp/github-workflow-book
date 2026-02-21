---
layout: book
title: "付録C：料金プランと機能比較表"
---

# 付録C：料金プランと機能比較表

## この付録の使い方（重要）
料金・無料枠・提供機能（モデル/エージェント/課金単位）は変更され得ます。本付録は「金額の丸暗記」ではなく、**見積もり・監視・統制に必要な構造**を整理します。具体的な単価や無料枠は、必ず公式情報を参照してください。

## 1. コスト要素の全体像
GitHub + AI運用のコストは、概ね次の合算で捉えると整理しやすくなります。

- **GitHubプラン（席課金）**: 組織/個人のプラン、機能制約
- **GitHub Actions（従量）**: GitHub-hosted runner の minutes、OS 乗数、Artifacts/キャッシュ等
- **ストレージ（従量）**: Packages、LFS、Artifacts など
- **セキュリティ（従量/席課金）**: Advanced Security 等（導入形態により変動）
- **Copilot（席課金 + 従量）**: ライセンス（席） + **premium requests（従量）**

## 2. GitHub Actions minutes（考え方）
Actionsのコストは「実行時間（minutes）」が基本単位で、OSごとに換算（乗数）が設定されます。見積もりは次の式で整理できます。

```text
課金対象minutes = Σ（ジョブ実行minutes × OS乗数）
超過minutes = max(0, 課金対象minutes - 無料枠/含まれるminutes)
追加費用 = 超過minutes × 単価（公式参照）
```

Self-hosted runner はGitHub側のminutes課金が発生しない一方で、インフラコスト（サーバ、GPU、運用）が別途発生します。

## 3. Copilotの premium requests（何が「1回」か）
Copilotには、利用形態に応じて **requests** と **premium requests** があります（用語とカウント対象が重要です）。

### 3.1 requests（基本）
request は、Copilotとの **あらゆる対話/操作**を指します（認証やフィードバック送信などを除く）。

### 3.2 premium requests
premium requests は、主に次の利用で消費されます。

- **Copilot Chat**（チャット）
- **Copilot code review**（レビュー）
- **Copilot coding agent**（エージェント）
- **third-party coding agents**（外部エージェント）

カウントの考え方（代表例）:
- **coding agent**: 1セッションにつき premium requests を消費（利用モデルの「倍率（multiplier）」で増減）
- **third-party coding agents**: 1プロンプトにつき premium requests を消費（モデル倍率で増減）
- **チャット/レビュー**: 1回の対話/リクエスト単位で premium requests を消費（詳細は公式定義を参照）

premium requests には、プランごとに「含まれる枠（allowance）」があり、超過分が従量課金になる場合があります。カウンターは通常、月次でリセットされます。

公式定義（必読）:
- Requests in GitHub Copilot: https://docs.github.com/en/copilot/concepts/billing/copilot-requests

## 4. 使用量監視（管理者/個人）
運用では「見積もり」よりも「監視」が重要です。特に premium requests は、モデル倍率や運用フローで消費がブレやすいため、管理者/個人ともに確認導線を固定してください。

- **個人**: Billing/Usage（メータリング対象の使用量確認）
- **組織/管理者**: 組織の Billing/Usage、Copilot の premium requests 使用量確認

公式導線（参照）:
- Monitoring your Copilot usage and entitlements: https://docs.github.com/copilot/how-tos/spending/monitoring-your-copilot-usage-and-entitlements
- Viewing your usage of metered products and licenses: https://docs.github.com/billing/how-tos/products/view-productlicense-use

## 5. コストをコントロールする運用チェック
- **実行タイミングを制御**: ラベル付与/手動実行/承認必須で、意図しない実行（=課金/外部送信）を防ぐ
- **モデルの使い分け**: 高倍率モデルは「重要タスク」へ寄せ、日常タスクはAuto/低倍率で運用する
- **最小権限**: write権限・Secrets付与は必要最小（第11章参照）
- **監視と予算**: 月次リセット前提で、上振れ時のアラート/予算統制を用意する

## まとめ
料金は変動し得るため、次を押さえることが重要です。

- コスト要素（席課金/従量課金）を分解して見積もる
- premium requests で「何が1回か」を理解し、運用で消費を制御する
- 管理者/個人の監視導線を固定し、上振れを早期検知する
