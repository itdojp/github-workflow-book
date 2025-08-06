---
layout: book
title: "第14章：大規模データとモデルの管理"
---

# 第14章：大規模データとモデルの管理

## 14.1 AI協働を考慮したGit LFS設定

### AI協働時代のGit LFS
AI生成モデルやデータセットの管理には、第2章の協働履歴と組み合わせたGit LFS設定が重要です。AIによるアセット生成を追跡可能にします。

### Git LFSの初期設定

#### インストールと有効化
```bash
# Git LFSのインストール
# macOS
brew install git-lfs

# Ubuntu/Debian
curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
sudo apt-get install git-lfs

# Windows
# Git for Windowsに含まれている

# Git LFSの初期化
git lfs install

# リポジトリでLFSを有効化
cd your-repo
# AIアセットのトラッキング（AI協働履歴付き）
git lfs track "*.pth"  # PyTorchモデル
git lfs track "*.h5"   # Keras/TensorFlowモデル
git lfs track "*.onnx" # ONNXモデル
git lfs track "*.pkl"  # Pickleファイル
git lfs track "*.parquet" # データファイル
git lfs track "ai-generated/*" # AI生成アセット専用
git lfs track "experiments/*/models/*" # 実験モデル

# .gitattributesをコミット
git add .gitattributes
git commit -m "Configure Git LFS tracking"
```

### LFS設定の最適化

#### `.lfsconfig`ファイル
```ini
# .lfsconfig
[lfs]
    # GitHubのLFSエンドポイント（GitHub Enterprise Serverまたはカスタムサーバー用）
    # 注意: GitHub.comを使用している場合、この設定は通常不要です
    # url = https://github.com/org/repo.git/info/lfs
    
    # 同時転送数
    concurrenttransfers = 8
    
    # バッチサイズ
    batch = true
    
    # 転送時の検証
    transfer.maxverifies = 3

[lfs "transfer"]
    # カスタム転送アダプター（高速化）
    maxretries = 3
    maxverifyretries = 3

[lfs "extension"]
    # 追加の拡張子
    clean = git-lfs clean -- %f
    smudge = git-lfs smudge -- %f
    process = git-lfs filter-process
```

**注意事項：**
- `url`設定はGitHub Enterprise ServerやセルフホストのGit LFSサーバーを使用する場合にのみ必要です
- GitHub.comのパブリック/プライベートリポジトリでは、LFSエンドポイントは自動的に解決されるため設定不要です
- カスタムLFSサーバーを使用する場合のみ、適切なエンドポイントURLを設定してください

### LFSの使用パターン

#### モデルファイルの管理
```python
# scripts/model_management.py
import subprocess
import hashlib
from pathlib import Path

class ModelLFSManager:
    def __init__(self, repo_path='.'):
        self.repo_path = Path(repo_path)
        
    def add_model_to_lfs(self, model_path, auto_commit=True):
        """モデルをLFSに追加"""
        model_path = Path(model_path)
        
        # ファイルサイズを確認
        size_mb = model_path.stat().st_size / (1024 * 1024)
        print(f"Model size: {size_mb:.2f} MB")
        
        # LFSに追加
        subprocess.run(['git', 'lfs', 'track', f'*{model_path.suffix}'])
        subprocess.run(['git', 'add', '.gitattributes'])
        subprocess.run(['git', 'add', str(model_path)])
        
        if auto_commit:
            # モデルのハッシュを計算
            model_hash = self._calculate_hash(model_path)[:8]
            
            commit_message = f"Add model: {model_path.name} (hash: {model_hash})"
            subprocess.run(['git', 'commit', '-m', commit_message])
            
        return {
            'path': str(model_path),
            'size_mb': size_mb,
            'hash': model_hash
        }
    
    def prune_old_models(self, keep_latest=3):
        """古いモデルを削除"""
        models_dir = self.repo_path / 'models'
        
        # モデルファイルを日付順にソート
        model_files = sorted(
            models_dir.glob('*.pth'),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        # 保持するファイル以外を削除
        for model_file in model_files[keep_latest:]:
            print(f"Removing old model: {model_file}")
            
            # LFSから削除
            subprocess.run(['git', 'rm', str(model_file)])
            
        # LFSのガベージコレクション
        subprocess.run(['git', 'lfs', 'prune'])
    
    def _calculate_hash(self, file_path):
        """ファイルのハッシュを計算"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
                
        return sha256_hash.hexdigest()
```

