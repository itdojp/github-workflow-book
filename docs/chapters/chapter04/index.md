---
layout: book
title: "第4章：GitHubでの協働作業入門"
---

# 第4章：GitHubでの協働作業入門

## 4.1 実践例：AI支援による機械学習プロジェクト

本章では、第2章で学んだAI協働の基礎を実際のプロジェクトで実践します。AIを活用しながら、効率的にプロジェクトを立ち上げ、チームで協働する方法を学びます。

### 4.1.1 プロジェクトの初期設定とAI活用

#### AI協働型サンプルプロジェクト：画像分類モデル

**第2章のCLEAR方式でプロジェクト構造をAIに相談**：
```markdown
### Context
機械学習の画像分類プロジェクトを新規に開始します。
PyTorchを使用し、チーム開発を前提としています。

### Logic  
以下の要件を満たすプロジェクト構造を提案してください：
1. MLOps ベストプラクティスに準拠
2. テスト可能な設計
3. 実験管理が容易
4. CI/CD統合を考慮

### Example
一般的なMLプロジェクトのディレクトリ構造

### Action
プロジェクト構造とその理由を説明してください。

### Review
チーム開発での利便性を重視してチェックしてください。
```

**AI提案のプロジェクト構造**（各ディレクトリの役割詳細）：
```text
image-classifier/
├── src/                      # メインソースコード（パッケージとして配布可能）
│   ├── data/                 # データ処理関連
│   │   ├── __init__.py
│   │   ├── dataset.py        # PyTorch Dataset/DataLoader定義
│   │   └── transforms.py     # データ拡張・正規化処理
│   ├── models/               # モデルアーキテクチャ定義
│   │   ├── __init__.py
│   │   ├── base_model.py     # 共通インターフェース・基底クラス
│   │   └── resnet.py         # ResNet等の具体的なモデル実装
│   ├── training/             # 学習・評価ロジック
│   │   ├── __init__.py
│   │   ├── trainer.py        # 学習ループ・チェックポイント管理
│   │   └── metrics.py        # 精度・ロス等の評価指標
│   └── utils/                # ユーティリティ関数
│       └── config.py         # ハイパーパラメータ・設定管理
├── tests/                    # ユニットテスト・統合テスト
├── notebooks/                # 実験・可視化用Jupyter Notebook
├── configs/                  # 設定ファイル（YAML/JSON）
│   ├── model/               # モデル別設定（resnet50.yaml等）
│   ├── training/            # 学習設定（optimizer, scheduler等）
│   └── data/                # データセット設定（パス、拡張設定等）
├── scripts/                 # 実行用スクリプト（train.py, evaluate.py等）
├── docs/                    # API文書・使用方法（Sphinx等）
├── .github/                 # GitHub設定
│   ├── workflows/           # CI/CD設定（テスト・デプロイ自動化）
│   └── ISSUE_TEMPLATE/      # AI協働最適化されたテンプレート
├── requirements.txt          # 依存パッケージ（pip install用）
├── setup.py                 # パッケージ化設定（pip installable）
├── README.md               # プロジェクト概要・AI協働ガイド
├── CONTRIBUTING.md         # 貢献ガイド・AI協働ルール
└── .gitignore              # バージョン管理除外設定
```

#### リポジトリの作成
1. GitHubで「New repository」をクリック
2. リポジトリ名：`image-classifier`
3. 説明：「Simple image classification model using PyTorch」
4. Public/Privateを選択
5. READMEを追加
6. .gitignoreでPythonを選択
7. ライセンスを選択（MIT推奨）

#### 初期コミット
```bash
# ローカルでプロジェクトを作成
mkdir image-classifier
cd image-classifier
git init

# 初期ファイルを作成
echo "# Image Classifier" > README.md
echo "torch==2.0.0" > requirements.txt

# リモートリポジトリを追加
git remote add origin git@github.com:username/image-classifier.git

# 初期コミット
git add .
git commit -m "Initial commit: project setup"
git push -u origin main
```

### 4.1.2 第2章のIssueテンプレートを使った作成実践

ここでは、第2章で学んだAI最適化Issueテンプレートを実際に使用します。

#### Issue作成の基本
GitHubリポジトリページで「Issues」→「New issue」

