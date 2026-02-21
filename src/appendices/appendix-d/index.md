# 付録D：AIツールのコスト計算例

## 1. この付録の目的
AI支援（Copilot/エージェント）を導入する際のコストは、料金表の数値よりも **「課金単位」と「運用フロー」** の影響が大きくなります。本付録では、premium requests（従量）を含む見積もりの型と、運用でのコントロールポイントを示します。

## 2. コストモデル（式で固定する）
料金・無料枠・モデル倍率は変更され得るため、計算式を固定し、単価・無料枠は公式の値で置換します。

```text
月額合計 =
  GitHub（席課金） +
  Copilot（席課金） +
  Actions超過（従量） +
  premium requests超過（従量） +
  その他（ストレージ等）
```

### 2.1 Actions minutes（従量）の式
```text
課金対象minutes = Σ（ジョブ実行minutes × OS乗数）
超過minutes = max(0, 課金対象minutes - 含まれるminutes)
追加費用 = 超過minutes × 単価（公式参照）
```

### 2.2 premium requests（従量）の式
premium requests は、chat/code review/coding agent/third-party agents 等で消費されます。

```text
premium使用量 ≒
  chat回数 +
  code review回数 +
  coding agent セッション数 ×（モデル倍率） +
  third-party agent プロンプト数 ×（モデル倍率）

premium超過 = max(0, premium使用量 - premium含まれる枠) × 単価（公式参照）
```

公式定義（必読）:
- https://docs.github.com/en/copilot/concepts/billing/copilot-requests

## 3. 見積もり例（運用フローで分解する）
### 3.1 個人（Copilotを中心に使う）
変数:
- `C_seat`: Copilotの月額（席）
- `R_included`: premium requests の含まれる枠
- `C_premium`: premium requests 超過単価

計算（概念）:
```text
premium使用量 = chat + review + agent_sessions×M + third_party_prompts×M
月額 = C_seat + max(0, premium使用量 - R_included)×C_premium
```

### 3.2 チーム（10人）でcoding agentを運用する
変数:
- シート数: `N=10`
- 月間Issue数: `I`
- 1Issueあたりのセッション数: `S`（仕様不足/やり直しで増えやすい）
- モデル倍率: `M`

計算（概念）:
```text
premium（agent由来） = I × S × M
premium超過 = max(0, premium総量 - R_included) × C_premium
```

ここで重要なのは、コスト最適化の多くが「単価交渉」ではなく **運用改善（Sを減らす）** によって達成される点です。第2章（Issue=実行仕様）を整備し、やり直しを減らすことが最も効きます。

### 3.3 CIに組み込む（例：Codex GitHub Actionでレビューコメント投稿）
PRごとに自動実行すると、意図しないタイミングで premium requests を消費し得ます。実務では、次のように統制すると運用しやすくなります。

- **ラベル付与で実行**（例: `codex-review`）
- **read-only 実行から開始**（コメント投稿など、書き込みを伴わない用途）
- **権限最小化**（`contents: read` + コメント投稿に必要な権限のみ）

サンプルは `examples/workflows/codex-pr-review-comment.yml` を参照してください。

## 4. 使用量監視（上振れを早期検知する）
premium requests は月次リセット前提です。月末に確認する運用だと、上振れに気づくのが遅れます。

- https://docs.github.com/copilot/how-tos/spending/monitoring-your-copilot-usage-and-entitlements
- https://docs.github.com/billing/how-tos/products/view-productlicense-use

## 5. 最適化（運用で効く打ち手）
- **実行範囲を制御**: ラベル/手動実行/承認必須で、意図しない実行（=課金/外部送信）を防ぐ
- **モデルの使い分け**: 高倍率モデルは重要タスクへ、日常タスクはAuto/低倍率へ寄せる
- **セッションの無駄を減らす**: 受入基準/制約/変更禁止領域/テストをIssueに固定し、やり直しを減らす（第2章）
- **最小権限・Secrets境界**: 権限とSecrets運用を先に設計し、事故のコストを抑える（第11章）