## 13.2 DVC（Data Version Control）との連携

### DVCの基本設定

#### 初期設定
```bash
# DVCのインストール
pip install dvc[s3]  # AWS S3サポート付き
# または
pip install dvc[gdrive]  # Google Driveサポート付き

# DVCの初期化
dvc init

# リモートストレージの設定
dvc remote add -d myremote s3://my-bucket/dvc-storage
dvc remote modify myremote access_key_id ${AWS_ACCESS_KEY_ID}
dvc remote modify myremote secret_access_key ${AWS_SECRET_ACCESS_KEY}

# または Google Drive
dvc remote add -d myremote gdrive://folder-id
```

### DVCパイプラインの構築

#### `dvc.yaml`の設定
```yaml
# dvc.yaml
stages:
  download_data:
    cmd: python scripts/download_data.py
    deps:
      - scripts/download_data.py
    params:
      - data.source_url
      - data.dataset_name
    outs:
      - data/raw/

  preprocess:
    cmd: python scripts/preprocess.py
    deps:
      - scripts/preprocess.py
      - data/raw/
    params:
      - preprocessing.image_size
      - preprocessing.augmentation
    outs:
      - data/processed/

  train:
    cmd: python train.py
    deps:
      - train.py
      - data/processed/
      - src/
    params:
      - model.architecture
      - training.epochs
      - training.batch_size
      - training.learning_rate
    outs:
      - models/model.pth
      - logs/training.log
    metrics:
      - metrics/train_metrics.json:
          cache: false

  evaluate:
    cmd: python evaluate.py
    deps:
      - evaluate.py
      - models/model.pth
      - data/processed/test/
    outs:
      - reports/evaluation.html
      - reports/confusion_matrix.png
    metrics:
      - metrics/eval_metrics.json:
          cache: false
```

### DVCとGitの統合

#### 自動化スクリプト
```python
# scripts/dvc_integration.py
import subprocess
import yaml
import json
from pathlib import Path

class DVCGitIntegration:
    def __init__(self):
        self.dvc_files = ['.dvc', 'dvc.yaml', 'dvc.lock']
        
    def run_experiment(self, params_override=None):
        """実験を実行してバージョン管理"""
        # パラメータを更新
        if params_override:
            self.update_params(params_override)
            
        # DVCパイプラインを実行
        subprocess.run(['dvc', 'repro'], check=True)
        
        # メトリクスを取得
        metrics = self.get_metrics()
        
        # Git にコミット
        self.commit_experiment(metrics)
        
        return metrics
    
    def update_params(self, params):
        """パラメータファイルを更新"""
        params_file = Path('params.yaml')
        
        with open(params_file) as f:
            current_params = yaml.safe_load(f)
            
        # パラメータを更新
        for key, value in params.items():
            keys = key.split('.')
            target = current_params
            
            for k in keys[:-1]:
                target = target[k]
            target[keys[-1]] = value
            
        with open(params_file, 'w') as f:
            yaml.dump(current_params, f)
    
    def get_metrics(self):
        """DVCメトリクスを取得"""
        metrics = {}
        
        # メトリクスファイルを読み込み
        for metric_file in Path('metrics').glob('*.json'):
            with open(metric_file) as f:
                data = json.load(f)
                metrics.update(data)
                
        return metrics
    
    def commit_experiment(self, metrics):
        """実験結果をコミット"""
        # DVCファイルを追加
        for file in self.dvc_files:
            subprocess.run(['git', 'add', file])
            
        # メトリクスファイルを追加
        subprocess.run(['git', 'add', 'metrics/'])
        
        # コミットメッセージを生成
        message = f"""Experiment: {metrics.get('model_name', 'unnamed')}

Metrics:
- Accuracy: {metrics.get('accuracy', 'N/A')}
- Loss: {metrics.get('loss', 'N/A')}
- F1 Score: {metrics.get('f1_score', 'N/A')}

Parameters:
- Learning Rate: {metrics.get('learning_rate', 'N/A')}
- Batch Size: {metrics.get('batch_size', 'N/A')}
- Epochs: {metrics.get('epochs', 'N/A')}
"""
        
        subprocess.run(['git', 'commit', '-m', message])
        
    def compare_experiments(self, branch1='HEAD~1', branch2='HEAD'):
        """実験結果を比較"""
        # メトリクスの差分を表示
        result = subprocess.run(
            ['dvc', 'metrics', 'diff', branch1, branch2],
            capture_output=True,
            text=True
        )
        
        print(result.stdout)
        
        # パラメータの差分を表示
        result = subprocess.run(
            ['dvc', 'params', 'diff', branch1, branch2],
            capture_output=True,
            text=True
        )
        
        print(result.stdout)
```