#### AI協働型機能要望の例（第2章のテンプレート適用）
```markdown
Title: [FEATURE] データ拡張機能の追加

## 🎯 目的・背景
**何を実現したいか**: データローダーに拡張機能を追加
**なぜ必要か**: 現在の学習データでは過学習が発生（val acc: 78%で頭打ち）

## 🔍 AI分析依頼
### Phase 1: 要件分析
- [ ] 最新のデータ拡張手法の調査
- [ ] PyTorchエコシステムでの実装方法比較
- [ ] 計算コストと効果のトレードオフ分析

### Phase 2: 設計提案  
- [ ] 拡張パイプラインのアーキテクチャ
- [ ] 既存コードへの統合方法
- [ ] 設定ファイルでの制御方法

### Phase 3: 実装計画
- [ ] 実装タスクの分解（3-5タスク程度）
- [ ] 各タスクの工数見積もり
- [ ] テスト計画

## 📋 制約条件
- **技術制約**: PyTorch 2.0互換、torchvision使用可
- **性能要件**: 学習速度の低下は10%以内
- **メモリ制約**: GPU 8GB以内で動作
- **互換性**: 既存のデータローダーAPIを維持

## 🎯 成功基準
- [ ] 検証精度: 78% → 82%以上
- [ ] 過学習の抑制: train/val gapを5%以内に
- [ ] 処理速度: 現行比90%以上を維持

## 👥 役割分担
- **人間担当**: 要件定義、効果検証、最終判断
- **AI担当**: 実装コード生成、ベストプラクティス提案
- **協働作業**: 設計レビュー、性能チューニング

## Labels
- enhancement
- ai-collaboration
- performance
```

#### AI協働型バグ報告の例（第2章のテンプレート適用）
````markdown
Title: [BUG] バッチサイズ1でモデル推論時にエラー発生

## 環境情報
- OS: Ubuntu 20.04
- Python: 3.9.0
- PyTorch: 2.0.0
- CUDA: 11.7
- 発生頻度: バッチサイズ1の時100%再現

## 再現手順
1. `python train.py --batch-size 1`を実行
2. 最初のエポックの順伝播でクラッシュ
3. エラーメッセージが表示される

## 期待する動作
バッチサイズ1でも正常に学習・推論が可能

## 実際の動作
```bash
RuntimeError: Expected more than 1 value per channel when training
  at /models/resnet.py:45 in forward()
```

## 関連ファイル
- `src/models/resnet.py:42-48` (BatchNorm2d層の定義)
- `src/training/trainer.py:78-85` (学習ループ)
- `configs/model/resnet50.yaml` (モデル設定)

## AI調査依頼
以下の観点で原因を分析してください：
1. BatchNormalization層の動作モードの確認
2. 学習/評価モードの切り替えタイミング
3. PyTorchバージョン間の仕様差異
4. 回避策と根本的な修正方法の提案

## 初期仮説
BatchNorm層がtraining=Trueの状態でバッチサイズ1を処理できない可能性

## Labels
- bug
- high-priority
- ai-investigation
````

#### Issueテンプレートの活用
`.github/ISSUE_TEMPLATE/`にテンプレートを配置：

`bug_report.md`:
```markdown
---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: 'bug'
assignees: ''
---

## Bug Description
<!-- バグの詳細な説明 -->

## Steps to Reproduce
1. 
2. 
3. 

## Expected vs Actual Behavior
**Expected:**
**Actual:**

## Screenshots
<!-- もしあれば -->

## Environment
- Python version:
- PyTorch version:
- OS:
```

### 4.1.3 ブランチ作成からPull Requestまでの流れ（coding agent 併用）

ここでは、従来の「Issue→ブランチ→PR」だけでなく、Copilot coding agent を使って **Issue→Agent→PR→レビュー→反復** で進める流れも扱います。

#### Copilot coding agent を使う場合（Issue→Agent→PR）
前提：利用可否はプラン/組織ポリシーで変わります。設定は公式ドキュメントを参照してください。

- About coding agent: https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent
- Use Copilot to create/update issues: https://docs.github.com/en/copilot/how-tos/use-copilot-for-common-tasks/use-copilot-to-create-or-update-issues

手順（概要）
1. Issueに「目的/スコープ/受入条件/制約/テスト」を明記する（テンプレ例は `examples/ai-agent-starter/`）
2. IssueをCopilot coding agentに割り当てる（利用できる場合）
3. AgentがPRを作成する
4. 人間がPRをレビューし、受入条件とリスクを判断する（第7章の観点で運用する）
5. 追加修正が必要なら、PRコメントでフィードバックし、反復する

