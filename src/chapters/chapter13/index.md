# 第13章：CI/CDパイプライン構築

## 13.1 GitHub Actionsの基本構造とAI活用

### 第2章の品質ゲートを統合したCI/CD
本章では、第2章で学んだAI協働品質ゲートをCI/CDパイプラインに統合します。

### coding agent とCI/CD（補足）
Copilot coding agent を使ってPRを作る場合でも、CI/CDの基本は変わりません。AI生成PRだけを特別扱いするよりも、**同じ品質ゲート（必須チェック）に乗せる**方が運用が安定します。

- PRテンプレで「AI利用の開示」と「人間の検証責任」を固定する（例：`examples/ai-agent-starter/`）
- 受入条件（Issue）とテスト手順がPRから追える状態にする
- 重要な変更は、AIレビューだけでなくCI（テスト/静的解析）でブロックできるようにする

### この章の例の読み方
本章では、例を次の2種類に分けて示します。

- **実運用例（このまま使える）**：`examples/` 配下にあるワークフロー例。必要に応じて自分のリポジトリ事情に合わせて調整して使います。
- **概念例（擬似/抜粋）**：考え方や構造を説明するための例。ワークフロー全体ではない「抜粋」も含むため、コピペ前提では扱いません。

### ワークフローの基本要素

### merge queue を使う場合の注意（`merge_group`）

merge queue を有効にしている場合、必須チェック（required status checks）は「PRの先にある最終的なマージ結果」に対しても通る必要があります。GitHub Actions を必須チェックにしている場合、ワークフローが `pull_request` だけで起動する設計だと、merge queue 側のチェックが満たせずに詰まることがあります。

そのため、必須チェックにしているワークフローは `merge_group` イベントにも対応させます。

```yaml
on:
  pull_request:
  merge_group:
    types: [checks_requested]
```

参考:
- merge queue: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- `merge_group` イベント: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group
- サンプル: `examples/merge-queue-ci-example/`

#### AI協働品質ゲート統合のワークフロー構造
**実運用例（このまま使える）**：全文は `examples/ai-collaboration-pipeline-example/` を参照してください。以下は最小構成の例です（チェック内容はプロジェクトに合わせて置き換えます）。
{% raw %}
```yaml
# .github/workflows/ai-collaboration-quality-gate.yml
name: AI Collaboration Quality Gate

on:
  pull_request:
  merge_group:
    types: [checks_requested]

permissions:
  contents: read
  pull-requests: read

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run checks
        run: |
          echo "Replace this step with your test/lint/security checks."

      - name: Validate AI disclosure (pull_request only)
        if: ${{ github.event_name == 'pull_request' }}
        run: |
          if ! echo "${{ github.event.pull_request.body }}" | grep -q "AI利用の開示"; then
            echo "PR本文に「AI利用の開示」がありません"
            exit 1
          fi
```
{% endraw %}

### マトリックスビルド

#### 複数環境でのテスト
**概念例（抜粋）**：`jobs.test` の構造例です（ワークフロー全体ではありません）。
{% raw %}
```yaml
test:
  needs: setup
  strategy:
    fail-fast: false
    matrix:
      os: [ubuntu-latest, windows-latest, macos-latest]
      python-version: ['3.8', '3.9', '3.10']
      torch-version: ['1.13.0', '2.0.0']
      exclude:
        - os: macos-latest
          torch-version: '1.13.0'  # M1 Macでは2.0以降推奨
      include:
        - os: ubuntu-latest
          python-version: '3.9'
          torch-version: '2.0.0'
          cuda-version: '11.8'
          
  runs-on: ${{ matrix.os }}
  
  steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v6
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install PyTorch ${{ matrix.torch-version }}
      run: |
        pip install torch==${{ matrix.torch-version }}
        
    - name: Run tests
      run: |
        pytest tests/ -v --cov=src --cov-report=xml
        
    - name: Upload coverage
      uses: codecov/codecov-action@671740ac38dd9b0130fbe1cec585b89eea48d3de  # v5
      with:
        file: ./coverage.xml
        flags: unittests
        name: codecov-${{ matrix.os }}-py${{ matrix.python-version }}
```
{% endraw %}

### カスタムアクション