## 13.3 モデルレジストリの構築

### MLflowとの連携

#### MLflow設定
```python
# mlflow_config.py
import mlflow
from mlflow.tracking import MlflowClient
import os

class ModelRegistry:
    def __init__(self, tracking_uri="http://localhost:5000"):
        mlflow.set_tracking_uri(tracking_uri)
        self.client = MlflowClient()
        
    def register_model(self, model_path, model_name, metrics, params, tags=None):
        """モデルをレジストリに登録"""
        with mlflow.start_run() as run:
            # パラメータを記録
            for key, value in params.items():
                mlflow.log_param(key, value)
                
            # メトリクスを記録
            for key, value in metrics.items():
                mlflow.log_metric(key, value)
                
            # タグを記録
            if tags:
                for key, value in tags.items():
                    mlflow.set_tag(key, value)
                    
            # モデルを記録
            if model_path.endswith('.pth'):
                mlflow.pytorch.log_model(
                    pytorch_model=model_path,
                    artifact_path="model",
                    registered_model_name=model_name
                )
            elif model_path.endswith('.h5'):
                mlflow.tensorflow.log_model(
                    tf_saved_model_dir=model_path,
                    artifact_path="model",
                    registered_model_name=model_name
                )
                
            # モデルのバージョンを取得
            model_version = self.get_latest_version(model_name)
            
            return {
                'run_id': run.info.run_id,
                'model_name': model_name,
                'model_version': model_version,
                'status': 'registered'
            }
    
    def promote_model(self, model_name, version, stage="Production"):
        """モデルをプロダクションに昇格"""
        self.client.transition_model_version_stage(
            name=model_name,
            version=version,
            stage=stage
        )
        
        # 以前のプロダクションモデルをアーカイブ
        for mv in self.client.search_model_versions(f"name='{model_name}'"):
            if mv.current_stage == "Production" and mv.version != version:
                self.client.transition_model_version_stage(
                    name=model_name,
                    version=mv.version,
                    stage="Archived"
                )
    
    def get_production_model(self, model_name):
        """プロダクションモデルを取得"""
        filter_string = f"name='{model_name}'"
        results = self.client.search_model_versions(filter_string)
        
        for mv in results:
            if mv.current_stage == "Production":
                return {
                    'version': mv.version,
                    'run_id': mv.run_id,
                    'uri': mv.source,
                    'status': mv.status
                }
                
        return None
    
    def compare_models(self, model_name, version1, version2):
        """2つのモデルバージョンを比較"""
        def get_run_data(version):
            mv = self.client.get_model_version(model_name, version)
            run = self.client.get_run(mv.run_id)
            return run.data
            
        run1 = get_run_data(version1)
        run2 = get_run_data(version2)
        
        comparison = {
            'metrics': {},
            'params': {}
        }
        
        # メトリクスの比較
        for key in run1.metrics.keys():
            if key in run2.metrics:
                comparison['metrics'][key] = {
                    'v1': run1.metrics[key],
                    'v2': run2.metrics[key],
                    'improvement': run2.metrics[key] - run1.metrics[key]
                }
                
        # パラメータの比較
        for key in run1.params.keys():
            if key in run2.params:
                if run1.params[key] != run2.params[key]:
                    comparison['params'][key] = {
                        'v1': run1.params[key],
                        'v2': run2.params[key]
                    }
                    
        return comparison
```

### カスタムモデルレジストリ