#### エージェントに向く/向かない作業（判断表）
| 観点 | 向く | 向かない |
|---|---|---|
| 仕様の明確さ | 受入条件が明確、テスト手順がある | 目的が曖昧、評価基準がない |
| 変更の性質 | 既存パターンに沿う修正、機械的変更 | 仕様策定、合意形成、例外だらけの設計 |
| リスク | 影響範囲が限定、ロールバック容易 | 認証/暗号/決済/権限など高リスク領域 |
| 依存関係 | リポジトリ内で完結 | 外部システム・契約・運用調整が必要 |

#### 1. Issueからブランチを作成
```bash
# Issue #5のデータ拡張機能を実装
git checkout -b feature/data-augmentation-#5
```

#### 2. 実装
`src/data_loader.py`を編集：
```python
import torchvision.transforms as transforms

def get_train_transforms():
    """訓練用のデータ拡張を定義"""
    return transforms.Compose([
        transforms.RandomRotation(15),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2),
        transforms.RandomCrop(224, padding=4),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                           std=[0.229, 0.224, 0.225])
    ])
```

#### 3. コミット
```bash
# 変更を確認
git diff

# テストを実行
pytest tests/test_data_loader.py

# コミット
git add src/data_loader.py
git commit -m "feat: Add data augmentation transforms (#5)

- Add random rotation (±15 degrees)
- Add random horizontal flip
- Add brightness adjustment (±20%)
- Add random crop with padding"
```

#### 4. プッシュ
```bash
git push -u origin feature/data-augmentation-#5
```

#### 5. Pull Requestの作成
GitHubで「Compare & pull request」をクリック

**PR内容の例：**
```markdown
Title: Add data augmentation functionality

## Description
Fixes #5 

このPRは、訓練データの拡張機能を追加します。

## Changes
- `get_train_transforms()`関数を追加
- 4種類のデータ拡張を実装
  - ランダム回転
  - 水平フリップ
  - 明度調整
  - ランダムクロップ

## Testing
- [x] ユニットテストを追加
- [x] 既存のテストがパス
- [x] 手動で動作確認

## Performance Impact
- メモリ使用量：変化なし
- 訓練時間：エポックあたり約5%増加
- 目標（例）：精度2〜3%向上

## Screenshots
訓練前後の画像サンプル：
![Before](url) ![After](url)

## Checklist
- [x] コードはPEP8に準拠
- [x] ドキュメントを更新
- [x] テストを追加/更新
- [x] 関連するIssueをリンク
```

### 4.1.4 レビューコメントへの対応

#### レビューコメントの例

**レビュアー1のコメント：**
````markdown
Line 15 in data_loader.py:

```python
transforms.RandomCrop(224, padding=4),
```

画像サイズが224固定になっていますが、設定可能にした方が良いのでは？
````

**対応方法1：コードの修正**
```python
def get_train_transforms(image_size=224):
    """訓練用のデータ拡張を定義
    
    Args:
        image_size (int): 出力画像のサイズ
    """
    return transforms.Compose([
        transforms.RandomRotation(15),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2),
        transforms.RandomCrop(image_size, padding=4),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                           std=[0.229, 0.224, 0.225])
    ])
```

**コメントへの返信：**
```markdown
ご指摘ありがとうございます。確かに固定値は柔軟性に欠けますね。
`image_size`パラメータを追加しました。デフォルト値は224のままにしています。
コミット: abc123
```

**レビュアー2のコメント：**
```markdown
データ拡張の強度が強すぎる可能性があります。
特に回転角度15度は、物体検出タスクでは大きすぎるかもしれません。
```

**対応方法2：議論**
````markdown
確かにタスクによって適切な拡張の強度は異なりますね。
現在は画像分類を想定していますが、将来的に他のタスクにも対応することを考えると、
拡張の強度も設定可能にすべきでしょうか？

例：
```python
def get_train_transforms(image_size=224, aug_strength='medium'):
    strength_config = {
        'light': {'rotation': 5, 'brightness': 0.1},
        'medium': {'rotation': 15, 'brightness': 0.2},
        'strong': {'rotation': 30, 'brightness': 0.3}
    }
```

どう思われますか？
````

#### 修正の追加コミット
```bash
# レビューに基づく修正
git add src/data_loader.py
git commit -m "refactor: Make image size configurable in transforms

- Add image_size parameter with default 224
- Update docstring with parameter description"

git push
```

### 4.1.5 マージ、却下、クローズの判断基準

#### マージの条件
1. **すべてのテストがパス**
2. **レビュー承認を取得**（通常1-2名）
3. **コンフリクトが解決済み**
4. **ドキュメントが更新済み**
5. **コード品質基準を満たす**