#### 再利用可能なアクション
**概念例（参考実装）**：カスタムアクションの構造例です。依存関係やOS差分は環境に合わせて要調整です。
{% raw %}
```yaml
# .github/actions/setup-ml-env/action.yml
name: 'Setup ML Environment'
description: 'Set up Python with ML dependencies'

inputs:
  python-version:
    description: 'Python version'
    required: false
    default: '3.9'
  cuda-version:
    description: 'CUDA version'
    required: false
    default: '11.8'
  cache-dependencies:
    description: 'Cache pip dependencies'
    required: false
    default: 'true'

outputs:
  cache-hit:
    description: 'Cache hit status'
    value: ${{ steps.cache.outputs.cache-hit }}

runs:
  using: 'composite'
  steps:
    - name: Set up Python
      uses: actions/setup-python@v6
      with:
        python-version: ${{ inputs.python-version }}
    
    - name: Setup CUDA
      if: runner.os == 'Linux' && inputs.cuda-version != 'cpu'
      shell: bash
      run: |
        wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/cuda-keyring_1.0-1_all.deb
        sudo dpkg -i cuda-keyring_1.0-1_all.deb
        sudo apt-get update
        sudo apt-get -y install cuda-${{ inputs.cuda-version }}
    
    - name: Cache dependencies
      if: inputs.cache-dependencies == 'true'
      id: cache
      uses: actions/cache@v4
      with:
        path: |
          ~/.cache/pip
          ~/.cache/torch
          ~/.cache/transformers
        key: ${{ runner.os }}-ml-${{ inputs.python-version }}-${{ hashFiles('**/requirements*.txt') }}
    
    - name: Install dependencies
      shell: bash
      run: |
        pip install --upgrade pip setuptools wheel
        pip install -r requirements.txt
        
        # CUDA対応PyTorchのインストール
        if [ "${{ inputs.cuda-version }}" != "cpu" ]; then
          pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu${{ inputs.cuda-version }}
        fi
```
{% endraw %}

## 13.2 AIモデル学習の自動化

### 学習パイプライン

#### GPU対応ワークフロー
{% raw %}
```yaml
# .github/workflows/train-model.yml
name: Model Training

on:
  workflow_dispatch:
    inputs:
      model_name:
        description: 'Model architecture'
        required: true
        default: 'resnet50'
        type: choice
        options:
          - resnet50
          - efficientnet_b0
          - vit_base
      dataset:
        description: 'Dataset to use'
        required: true
        default: 'imagenet'
      epochs:
        description: 'Number of epochs'
        required: false
        default: '100'

jobs:
  train:
    runs-on: [self-hosted, gpu]  # セルフホストランナー（GPU付き）
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup ML environment
        uses: ./.github/actions/setup-ml-env
        with:
          python-version: '3.9'
          cuda-version: '11.8'
      
      - name: Download dataset
        run: |
          python scripts/download_dataset.py \
            --dataset ${{ github.event.inputs.dataset }} \
            --output-dir ./data
      
      - name: Configure training
        run: |
          cat > config.yaml << EOF
          model:
            name: ${{ github.event.inputs.model_name }}
            pretrained: true
          
          training:
            epochs: ${{ github.event.inputs.epochs }}
            batch_size: 32
            learning_rate: 0.001
            optimizer: adam
            scheduler: cosine
          
          data:
            dataset: ${{ github.event.inputs.dataset }}
            num_workers: 8
            augmentation: true
          
          logging:
            wandb_project: github-actions-training
            log_interval: 100
          EOF
      
      - name: Run training
        run: |
          export WANDB_API_KEY="${{ secrets.WANDB_API_KEY }}"
          python train.py \
            --config config.yaml \
            --output-dir ./outputs \
            --checkpoint-dir ./checkpoints
      
      - name: Evaluate model
        run: |
          python evaluate.py \
            --checkpoint ./checkpoints/best_model.pth \
            --dataset ${{ github.event.inputs.dataset }} \
            --output-file evaluation_report.json
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: model-${{ github.event.inputs.model_name }}-${{ github.run_id }}
          path: |
            checkpoints/best_model.pth
            outputs/training_log.csv
            evaluation_report.json
            config.yaml
          retention-days: 30
      
      - name: Create model card
        run: |
          python scripts/create_model_card.py \
            --model-path ./checkpoints/best_model.pth \
            --config config.yaml \
            --evaluation evaluation_report.json \
            --output model_card.md
      
      - name: Publish model to registry
        if: github.ref == 'refs/heads/main'
        run: |
          python scripts/publish_model.py \
            --model-path ./checkpoints/best_model.pth \
            --model-card model_card.md \
            --registry ${{ secrets.MODEL_REGISTRY_URL }} \
            --version ${{ github.sha }}
```
{% endraw %}