#### S3ベースのレジストリ
```python
# s3_model_registry.py
import boto3
import json
from datetime import datetime
from pathlib import Path
import hashlib

class S3ModelRegistry:
    def __init__(self, bucket_name, prefix='models'):
        self.s3 = boto3.client('s3')
        self.bucket_name = bucket_name
        self.prefix = prefix
        
    def upload_model(self, local_path, model_name, version=None, metadata=None):
        """モデルをS3にアップロード"""
        local_path = Path(local_path)
        
        # バージョンを生成
        if version is None:
            version = datetime.now().strftime('%Y%m%d_%H%M%S')
            
        # S3キーを生成
        s3_key = f"{self.prefix}/{model_name}/{version}/model.pth"
        
        # メタデータを準備
        upload_metadata = {
            'model_name': model_name,
            'version': version,
            'upload_time': datetime.now().isoformat(),
            'file_size': local_path.stat().st_size,
            'file_hash': self._calculate_hash(local_path)
        }
        
        if metadata:
            upload_metadata.update(metadata)
            
        # モデルをアップロード
        self.s3.upload_file(
            str(local_path),
            self.bucket_name,
            s3_key,
            ExtraArgs={
                'Metadata': {
                    k: str(v) for k, v in upload_metadata.items()
                }
            }
        )
        
        # メタデータファイルをアップロード
        metadata_key = f"{self.prefix}/{model_name}/{version}/metadata.json"
        self.s3.put_object(
            Bucket=self.bucket_name,
            Key=metadata_key,
            Body=json.dumps(upload_metadata, indent=2)
        )
        
        return {
            'model_name': model_name,
            'version': version,
            's3_uri': f"s3://{self.bucket_name}/{s3_key}",
            'metadata_uri': f"s3://{self.bucket_name}/{metadata_key}"
        }
    
    def list_models(self, model_name=None):
        """モデル一覧を取得"""
        prefix = f"{self.prefix}/"
        if model_name:
            prefix += f"{model_name}/"
            
        response = self.s3.list_objects_v2(
            Bucket=self.bucket_name,
            Prefix=prefix,
            Delimiter='/'
        )
        
        models = []
        
        if 'CommonPrefixes' in response:
            for prefix_info in response['CommonPrefixes']:
                model_path = prefix_info['Prefix']
                model_name = model_path.split('/')[-2]
                
                # バージョン一覧を取得
                versions = self.list_versions(model_name)
                
                models.append({
                    'model_name': model_name,
                    'versions': versions,
                    'latest_version': versions[0] if versions else None
                })
                
        return models
    
    def list_versions(self, model_name):
        """モデルのバージョン一覧を取得"""
        prefix = f"{self.prefix}/{model_name}/"
        
        response = self.s3.list_objects_v2(
            Bucket=self.bucket_name,
            Prefix=prefix,
            Delimiter='/'
        )
        
        versions = []
        
        if 'CommonPrefixes' in response:
            for prefix_info in response['CommonPrefixes']:
                version_path = prefix_info['Prefix']
                version = version_path.split('/')[-2]
                
                # メタデータを取得
                metadata = self.get_metadata(model_name, version)
                
                versions.append({
                    'version': version,
                    'created_at': metadata.get('upload_time'),
                    'size': metadata.get('file_size'),
                    'metrics': metadata.get('metrics', {})
                })
                
        # 日付順にソート
        versions.sort(key=lambda x: x['created_at'], reverse=True)
        
        return versions
    
    def download_model(self, model_name, version, local_path):
        """モデルをダウンロード"""
        s3_key = f"{self.prefix}/{model_name}/{version}/model.pth"
        
        self.s3.download_file(
            self.bucket_name,
            s3_key,
            str(local_path)
        )
        
        return local_path
    
    def _calculate_hash(self, file_path):
        """ファイルのハッシュを計算"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
                
        return sha256_hash.hexdigest()
```

## 13.4 アクセス制御を考慮したデータ管理

### データアクセス階層