#### マージ方法の選択

**Merge commit**（デフォルト）
```bash
# PRの履歴を保持
Merge pull request #10 from user/feature-branch
```
- メリット：完全な履歴を保持
- デメリット：履歴が複雑になる

**Squash and merge**
```bash
# すべてのコミットを1つにまとめる
feat: Add data augmentation functionality (#10)
```
- メリット：履歴がクリーン
- デメリット：詳細な履歴が失われる

**Rebase and merge**
```bash
# コミットを直線的に追加
feat: Add transform function
refactor: Make size configurable
docs: Update README
```
- メリット：直線的な履歴
- デメリット：コミットハッシュが変更される

#### 却下の理由と方法

**却下する場合の例：**
1. **方針に合わない実装**
```markdown
このPRの実装方針について議論した結果、プロジェクトの設計方針と
合わないという結論に達しました。

代替案として、#15で別のアプローチを検討することになりました。
貴重な時間を使って実装していただきありがとうございました。
```

2. **品質基準を満たさない**
```markdown
レビューの結果、以下の問題があります：
- テストカバレッジが不十分（現在: 45%、要求: 80%以上）
- パフォーマンスの大幅な低下（3倍の実行時間）

これらの問題を解決するには大幅な書き直しが必要なため、
一旦このPRはクローズし、新たなアプローチを検討します。
```

#### 自動クローズの設定

**stale bot**の活用：
`.github/stale.yml`:
```yaml
# 60日間更新がないIssue/PRを自動的にstaleとマーク
daysUntilStale: 60
# stale後14日でクローズ
daysUntilClose: 14
# staleマークのラベル
staleLabel: wontfix
# 除外するラベル
exemptLabels:
  - pinned
  - security
```

## 4.2 ラベルとマイルストーンの活用

### ラベルの設計
```yaml
# バグ・問題
- bug: 不具合
- critical: 緊急度高
- performance: パフォーマンス問題

# 機能・改善
- enhancement: 機能追加
- feature: 新機能
- refactor: リファクタリング

# ドキュメント
- documentation: ドキュメント
- example: サンプルコード

# メンテナンス
- dependencies: 依存関係
- ci/cd: CI/CD関連
- test: テスト

# ステータス
- in progress: 作業中
- needs review: レビュー待ち
- blocked: ブロック中

# 優先度
- P0: 最優先
- P1: 高
- P2: 中
- P3: 低
```

### マイルストーンの設定
```markdown
Milestone: v1.0.0 Release
Due date: 2024-06-01

Goals:
- Basic model training pipeline
- Data augmentation
- Evaluation metrics
- Documentation

Progress: 7/10 issues closed (70%)
```

## 4.3 プロジェクトボードでのタスク管理

### カンバンボードの設定
列の構成：
1. **Backlog**: 未着手のタスク
2. **To Do**: 次に取り組むタスク
3. **In Progress**: 作業中
4. **Review**: レビュー中
5. **Done**: 完了

### 自動化ルール
- Issueが作成されたら「Backlog」に追加
- PRが作成されたら「In Progress」に移動
- PRがマージされたら「Done」に移動

## 4.4 Issueテンプレートの作成

### 複数のテンプレート
`.github/ISSUE_TEMPLATE/`:
- `bug_report.md`
- `feature_request.md`
- `experiment_proposal.md`

### 実験提案テンプレート
```markdown
---
name: Experiment Proposal
about: Propose a new ML experiment
title: '[EXPERIMENT] '
labels: 'experiment'
---

## Hypothesis
<!-- 検証したい仮説 -->

## Approach
<!-- 実験方法 -->

## Metrics
<!-- 評価指標 -->

## Resources Required
- GPU hours:
- Dataset:
- Time estimate:

## Success Criteria
<!-- 成功の判断基準 -->
```

## まとめ

本章では、GitHubでの協働作業の実践を学習しました。主なポイントは次のとおりです。
- Issueで課題を管理し、議論を記録
- Pull Requestで変更をレビュー
- レビューコメントで品質を向上
- ラベルとマイルストーンで整理
- プロジェクトボードで進捗を可視化

次章では、GitHubアカウントとリポジトリの管理について詳しく学習します。

## 確認事項

- [ ] Issueの作成と管理ができる
- [ ] Pull Requestの作成からマージまでの流れを理解している
- [ ] レビューコメントへの対応方法を知っている
- [ ] ラベルとマイルストーンを活用できる
- [ ] プロジェクトボードでタスク管理ができる