### ハイパーパラメータチューニング

#### 並列実験の実行
{% raw %}
```yaml
# .github/workflows/hyperparameter-search.yml
name: Hyperparameter Search

on:
  workflow_dispatch:
    inputs:
      search_space:
        description: 'Hyperparameter search space (JSON)'
        required: true
        default: '{"lr": [0.001, 0.01, 0.1], "batch_size": [16, 32, 64]}'

jobs:
  generate-configs:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.generate.outputs.matrix }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate experiment matrix
        id: generate
        run: |
          python scripts/generate_hp_configs.py \
            --search-space '${{ github.event.inputs.search_space }}' \
            --output-file matrix.json
          
          echo "matrix=$(cat matrix.json)" >> $GITHUB_OUTPUT
  
  experiment:
    needs: generate-configs
    strategy:
      matrix: ${{ fromJson(needs.generate-configs.outputs.matrix) }}
      max-parallel: 4  # 同時実行数の制限
      
    runs-on: [self-hosted, gpu]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-ml-env
      
      - name: Run experiment
        run: |
          export WANDB_API_KEY="${{ secrets.WANDB_API_KEY }}"
          python train.py \
            --config base_config.yaml \
            --override "training.learning_rate=${{ matrix.lr }}" \
            --override "training.batch_size=${{ matrix.batch_size }}" \
            --experiment-name "hp_search_lr${{ matrix.lr }}_bs${{ matrix.batch_size }}"
      
      - name: Report results
        run: |
          python scripts/report_experiment.py \
            --experiment-name "hp_search_lr${{ matrix.lr }}_bs${{ matrix.batch_size }}" \
            --metrics accuracy,loss,training_time
  
  analyze-results:
    needs: experiment
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Collect all results
        run: |
          python scripts/collect_hp_results.py \
            --experiment-prefix "hp_search_" \
            --output hp_results.csv
      
      - name: Generate report
        run: |
          python scripts/analyze_hp_results.py \
            --results hp_results.csv \
            --output hp_report.md
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('hp_report.md', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
```
{% endraw %}

## 13.3 テストとリンターの統合

### 包括的なテストスイート

#### MLコードのテスト戦略
```yaml
# .github/workflows/test-suite.yml
name: Test Suite

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v6
        with:
          python-version: '3.9'
      
      - name: Install linting tools
        run: |
          pip install black flake8 isort mypy pylint
      
      - name: Run Black
        run: black --check src/ tests/
        
      - name: Run isort
        run: isort --check-only src/ tests/
        
      - name: Run Flake8
        run: flake8 src/ tests/ --config .flake8
        
      - name: Run mypy
        run: mypy src/ --config-file mypy.ini
        
      - name: Run Pylint
        run: pylint src/ --rcfile=.pylintrc
  
  unit-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup ML environment
        uses: ./.github/actions/setup-ml-env
        with:
          cuda-version: 'cpu'  # CPUのみでテスト
      
      - name: Run unit tests
        run: |
          pytest tests/unit/ \
            -v \
            --cov=src \
            --cov-report=xml \
            --cov-report=html \
            --junitxml=junit/test-results.xml
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: |
            junit/test-results.xml
            htmlcov/
  
  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-ml-env
      
      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
        run: |
          pytest tests/integration/ -v --maxfail=1
  
  model-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-ml-env
      
      - name: Download test data
        run: |
          python scripts/download_test_data.py --output-dir ./test_data
      
      - name: Test model inference
        run: |
          pytest tests/models/ \
            -v \
            -m "not slow" \
            --benchmark-only
      
      - name: Test model robustness
        run: |
          python tests/robustness/test_adversarial.py
          python tests/robustness/test_edge_cases.py
      
      - name: Memory profiling
        run: |
          python -m memory_profiler tests/profiling/test_memory_usage.py
```

### コード品質メトリクス