#### アクセス制御の実装
```python
# data_access_control.py
from enum import Enum
import json
from pathlib import Path

class DataAccessLevel(Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    RESTRICTED = "restricted"
    CONFIDENTIAL = "confidential"

class DataAccessController:
    def __init__(self, config_path='data_access_config.json'):
        self.config = self._load_config(config_path)
        self.user_permissions = {}
        
    def _load_config(self, config_path):
        """アクセス制御設定を読み込み"""
        with open(config_path) as f:
            return json.load(f)
            
    def grant_access(self, user, data_path, access_level):
        """ユーザーにデータアクセス権限を付与"""
        if user not in self.user_permissions:
            self.user_permissions[user] = {}
            
        self.user_permissions[user][str(data_path)] = access_level
        
        # 監査ログに記録
        self._log_access_grant(user, data_path, access_level)
        
    def check_access(self, user, data_path):
        """アクセス権限をチェック"""
        data_path = str(data_path)
        
        # ユーザーの権限を確認
        if user in self.user_permissions:
            if data_path in self.user_permissions[user]:
                return True
                
        # データのアクセスレベルを確認
        data_level = self._get_data_access_level(data_path)
        user_level = self._get_user_access_level(user)
        
        return self._compare_access_levels(user_level, data_level)
    
    def encrypt_sensitive_data(self, data_path, access_level):
        """機密データを暗号化"""
        if access_level in [DataAccessLevel.RESTRICTED, DataAccessLevel.CONFIDENTIAL]:
            # 暗号化処理
            from cryptography.fernet import Fernet
            
            key = self._get_encryption_key(access_level)
            fernet = Fernet(key)
            
            with open(data_path, 'rb') as f:
                encrypted_data = fernet.encrypt(f.read())
                
            encrypted_path = data_path.with_suffix('.encrypted')
            with open(encrypted_path, 'wb') as f:
                f.write(encrypted_data)
                
            # 元ファイルを削除
            data_path.unlink()
            
            return encrypted_path
            
        return data_path
    
    def create_data_manifest(self, data_dir):
        """データマニフェストを作成"""
        manifest = {
            'created_at': datetime.now().isoformat(),
            'data_files': []
        }
        
        for data_file in Path(data_dir).rglob('*'):
            if data_file.is_file():
                file_info = {
                    'path': str(data_file.relative_to(data_dir)),
                    'size': data_file.stat().st_size,
                    'hash': self._calculate_hash(data_file),
                    'access_level': self._get_data_access_level(data_file),
                    'encrypted': data_file.suffix == '.encrypted'
                }
                manifest['data_files'].append(file_info)
                
        manifest_path = Path(data_dir) / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
            
        return manifest_path
```

### データガバナンス

