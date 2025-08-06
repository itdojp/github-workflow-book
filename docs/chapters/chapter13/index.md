---
layout: book
order: 14
title: "第13章：CI/CDパイプライン構築"
---

# 第13章：CI/CDパイプライン構築

## 13.1 GitHub Actionsの基本構造とAI活用

### 第2章の品質ゲートを統合したCI/CD
本章では、第2章で学んだAI協働品質ゲートをCI/CDパイプラインに統合します。

### ワークフローの基本要素

#### AI協働品質ゲート統合のワークフロー構造
```yaml
# .github/workflows/ai-collaboration-pipeline.yml
name: AI Collaboration ML Pipeline

# トリガー条件
on:
  push:
    branches: [ main, develop ]
    paths:
      - 'src/**'
      - 'configs/**'
      - 'requirements.txt'
  pull_request:
    types: [opened, synchronize]

jobs:
  # 第2章で学んだAI協働品質チェック
  ai-collaboration-quality:
    runs-on: ubuntu-latest
    steps:
      - name: Check AI Collaboration Metadata
        run: |
          # PR説明にAI協働履歴があることを確認
          if ! echo "${{ github.event.pull_request.body }}" | grep -q "🤖 AI協働履歴"; then
            echo "❌ AI協働履歴が記載されていません"
            exit 1
          fi
          
      - name: Validate AI Generated Code Quality  
        run: |
          # AI生成コード部分の品質チェック
          python scripts/check_ai_code_quality.py

# 環境変数
env:
  PYTHON_VERSION: '3.9'
  CUDA_VERSION: '11.8'
  CACHE_NUMBER: 1  # キャッシュをリセットする場合に増やす

# ジョブ定義
jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      python-version: ${{ steps.setup.outputs.python-version }}
      cache-hit: ${{ steps.cache.outputs.cache-hit }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        id: setup
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
      
      - name: Cache dependencies
        id: cache
        uses: actions/cache@v3
        with:
          path: |
            ~/.cache/pip
            ~/.cache/torch
          key: ${{ runner.os }}-pip-${{ env.CACHE_NUMBER }}-${{ hashFiles('**/requirements.txt') }}
```

### マトリックスビルド

#### 複数環境でのテスト
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
    - uses: actions/checkout@v3
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install PyTorch ${{ matrix.torch-version }}
      run: |
        pip install torch==${{ matrix.torch-version }}
        
    - name: Run tests
      run: |
        pytest tests/ -v --cov=src --cov-report=xml
        
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        flags: unittests
        name: codecov-${{ matrix.os }}-py${{ matrix.python-version }}
```

### カスタムアクション

#### 再利用可能なアクション
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
      uses: actions/setup-python@v4
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
      uses: actions/cache@v3
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

## 12.2 AIモデル学習の自動化

### 学習パイプライン

#### GPU対応ワークフロー
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
      - uses: actions/checkout@v3
      
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
        uses: actions/upload-artifact@v3
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

### ハイパーパラメータチューニング

#### 並列実験の実行
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
      - uses: actions/checkout@v3
      
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
      - uses: actions/checkout@v3
      
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
      - uses: actions/checkout@v3
      
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

## 12.3 テストとリンターの統合

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
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
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
      - uses: actions/checkout@v3
      
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
        uses: actions/upload-artifact@v3
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
      - uses: actions/checkout@v3
      
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
      - uses: actions/checkout@v3
      
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

## 12.4 Copilotを活用したワークフロー作成

### AI支援ワークフロー開発

#### Copilotプロンプト活用
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
      - uses: actions/checkout@v3
      
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

### ワークフロー最適化

#### キャッシングとアーティファクト管理
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
      - uses: actions/checkout@v3
      
      # Docker層のキャッシュ
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
        
      - name: Cache Docker layers
        uses: actions/cache@v3
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-buildx-
      
      # モデルのキャッシュ
      - name: Cache ML models
        uses: actions/cache@v3
        with:
          path: |
            ~/.cache/huggingface
            ~/.cache/torch
            ./models/pretrained
          key: ${{ runner.os }}-models-${{ hashFiles('**/model_requirements.txt') }}
      
      # データセットのキャッシュ
      - name: Cache datasets
        uses: actions/cache@v3
        with:
          path: ./data
          key: ${{ runner.os }}-datasets-${{ hashFiles('**/data_config.yaml') }}
      
      # ビルドとテスト
      - name: Build Docker image
        uses: docker/build-push-action@v4
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

## 12.5 デプロイメントの自動化

### モデルデプロイメントパイプライン

#### 段階的デプロイメント
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
      - uses: actions/checkout@v3
      
      - name: Download model artifact
        uses: actions/download-artifact@v3
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
        uses: actions/upload-artifact@v3
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
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
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
      - uses: actions/checkout@v3
      
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

## まとめ

本章では、GitHub ActionsによるCI/CDパイプラインの構築を学習しました：
- GitHub Actionsの基本構造とカスタムアクション
- AIモデル学習の自動化とハイパーパラメータ探索
- 包括的なテストスイートと品質管理
- Copilotを活用した効率的なワークフロー作成
- 段階的デプロイメントと自動ロールバック

次章では、大規模データとモデルの管理について学習します。

## 確認事項

- [ ] GitHub Actionsの基本的なワークフローを作成できる
- [ ] ML学習パイプラインを自動化できる
- [ ] テストとコード品質チェックを統合できる
- [ ] デプロイメントパイプラインを構築できる
- [ ] 監視とロールバックの仕組みを実装できる