#### 品質ダッシュボード
```python
# scripts/code_quality_report.py
import subprocess
import json
from pathlib import Path

class CodeQualityReporter:
    def __init__(self, source_dir='src'):
        self.source_dir = Path(source_dir)
        
    def run_all_checks(self):
        """全ての品質チェックを実行"""
        results = {
            'complexity': self.check_complexity(),
            'coverage': self.check_coverage(),
            'duplicates': self.check_duplicates(),
            'security': self.check_security(),
            'docstring': self.check_docstrings()
        }
        
        return results
    
    def check_complexity(self):
        """循環的複雑度をチェック"""
        result = subprocess.run(
            ['radon', 'cc', str(self.source_dir), '-j'],
            capture_output=True,
            text=True
        )
        
        complexity_data = json.loads(result.stdout)
        
        # 統計を計算
        total_complexity = 0
        high_complexity_functions = []
        
        for file_path, functions in complexity_data.items():
            for func in functions:
                total_complexity += func['complexity']
                if func['complexity'] > 10:
                    high_complexity_functions.append({
                        'name': func['name'],
                        'file': file_path,
                        'complexity': func['complexity']
                    })
        
        return {
            'average_complexity': total_complexity / len(functions) if functions else 0,
            'high_complexity_count': len(high_complexity_functions),
            'details': high_complexity_functions[:10]  # Top 10
        }
    
    def check_coverage(self):
        """テストカバレッジをチェック"""
        result = subprocess.run(
            ['coverage', 'json', '-o', '-'],
            capture_output=True,
            text=True
        )
        
        coverage_data = json.loads(result.stdout)
        
        return {
            'total_coverage': coverage_data['totals']['percent_covered'],
            'files': {
                file: data['summary']['percent_covered']
                for file, data in coverage_data['files'].items()
                if file.startswith(str(self.source_dir))
            }
        }
    
    def generate_report(self, results):
        """品質レポートを生成"""
        report = """# Code Quality Report

## Summary

| Metric | Value | Status |
|--------|-------|--------|
| Average Complexity | {complexity:.2f} | {complexity_status} |
| Test Coverage | {coverage:.1f}% | {coverage_status} |
| Duplicate Lines | {duplicates:.1f}% | {duplicate_status} |
| Security Issues | {security} | {security_status} |
| Documentation | {docs:.1f}% | {docs_status} |

## Details

### High Complexity Functions
{complexity_details}

### Low Coverage Files
{coverage_details}

### Security Warnings
{security_details}

## Recommendations
{recommendations}
""".format(
            complexity=results['complexity']['average_complexity'],
            complexity_status=self._get_status(results['complexity']['average_complexity'], 5, 10),
            coverage=results['coverage']['total_coverage'],
            coverage_status=self._get_status(results['coverage']['total_coverage'], 80, 60, reverse=True),
            # ... 他のメトリクス
        )
        
        return report
```

## 13.4 Copilotを活用したワークフロー作成

### AI支援ワークフロー開発

#### Copilotプロンプト活用
{% raw %}
```yaml
# Copilotへのプロンプト例
# "Create a GitHub Actions workflow that runs distributed training on multiple GPUs"

name: Distributed Training

on:
  workflow_dispatch:
    inputs:
      num_nodes:
        description: 'Number of nodes'
        required: true
        default: '2'
      gpus_per_node:
        description: 'GPUs per node'
        required: true
        default: '4'

jobs:
  setup-cluster:
    runs-on: ubuntu-latest
    outputs:
      master_addr: ${{ steps.setup.outputs.master_addr }}
      master_port: ${{ steps.setup.outputs.master_port }}
    
    steps:
      - name: Setup distributed training cluster
        id: setup
        run: |
          # Copilotが生成したクラスタセットアップコード
          MASTER_ADDR=$(hostname -I | awk '{print $1}')
          MASTER_PORT=29500
          
          echo "master_addr=$MASTER_ADDR" >> $GITHUB_OUTPUT
          echo "master_port=$MASTER_PORT" >> $GITHUB_OUTPUT
  
  distributed-training:
    needs: setup-cluster
    strategy:
      matrix:
        node: [0, 1]  # 2ノードの例
    
    runs-on: [self-hosted, gpu-cluster]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup distributed environment
        run: |
          export MASTER_ADDR=${{ needs.setup-cluster.outputs.master_addr }}
          export MASTER_PORT=${{ needs.setup-cluster.outputs.master_port }}
          export WORLD_SIZE=${{ github.event.inputs.num_nodes }}
          export RANK=${{ matrix.node }}
      
      - name: Run distributed training
        run: |
          python -m torch.distributed.launch \
            --nproc_per_node=${{ github.event.inputs.gpus_per_node }} \
            --nnodes=${{ github.event.inputs.num_nodes }} \
            --node_rank=${{ matrix.node }} \
            --master_addr=${{ needs.setup-cluster.outputs.master_addr }} \
            --master_port=${{ needs.setup-cluster.outputs.master_port }} \
            train_distributed.py \
            --config config/distributed_training.yaml
```
{% endraw %}