#### データ系譜の追跡
```python
# data_lineage.py
import networkx as nx
from datetime import datetime
import json

class DataLineageTracker:
    def __init__(self):
        self.lineage_graph = nx.DiGraph()
        
    def add_data_source(self, source_id, metadata):
        """データソースを追加"""
        self.lineage_graph.add_node(
            source_id,
            type='source',
            created_at=datetime.now().isoformat(),
            **metadata
        )
        
    def add_transformation(self, input_ids, output_id, transformation_metadata):
        """データ変換を記録"""
        # 出力ノードを追加
        self.lineage_graph.add_node(
            output_id,
            type='derived',
            created_at=datetime.now().isoformat(),
            **transformation_metadata
        )
        
        # 入力から出力へのエッジを追加
        for input_id in input_ids:
            self.lineage_graph.add_edge(
                input_id,
                output_id,
                transformation=transformation_metadata.get('operation', 'unknown')
            )
            
    def get_data_provenance(self, data_id):
        """データの来歴を取得"""
        if data_id not in self.lineage_graph:
            return None
            
        # 祖先ノードを取得
        ancestors = nx.ancestors(self.lineage_graph, data_id)
        
        # サブグラフを抽出
        nodes = list(ancestors) + [data_id]
        subgraph = self.lineage_graph.subgraph(nodes)
        
        # 来歴情報を構築
        provenance = {
            'data_id': data_id,
            'lineage': []
        }
        
        # トポロジカルソート
        for node in nx.topological_sort(subgraph):
            node_data = self.lineage_graph.nodes[node]
            
            predecessors = list(subgraph.predecessors(node))
            
            provenance['lineage'].append({
                'id': node,
                'type': node_data['type'],
                'created_at': node_data['created_at'],
                'inputs': predecessors,
                'metadata': {
                    k: v for k, v in node_data.items()
                    if k not in ['type', 'created_at']
                }
            })
            
        return provenance
    
    def export_lineage(self, output_path):
        """系譜グラフをエクスポート"""
        lineage_data = {
            'nodes': [
                {
                    'id': node,
                    **self.lineage_graph.nodes[node]
                }
                for node in self.lineage_graph.nodes()
            ],
            'edges': [
                {
                    'source': edge[0],
                    'target': edge[1],
                    **self.lineage_graph.edges[edge]
                }
                for edge in self.lineage_graph.edges()
            ]
        }
        
        with open(output_path, 'w') as f:
            json.dump(lineage_data, f, indent=2)
            
    def visualize_lineage(self, data_id=None, output_path='lineage.png'):
        """系譜を可視化"""
        import matplotlib.pyplot as plt
        
        if data_id:
            # 特定のデータの系譜のみ
            ancestors = nx.ancestors(self.lineage_graph, data_id)
            nodes = list(ancestors) + [data_id]
            subgraph = self.lineage_graph.subgraph(nodes)
        else:
            subgraph = self.lineage_graph
            
        # レイアウトを計算
        pos = nx.spring_layout(subgraph)
        
        # ノードの色を設定
        node_colors = []
        for node in subgraph.nodes():
            if subgraph.nodes[node]['type'] == 'source':
                node_colors.append('lightblue')
            else:
                node_colors.append('lightgreen')
                
        # グラフを描画
        plt.figure(figsize=(12, 8))
        nx.draw(
            subgraph,
            pos,
            node_color=node_colors,
            with_labels=True,
            node_size=3000,
            font_size=8,
            font_weight='bold',
            arrows=True,
            edge_color='gray'
        )
        
        plt.title('Data Lineage Graph')
        plt.axis('off')
        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
```

## 14.5 AI協働実験の追跡と管理

### 実験管理システム