### 13.4.1 Codex GitHub Action で「差分レビューコメント」を自動投稿する（例）
エージェントを「手動利用」から「品質ゲート/自動化」へ接続する入口として、Codex GitHub Action を使い、PR差分に対するレビューコメント（要約、リスク、追加検証案）を投稿する例を示します。

注: ここで示す Codex GitHub Action は **GitHub Copilot のネイティブ機能ではなく**、OpenAI の Codex CLI を GitHub Actions から実行する third-party の例です。Secrets（例: `OPENAI_API_KEY`）や外部送信範囲、課金を前提に導入可否を判断してください。

ポイントは次のとおりです。

- **権限を最小化**: 差分レビュー用途なら `contents: read` と、コメント投稿用の `pull-requests: write` 程度に絞る
- **Secrets境界を明記**: `secrets.OPENAI_API_KEY` を `with.openai-api-key` に渡し、ログ/PR本文へ出さない
- **実行範囲を制御**: ラベル付与などで実行を明示し、意図しないタイミングでの課金・外部送信を避ける
- **安全策を明示**: `sandbox`（FS/network）と `safety-strategy`（OS権限）を明示し、権限境界を固定する

以下はサンプルです（導入時は、モデル/課金/ポリシー・データ送信範囲を組織の基準に合わせて設計してください）。

{% raw %}
```yaml
name: Codex PR Review Comment (on label)

on:
  pull_request:
    types: [labeled]

jobs:
  codex_review:
    if: github.event.label.name == 'codex-review'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      final_message: ${{ steps.run_codex.outputs.final-message }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: refs/pull/${{ github.event.pull_request.number }}/merge

      - name: Pre-fetch base and head refs
        run: |
          git fetch --no-tags origin \
            ${{ github.event.pull_request.base.ref }} \
            +refs/pull/${{ github.event.pull_request.number }}/head

      - name: Run Codex (read-only)
        id: run_codex
        uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          sandbox: read-only
          safety-strategy: drop-sudo
          prompt: |
            Review ONLY the changes introduced by the PR.
            Be concise and specific. Include risk and suggested verification.

            Pull request title and body:
            ----
            ${{ github.event.pull_request.title }}
            ${{ github.event.pull_request.body }}

  post_comment:
    runs-on: ubuntu-latest
    needs: codex_review
    if: needs.codex_review.outputs.final_message != ''
    permissions:
      issues: write
      pull-requests: write
    steps:
      - name: Post review comment
        uses: actions/github-script@v7
        env:
          CODEX_FINAL_MESSAGE: ${{ needs.codex_review.outputs.final_message }}
        with:
          github-token: ${{ github.token }}
          script: |
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.pull_request.number,
              body: process.env.CODEX_FINAL_MESSAGE,
            });
```
{% endraw %}

### 13.4.2 注意：Secrets/権限/外部送信の線引き
CodexのようなエージェントをCIに組み込む場合、失敗の大半は「実装」ではなく「権限境界/Secrets運用」で発生します。

- **Actions権限**: `permissions:` を明示し、用途ごとにワークフローを分ける
- **Secrets**: ログ/Artifacts/コメントへの混入を前提にレビュー観点へ入れる
- **外部送信**: どの情報が外部へ送られるか（プロンプト、差分、ログ）を定義し、許容範囲を決める

注: `sandbox` / `safety-strategy` は補助策であり、Secretsの露出（ログ/コメント）を自動でゼロにするものではありません。Secrets運用（出さない/残さない）と監査設計（根拠の記録）を組み合わせて境界を設計してください。

詳細は第11章（Secrets/権限境界/監査）を参照してください。

### ワークフロー最適化

#### キャッシングとアーティファクト管理
{% raw %}
```yaml
# .github/workflows/optimized-pipeline.yml
name: Optimized ML Pipeline

on: [push, pull_request]

env:
  SEGMENT_DOWNLOAD_TIMEOUT_MINS: 5

jobs:
  build-and-cache:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      # Docker層のキャッシュ
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Cache Docker layers
        uses: actions/cache@v4
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-buildx-
      
      # モデルのキャッシュ
      - name: Cache ML models
        uses: actions/cache@v4
        with:
          path: |
            ~/.cache/huggingface
            ~/.cache/torch
            ./models/pretrained
          key: ${{ runner.os }}-models-${{ hashFiles('**/model_requirements.txt') }}
      
      # データセットのキャッシュ
      - name: Cache datasets
        uses: actions/cache@v4
        with:
          path: ./data
          key: ${{ runner.os }}-datasets-${{ hashFiles('**/data_config.yaml') }}
      
      # ビルドとテスト
      - name: Build Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          tags: ml-app:latest
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max
      
      # キャッシュのローテーション
      - name: Move cache
        run: |
          rm -rf /tmp/.buildx-cache
          mv /tmp/.buildx-cache-new /tmp/.buildx-cache
```
{% endraw %}

## 13.5 デプロイメントの自動化

### モデルデプロイメントパイプライン

#### 段階的デプロイメント
{% raw %}
```yaml
# .github/workflows/deploy-model.yml
name: Model Deployment

on:
  push:
    tags:
      - 'model-v*'

jobs:
  validate-model:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download model artifact
        uses: actions/download-artifact@v4
        with:
          name: trained-model
          path: ./model
      
      - name: Validate model
        run: |
          python scripts/validate_model.py \
            --model-path ./model/model.pth \
            --test-data ./data/test \
            --threshold 0.85
      
      - name: Generate model report
        run: |
          python scripts/generate_model_report.py \
            --model-path ./model/model.pth \
            --output model_report.html
      
      - name: Upload validation results
        uses: actions/upload-artifact@v4
        with:
          name: validation-results
          path: |
            model_report.html
            validation_metrics.json
  
  deploy-staging:
    needs: validate-model
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to SageMaker Staging
        run: |
          python scripts/deploy_sagemaker.py \
            --model-path s3://models/staging/model.tar.gz \
            --endpoint-name staging-endpoint \
            --instance-type ml.g4dn.xlarge \
            --environment staging
      
      - name: Run smoke tests
        run: |
          python scripts/smoke_tests.py \
            --endpoint-url ${{ steps.deploy.outputs.endpoint_url }} \
            --test-samples 100
  
  canary-deployment:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy canary version
        run: |
          python scripts/canary_deploy.py \
            --model-path s3://models/production/model.tar.gz \
            --traffic-percentage 10 \
            --monitor-duration 3600  # 1時間監視
      
      - name: Monitor canary metrics
        run: |
          python scripts/monitor_deployment.py \
            --deployment-id ${{ steps.canary.outputs.deployment_id }} \
            --metrics latency,error_rate,accuracy \
            --threshold-config thresholds.yaml
      
      - name: Promote or rollback
        run: |
          python scripts/deployment_decision.py \
            --deployment-id ${{ steps.canary.outputs.deployment_id }} \
            --auto-promote true \
            --rollback-on-failure true
  
  full-deployment:
    needs: canary-deployment
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Full production deployment
        run: |
          python scripts/production_deploy.py \
            --model-path s3://models/production/model.tar.gz \
            --endpoint-name production-endpoint \
            --instance-count 3 \
            --instance-type ml.g4dn.xlarge
      
      - name: Update model registry
        run: |
          python scripts/update_model_registry.py \
            --model-name ${{ github.ref_name }} \
            --version ${{ github.sha }} \
            --endpoint production-endpoint \
            --metadata deployment_metadata.json
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Model ${{ github.ref_name }} deployed to production'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```
{% endraw %}

### 監視とロールバック