#### AI協働実験トラッカー
```python
# ai_experiment_tracker.py
import json
import yaml
from pathlib import Path
from datetime import datetime
import pandas as pd

class AICollaborativeExperimentTracker:
    def __init__(self, experiments_dir='experiments'):
        self.experiments_dir = Path(experiments_dir)
        self.experiments_dir.mkdir(exist_ok=True)
        
    def start_experiment(self, name, config, description="", ai_collaboration=None):
        """AI協働実験を開始"""
        exp_id = f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        exp_dir = self.experiments_dir / exp_id
        exp_dir.mkdir()
        
        # 実験設定を保存
        config_path = exp_dir / 'config.yaml'
        with open(config_path, 'w') as f:
            yaml.dump(config, f)
            
        # AI協働情報の記録
        ai_info = ai_collaboration or {}
        ai_metadata = {
            'ai_tools_used': ai_info.get('tools', []),
            'ai_assistance_level': ai_info.get('level', 'none'),  # none, low, medium, high
            'ai_generated_components': ai_info.get('components', []),
            'prompt_templates': ai_info.get('prompts', []),
            'human_review_points': ai_info.get('review_points', [])
        }
            
        # 実験メタデータを保存（AI協働情報含む）
        metadata = {
            'id': exp_id,
            'name': name,
            'description': description,
            'status': 'running',
            'start_time': datetime.now().isoformat(),
            'git_commit': self._get_git_commit(),
            'config_path': str(config_path),
            'ai_collaboration': ai_metadata,  # 第2章のフレームワーク適用
            'collaboration_framework': 'CLEAR'  # 使用したフレームワーク
        }
        
        metadata_path = exp_dir / 'metadata.json'
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
            
        return exp_id
    
    def log_metrics(self, exp_id, metrics, step=None):
        """メトリクスを記録"""
        exp_dir = self.experiments_dir / exp_id
        metrics_file = exp_dir / 'metrics.jsonl'
        
        entry = {
            'timestamp': datetime.now().isoformat(),
            'step': step,
            **metrics
        }
        
        with open(metrics_file, 'a') as f:
            f.write(json.dumps(entry) + '\n')
            
    def log_artifact(self, exp_id, artifact_path, artifact_type='model'):
        """成果物を記録"""
        exp_dir = self.experiments_dir / exp_id
        artifacts_dir = exp_dir / 'artifacts'
        artifacts_dir.mkdir(exist_ok=True)
        
        # 成果物をコピー
        artifact_path = Path(artifact_path)
        dest_path = artifacts_dir / artifact_path.name
        
        import shutil
        shutil.copy2(artifact_path, dest_path)
        
        # 成果物情報を記録
        artifact_info = {
            'type': artifact_type,
            'original_path': str(artifact_path),
            'stored_path': str(dest_path),
            'size': artifact_path.stat().st_size,
            'timestamp': datetime.now().isoformat()
        }
        
        artifacts_log = exp_dir / 'artifacts.jsonl'
        with open(artifacts_log, 'a') as f:
            f.write(json.dumps(artifact_info) + '\n')
            
    def complete_experiment(self, exp_id, final_metrics=None):
        """実験を完了"""
        exp_dir = self.experiments_dir / exp_id
        
        # メタデータを更新
        metadata_path = exp_dir / 'metadata.json'
        with open(metadata_path) as f:
            metadata = json.load(f)
            
        metadata['status'] = 'completed'
        metadata['end_time'] = datetime.now().isoformat()
        
        if final_metrics:
            metadata['final_metrics'] = final_metrics
            
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
            
        # サマリーレポートを生成
        self._generate_summary(exp_id)
        
    def compare_experiments(self, exp_ids, metrics_to_compare=None):
        """複数の実験を比較"""
        comparison_data = []
        
        for exp_id in exp_ids:
            exp_dir = self.experiments_dir / exp_id
            
            # メタデータを読み込み
            with open(exp_dir / 'metadata.json') as f:
                metadata = json.load(f)
                
            # 最終メトリクスを取得
            final_metrics = metadata.get('final_metrics', {})
            
            # 設定を読み込み
            with open(exp_dir / 'config.yaml') as f:
                config = yaml.safe_load(f)
                
            row = {
                'experiment_id': exp_id,
                'name': metadata['name'],
                'status': metadata['status'],
                **final_metrics,
                **self._flatten_dict(config, prefix='config.')
            }
            
            comparison_data.append(row)
            
        # DataFrameに変換
        df = pd.DataFrame(comparison_data)
        
        # 指定されたメトリクスのみを表示
        if metrics_to_compare:
            columns = ['experiment_id', 'name'] + metrics_to_compare
            df = df[columns]
            
        return df
    
    def _generate_summary(self, exp_id):
        """実験サマリーを生成"""
        exp_dir = self.experiments_dir / exp_id
        
        # メトリクスの履歴を読み込み
        metrics_history = []
        metrics_file = exp_dir / 'metrics.jsonl'
        
        if metrics_file.exists():
            with open(metrics_file) as f:
                for line in f:
                    metrics_history.append(json.loads(line))
                    
        # サマリーレポートを作成
        summary = {
            'experiment_id': exp_id,
            'metrics_summary': self._summarize_metrics(metrics_history),
            'artifacts': self._list_artifacts(exp_dir),
            'duration': self._calculate_duration(exp_dir)
        }
        
        summary_path = exp_dir / 'summary.json'
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
            
    def _flatten_dict(self, d, prefix=''):
        """辞書をフラット化"""
        items = []
        for k, v in d.items():
            new_key = f"{prefix}{k}" if prefix else k
            if isinstance(v, dict):
                items.extend(self._flatten_dict(v, f"{new_key}.").items())
            else:
                items.append((new_key, v))
        return dict(items)
```

## まとめ

本章では、大規模データとモデルの管理について学習しました：
- Git LFSで大容量ファイルを効率的に管理
- DVCでデータパイプラインをバージョン管理
- MLflowやカスタムレジストリでモデルを体系的に管理
- アクセス制御とデータガバナンスの実装
- 実験結果の追跡と比較分析

次章では、外部協力者との連携について学習します。

## 確認事項

- [ ] Git LFSを設定して大容量ファイルを管理できる
- [ ] DVCでデータパイプラインを構築できる
- [ ] モデルレジストリを活用できる
- [ ] データアクセス制御を実装できる
- [ ] 実験結果を体系的に管理できる