#### 自動ロールバック機構
```python
# scripts/deployment_monitor.py
import boto3
import time
from datetime import datetime, timedelta

class DeploymentMonitor:
    def __init__(self, endpoint_name, cloudwatch_client=None):
        self.endpoint_name = endpoint_name
        self.cloudwatch = cloudwatch_client or boto3.client('cloudwatch')
        self.sagemaker = boto3.client('sagemaker')
        
    def monitor_deployment(self, duration_minutes=30, check_interval=60):
        """デプロイメントを監視"""
        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=duration_minutes)
        
        metrics_history = []
        
        while datetime.now() < end_time:
            metrics = self.collect_metrics()
            metrics_history.append(metrics)
            
            # 異常検知
            if self.detect_anomalies(metrics):
                return {
                    'status': 'anomaly_detected',
                    'metrics': metrics,
                    'action': 'rollback'
                }
            
            time.sleep(check_interval)
        
        # 正常終了
        return {
            'status': 'healthy',
            'metrics_summary': self.summarize_metrics(metrics_history),
            'action': 'promote'
        }
    
    def collect_metrics(self):
        """メトリクスを収集"""
        end_time = datetime.now()
        start_time = end_time - timedelta(minutes=5)
        
        metrics = {}
        
        # レイテンシー
        latency = self.get_metric(
            'ModelLatency',
            'AWS/SageMaker',
            start_time,
            end_time,
            'Average'
        )
        metrics['latency_ms'] = latency
        
        # エラー率
        invocations = self.get_metric(
            'Invocations',
            'AWS/SageMaker',
            start_time,
            end_time,
            'Sum'
        )
        
        errors = self.get_metric(
            'ModelInvocation4XXErrors',
            'AWS/SageMaker',
            start_time,
            end_time,
            'Sum'
        ) + self.get_metric(
            'ModelInvocation5XXErrors',
            'AWS/SageMaker',
            start_time,
            end_time,
            'Sum'
        )
        
        metrics['error_rate'] = errors / invocations if invocations > 0 else 0
        
        # カスタムメトリクス（精度など）
        metrics['accuracy'] = self.get_custom_metric('ModelAccuracy')
        
        return metrics
    
    def detect_anomalies(self, metrics):
        """異常を検知"""
        thresholds = {
            'latency_ms': 1000,      # 1秒以上
            'error_rate': 0.05,      # 5%以上
            'accuracy': 0.8          # 80%未満
        }
        
        for metric, threshold in thresholds.items():
            if metric == 'accuracy':
                if metrics.get(metric, 1.0) < threshold:
                    return True
            else:
                if metrics.get(metric, 0) > threshold:
                    return True
        
        return False
    
    def rollback_deployment(self, previous_version):
        """デプロイメントをロールバック"""
        # 現在のエンドポイント設定を取得
        endpoint_config = self.sagemaker.describe_endpoint_config(
            EndpointConfigName=self.endpoint_name + '-config'
        )
        
        # 前のバージョンに戻す
        self.sagemaker.update_endpoint(
            EndpointName=self.endpoint_name,
            EndpointConfigName=previous_version + '-config'
        )
        
        # ロールバック完了を待つ
        waiter = self.sagemaker.get_waiter('endpoint_in_service')
        waiter.wait(EndpointName=self.endpoint_name)
        
        return {
            'status': 'rollback_complete',
            'previous_version': previous_version,
            'timestamp': datetime.now().isoformat()
        }
```

## 13.6 再利用の設計：Composite Actions vs Reusable Workflows

実運用でCI/CDを育てていくと、「同じ処理を複数のワークフローで再利用したい」局面が頻繁に発生します。GitHub Actions では主に次の2つの再利用手段があります。

- Composite Action：**step（手順）単位**の再利用（同一 job 内）
- Reusable Workflow：**job/ワークフロー単位**の再利用（`workflow_call` で呼び出す）

### 使い分けの目安（最小）

- Composite Action が向く
  - どのワークフローでも繰り返す「手順の塊」（例：セットアップ、キャッシュ、lint 実行）
  - 呼び出し側の job が持つ権限/runner をそのまま使いたい
- Reusable Workflow が向く
  - job 構成（`runs-on` / `needs` / `permissions` / `concurrency` / `environment`）まで含めて共通化したい
  - 複数リポジトリで同じCIを共有したい（`owner/repo/.github/workflows/...@ref` で呼び出す）

### 最小例（`workflow_call`）

全文は `examples/reusable-workflows-ci-example/` を参照してください。以下は概念を示す最小例です。

{% raw %}
```yaml
# .github/workflows/reusable-ci.yml
name: Reusable CI
on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: "20"
jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm test
```
{% endraw %}

呼び出し側は `uses:` でジョブごと呼び出します。

{% raw %}
```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  merge_group:
    types: [checks_requested]
jobs:
  call:
    uses: ./.github/workflows/reusable-ci.yml
    with:
      node-version: "20"
```
{% endraw %}

注意：
- 呼び出し側の `permissions:` が不足すると、呼び出し先の処理が失敗します（`GITHUB_TOKEN` の権限設計は付録Bも参照）。
- fork PR では Secrets が渡らない/制限されるため、再利用設計の前提として「どのイベントで何を実行するか」を分離してください。

## 13.7 リリース自動化（タグ→Release notes→成果物）

リリース運用を自動化すると、「リリース作業の属人化」を減らし、配布物の整合性を保ちやすくなります。最小構成は次の流れです。

1. タグ（例：`v1.2.3`）を push
2. GitHub Release を作成（Release notes 生成）
3. 成果物（artifact）を添付

最小例（Release作成 + 添付）：

{% raw %}
```yaml
name: Release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build artifact
        run: |
          mkdir -p dist
          echo "build output" > dist/example.txt
          tar -czf dist.tgz dist
      - name: Create GitHub Release (notes + attach)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "${GITHUB_REF_NAME}" dist.tgz --generate-notes
```
{% endraw %}

補足：
- `GITHUB_TOKEN` は既定で書き込みが禁止されている設定の場合があります。失敗する場合は `permissions:` とリポジトリ設定（Actions の既定権限）を確認します。
- Packages（GHCR）へ公開する場合は `packages: write` が必要になることがあります。全文例は `examples/release-automation-example/` を参照してください。

## 13.8 クラウド認証：OIDC を使い「長期 Secrets」を置かない（推奨）

クラウドへのデプロイや操作で長期のアクセスキーを Secrets に置くと、漏えい時の影響が大きくなります。可能な限り **OIDC による短命クレデンシャル**へ寄せます。

ポイント（最低限）：
- `permissions: id-token: write` が必要
- クラウド側（例：AWS IAM）に「GitHub OIDC provider + 役割（role）」を用意し、信頼ポリシーで発行元/対象（`aud`/`sub` 等）を絞る
- fork PR など不特定入力の実行では、そもそもクラウド操作をしない設計にする（信頼境界）

最小例（AWSで `sts:GetCallerIdentity` を実行）：

{% raw %}
```yaml
permissions:
  id-token: write
  contents: read

- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_NAME>
    aws-region: ap-northeast-1

- run: aws sts get-caller-identity
```
{% endraw %}

信頼ポリシー（例：プレースホルダ）：
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:<OWNER>/<REPO>:ref:refs/heads/<BRANCH>"
        }
      }
    }
  ]
}
```

第11章（11.1.4）も参照してください： [第11章：セキュリティ実践](../chapter11/)。全文例は `examples/oidc-aws-sts-example/` を参照してください。

## 13.9 self-hosted runner 運用設計（信頼境界・隔離・fork PR）

self-hosted runner は、ビルド時間短縮やGPUなど特殊要件に有効ですが、運用設計を誤ると「任意コード実行」のリスクが直接ホストに波及します。

重点ポイント（チェックリスト）：
- 原則：**fork PR 等の不特定入力を self-hosted runner で実行しない**
- Runner グループ/ラベルで境界を作る（用途別に分離する）
- 使い捨て（ephemeral）/隔離（VM/コンテナ）/最小権限（ネットワーク/FS）を優先する
- キャッシュは「汚染」を前提に扱う（Secrets 混入や改ざんを想定）
- `concurrency` とキュー設計で過負荷/待ち行列を制御する
- Runner 停止（offline）やラベル不一致時のオペレーションを用意する（付録B参照）

運用観点の補足は `examples/self-hosted-runner-ops-checklist/` を参照してください。

## まとめ

本章では、GitHub ActionsによるCI/CDパイプラインの構築を学習しました。主なポイントは次のとおりです。
- GitHub Actionsの基本構造とカスタムアクション
- AIモデル学習の自動化とハイパーパラメータ探索
- 包括的なテストスイートと品質管理
- Copilotを活用した効率的なワークフロー作成
- 段階的デプロイメントと自動ロールバック
- Reusable workflows / Composite actions による再利用設計
- タグ起点のリリース自動化（Release notes/成果物）
- OIDC によるクラウド認証（長期Secretsを置かない）
- self-hosted runner の運用設計（信頼境界・隔離）

次章では、大規模データとモデルの管理について学習します。

## 確認事項

- [ ] GitHub Actionsの基本的なワークフローを作成できる
- [ ] ML学習パイプラインを自動化できる
- [ ] テストとコード品質チェックを統合できる
- [ ] デプロイメントパイプラインを構築できる
- [ ] 監視とロールバックの仕組みを実装できる
- [ ] Reusable workflow と Composite action の使い分けを説明できる
- [ ] タグ起点のリリース自動化（Release作成 + 成果物添付）を設計できる
- [ ] OIDC を用いたクラウド認証の前提（`id-token` 権限/信頼ポリシー）を説明できる
- [ ] self-hosted runner の信頼境界と運用注意点（fork PR 等）を説明できる
