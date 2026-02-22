# 第15章：GitHub Pagesでのプロジェクト公開

## 15.1 GitHub Pagesの基本設定

### GitHub Pagesとは

GitHub Pagesは、GitHubが提供する静的サイトホスティングサービスです。リポジトリから直接ウェブサイトを公開でき、以下の特徴があります：

- **無料**: Public リポジトリは無料で利用可能
- **HTTPS対応**: 自動的にHTTPSが有効
- **カスタムドメイン**: 独自ドメインの設定可能
- **Jekyll統合**: 静的サイトジェネレーターが組み込み

### 基本的な有効化手順

#### リポジトリ設定での有効化
```yaml
# リポジトリのSettings → Pages で設定
github_pages:
  source:
    branch: main  # または gh-pages
    path: /docs   # または / (ルート)
  
  custom_domain: ml-project.example.com
  enforce_https: true
  
  theme: minimal  # Jekyllテーマ
```

#### 公開方法の選択

1. **mainブランチの`/docs`フォルダ**
```bash
project-root/
├── src/           # ソースコード
├── models/        # モデルファイル
├── docs/          # GitHub Pages用
│   ├── index.html
│   ├── css/
│   └── js/
└── README.md
```

2. **gh-pagesブランチ**
```bash
# gh-pagesブランチを作成
git checkout --orphan gh-pages
git rm -rf .
echo "GitHub Pages" > index.html
git add index.html
git commit -m "Initial GitHub Pages commit"
git push origin gh-pages
```

3. **GitHub Actions経由**
{% raw %}
```yaml
# .github/workflows/pages.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Pages
        uses: actions/configure-pages@v5
        
      - name: Build site
        run: |
          # ビルド処理
          npm run build
          
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: ./dist
          
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
{% endraw %}

### カスタムドメインの設定

#### DNSレコードの設定
```text
# Aレコード（Apex domain用）
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153

# CNAMEレコード（サブドメイン用）
docs.example.com -> username.github.io
```

#### CNAMEファイルの作成
```bash
# docs/CNAME または gh-pagesブランチのルートに配置
echo "ml-project.example.com" > CNAME
git add CNAME
git commit -m "Add custom domain"
git push
```

### Jekyll設定

#### _config.yml
```yaml
# _config.yml
title: AI/ML Project Documentation
description: >-
  State-of-the-art machine learning models and experiments
baseurl: "/ml-project"  # リポジトリ名
url: "https://username.github.io"

# ビルド設定
markdown: kramdown
theme: minima

# プラグイン
plugins:
  - jekyll-feed
  - jekyll-seo-tag
  - jekyll-sitemap

# 除外ファイル
exclude:
  - Gemfile
  - Gemfile.lock
  - node_modules/
  - vendor/
  - .git/
  - src/
  - models/
  - data/

# コレクション（実験結果など）
collections:
  experiments:
    output: true
    permalink: /experiments/:name/
  models:
    output: true
    permalink: /models/:name/
```

## 15.2 ML/AIプロジェクトのデモページ作成

### インタラクティブなモデルデモ

#### TensorFlow.jsを使用したブラウザ推論
```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Classification Demo</title>
    <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest"></script>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <h1>画像分類デモ</h1>
        
        <div class="upload-area" id="uploadArea">
            <p>画像をドラッグ＆ドロップまたはクリックして選択</p>
            <input type="file" id="fileInput" accept="image/*" hidden>
        </div>
        
        <div id="preview" class="preview hidden">
            <img id="previewImage" alt="Preview">
        </div>
        
        <button id="predictBtn" class="predict-btn hidden">予測実行</button>
        
        <div id="results" class="results hidden">
            <h2>予測結果</h2>
            <div id="predictions"></div>
        </div>
    </div>
    
    <script src="js/model-demo.js"></script>
</body>
</html>
```

#### モデルローディングと推論
```javascript
// js/model-demo.js
class ModelDemo {
    constructor() {
        this.model = null;
        this.labels = [];
        this.initializeUI();
        this.loadModel();
    }
    
    async loadModel() {
        try {
            // モデルの読み込み
            this.model = await tf.loadLayersModel('./models/model.json');
            
            // ラベルの読み込み
            const response = await fetch('./models/labels.json');
            this.labels = await response.json();
            
            console.log('Model loaded successfully');
            this.showStatus('モデル読み込み完了', 'success');
        } catch (error) {
            console.error('Model loading failed:', error);
            this.showStatus('モデル読み込みエラー', 'error');
        }
    }
    
    async predict(imageElement) {
        if (!this.model) {
            this.showStatus('モデルが読み込まれていません', 'error');
            return;
        }
        
        // 画像の前処理
        const tensor = tf.browser.fromPixels(imageElement)
            .resizeNearestNeighbor([224, 224])
            .toFloat()
            .div(tf.scalar(255.0))
            .expandDims();
            
        // 推論実行
        const predictions = await this.model.predict(tensor).data();
        tensor.dispose();
        
        // 結果を整形
        const results = Array.from(predictions)
            .map((prob, idx) => ({
                label: this.labels[idx],
                probability: prob
            }))
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 5);
            
        this.displayResults(results);
    }
    
    displayResults(results) {
        const predictionsDiv = document.getElementById('predictions');
        predictionsDiv.innerHTML = '';
        
        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'prediction-item';
            resultDiv.innerHTML = `
                <div class="label">${result.label}</div>
                <div class="probability-bar">
                    <div class="probability-fill" style="width: ${result.probability * 100}%"></div>
                </div>
                <div class="probability-text">${(result.probability * 100).toFixed(2)}%</div>
            `;
            predictionsDiv.appendChild(resultDiv);
        });
        
        document.getElementById('results').classList.remove('hidden');
    }
    
    initializeUI() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const predictBtn = document.getElementById('predictBtn');
        
        // ドラッグ&ドロップ
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleImage(file);
            }
        });
        
        // クリックでファイル選択
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleImage(file);
        });
        
        // 予測ボタン
        predictBtn.addEventListener('click', () => {
            const img = document.getElementById('previewImage');
            this.predict(img);
        });
    }
    
    handleImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('previewImage');
            img.src = e.target.result;
            document.getElementById('preview').classList.remove('hidden');
            document.getElementById('predictBtn').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
    
    showStatus(message, type) {
        // ステータス表示の実装
        console.log(`[${type}] ${message}`);
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    new ModelDemo();
});
```

### モデル変換とデプロイ

#### PyTorchモデルのTensorFlow.js変換
```python
# scripts/convert_model_to_tfjs.py
import torch
import tensorflow as tf
import tensorflowjs as tfjs
import json

class ModelConverter:
    def __init__(self, pytorch_model_path, output_dir='./docs/models'):
        self.pytorch_model_path = pytorch_model_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def convert_pytorch_to_tfjs(self):
        """PyTorchモデルをTensorFlow.js形式に変換"""
        # PyTorchモデルを読み込み
        model = torch.load(self.pytorch_model_path, map_location='cpu')
        model.eval()
        
        # ONNXに変換
        dummy_input = torch.randn(1, 3, 224, 224)
        onnx_path = self.output_dir / 'model.onnx'
        
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )
        
        # ONNXからTensorFlowに変換
        import onnx
        from onnx_tf.backend import prepare
        
        onnx_model = onnx.load(onnx_path)
        tf_rep = prepare(onnx_model)
        tf_rep.export_graph(str(self.output_dir / 'tf_model'))
        
        # TensorFlow.jsに変換
        tfjs.converters.convert_tf_saved_model(
            str(self.output_dir / 'tf_model'),
            str(self.output_dir)
        )
        
        print(f"Model converted and saved to {self.output_dir}")
        
    def create_labels_json(self, class_names):
        """ラベルファイルを作成"""
        labels_path = self.output_dir / 'labels.json'
        with open(labels_path, 'w') as f:
            json.dump(class_names, f, ensure_ascii=False, indent=2)
            
    def optimize_for_web(self):
        """Web用に最適化"""
        # 量子化
        converter = tf.lite.TFLiteConverter.from_saved_model(
            str(self.output_dir / 'tf_model')
        )
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_model = converter.convert()
        
        # TFLiteモデルを保存
        tflite_path = self.output_dir / 'model_quantized.tflite'
        with open(tflite_path, 'wb') as f:
            f.write(tflite_model)
            
        print(f"Quantized model saved to {tflite_path}")
```

## 15.3 ドキュメントサイトの構築

### MkDocsを使用した技術ドキュメント

#### mkdocs.yml設定
```yaml
# mkdocs.yml
site_name: ML Project Documentation
site_url: https://username.github.io/ml-project
repo_url: https://github.com/username/ml-project
repo_name: username/ml-project

theme:
  name: material
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.expand
    - search.suggest
    - search.highlight
    - content.code.copy
  palette:
    - scheme: default
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-4
        name: Switch to light mode

plugins:
  - search
  - mkdocstrings:
      handlers:
        python:
          setup_commands:
            - import sys
            - sys.path.insert(0, "src")
  - git-revision-date-localized
  - minify:
      minify_html: true

markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
  - pymdownx.tasklist:
      custom_checkbox: true
  - pymdownx.arithmatex:
      generic: true
  - admonition
  - toc:
      permalink: true

nav:
  - Home: index.md
  - Getting Started:
    - Installation: getting-started/installation.md
    - Quick Start: getting-started/quickstart.md
    - Configuration: getting-started/configuration.md
  - Models:
    - Overview: models/overview.md
    - ResNet: models/resnet.md
    - EfficientNet: models/efficientnet.md
    - Vision Transformer: models/vit.md
  - API Reference:
    - Data Loading: api/data.md
    - Models: api/models.md
    - Training: api/training.md
    - Evaluation: api/evaluation.md
  - Experiments:
    - Baseline: experiments/baseline.md
    - Hyperparameter Search: experiments/hparam-search.md
    - Ablation Studies: experiments/ablation.md
  - Examples:
    - Image Classification: examples/image-classification.md
    - Transfer Learning: examples/transfer-learning.md
    - Fine-tuning: examples/fine-tuning.md

extra:
  social:
    - icon: fontawesome/brands/github
      link: https://github.com/username
    - icon: fontawesome/brands/twitter
      link: https://twitter.com/username
  analytics:
    provider: google
    property: G-XXXXXXXXXX

extra_javascript:
  - javascripts/mathjax.js
  - https://polyfill.io/v3/polyfill.min.js?features=es6
  - https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js
```

### Jupyter Notebookの統合

#### NotebookをHTMLに変換
```python
# scripts/notebook_to_docs.py
import nbconvert
from pathlib import Path
import shutil

class NotebookConverter:
    def __init__(self, notebooks_dir='notebooks', output_dir='docs/notebooks'):
        self.notebooks_dir = Path(notebooks_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def convert_all_notebooks(self):
        """すべてのNotebookをHTMLに変換"""
        html_exporter = nbconvert.HTMLExporter()
        html_exporter.template_name = 'lab'
        
        for notebook_path in self.notebooks_dir.glob('**/*.ipynb'):
            # チェックポイントをスキップ
            if '.ipynb_checkpoints' in str(notebook_path):
                continue
                
            # 相対パスを保持
            relative_path = notebook_path.relative_to(self.notebooks_dir)
            output_path = self.output_dir / relative_path.with_suffix('.html')
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 変換実行
            (body, resources) = html_exporter.from_filename(str(notebook_path))
            
            # カスタムCSSを追加
            custom_css = """
            <style>
            .jp-OutputArea-output pre {
                background-color: #f5f5f5;
                padding: 10px;
                border-radius: 4px;
            }
            .jp-RenderedHTMLCommon img {
                max-width: 100%;
                height: auto;
            }
            </style>
            """
            body = body.replace('</head>', f'{custom_css}</head>')
            
            # ファイルを保存
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(body)
                
            print(f"Converted: {notebook_path} -> {output_path}")
            
            # 画像などのリソースをコピー
            if 'outputs' in resources:
                for filename, data in resources['outputs'].items():
                    resource_path = output_path.parent / filename
                    with open(resource_path, 'wb') as f:
                        f.write(data)
                        
    def create_index(self):
        """Notebook一覧ページを作成"""
        index_content = """# Jupyter Notebooks

このセクションでは、プロジェクトで使用されているJupyter Notebookを閲覧できます。

## Notebooks一覧

"""
        
        for notebook_html in self.output_dir.glob('**/*.html'):
            relative_path = notebook_html.relative_to(self.output_dir)
            name = notebook_html.stem.replace('_', ' ').title()
            index_content += f"- [{name}]({relative_path})\n"
            
        index_path = self.output_dir / 'index.md'
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(index_content)
```

### APIドキュメントの自動生成

#### Sphinxを使用したAPIドキュメント
```python
# docs/conf.py
import os
import sys
sys.path.insert(0, os.path.abspath('../src'))

project = 'ML Project'
copyright = '2024, Your Name'
author = 'Your Name'

extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.napoleon',
    'sphinx.ext.viewcode',
    'sphinx.ext.githubpages',
    'sphinx_rtd_theme',
    'sphinx.ext.mathjax',
    'myst_parser'
]

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']

# Napoleon設定
napoleon_google_docstring = True
napoleon_numpy_docstring = True
napoleon_include_init_with_doc = True

# MyST設定
myst_enable_extensions = [
    "dollarmath",
    "amsmath",
    "deflist",
    "html_image",
]

# 自動ドキュメント設定
autodoc_default_options = {
    'members': True,
    'member-order': 'bysource',
    'special-members': '__init__',
    'undoc-members': True,
    'exclude-members': '__weakref__'
}
```

## 15.4 実験結果の可視化と公開

### インタラクティブなダッシュボード

#### Plotlyを使用した可視化
```html
<!-- experiments/dashboard.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Experiment Results Dashboard</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <style>
        .dashboard {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .metric-card {
            background: #f5f5f5;
            border-radius: 8px;
            padding: 20px;
            margin: 10px 0;
        }
        .plot-container {
            margin: 20px 0;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <h1>ML Experiment Results</h1>
        
        <div class="metric-card">
            <h2>Latest Metrics</h2>
            <div id="metrics-summary"></div>
        </div>
        
        <div class="plot-container">
            <h3>Training Progress</h3>
            <div id="training-plot"></div>
        </div>
        
        <div class="plot-container">
            <h3>Model Comparison</h3>
            <div id="comparison-plot"></div>
        </div>
        
        <div class="plot-container">
            <h3>Hyperparameter Analysis</h3>
            <div id="hparam-plot"></div>
        </div>
    </div>
    
    <script src="js/dashboard.js"></script>
</body>
</html>
```

#### ダッシュボードのJavaScript
```javascript
// js/dashboard.js
class ExperimentDashboard {
    constructor() {
        this.loadExperimentData();
    }
    
    async loadExperimentData() {
        try {
            const response = await fetch('./data/experiments.json');
            this.data = await response.json();
            this.renderDashboard();
        } catch (error) {
            console.error('Failed to load experiment data:', error);
        }
    }
    
    renderDashboard() {
        this.renderMetricsSummary();
        this.renderTrainingPlot();
        this.renderComparisonPlot();
        this.renderHyperparameterPlot();
    }
    
    renderMetricsSummary() {
        const latest = this.data.experiments[this.data.experiments.length - 1];
        const summaryHtml = `
            <div class="metrics-grid">
                <div class="metric">
                    <h4>Best Accuracy</h4>
                    <p class="value">${(latest.best_accuracy * 100).toFixed(2)}%</p>
                </div>
                <div class="metric">
                    <h4>Training Time</h4>
                    <p class="value">${latest.training_time} hours</p>
                </div>
                <div class="metric">
                    <h4>Model Size</h4>
                    <p class="value">${latest.model_size} MB</p>
                </div>
                <div class="metric">
                    <h4>Inference Time</h4>
                    <p class="value">${latest.inference_time} ms</p>
                </div>
            </div>
        `;
        document.getElementById('metrics-summary').innerHTML = summaryHtml;
    }
    
    renderTrainingPlot() {
        const traces = this.data.experiments.map(exp => ({
            x: exp.epochs,
            y: exp.train_loss,
            name: `${exp.name} (train)`,
            type: 'scatter',
            mode: 'lines'
        }));
        
        // Validation lossも追加
        this.data.experiments.forEach(exp => {
            traces.push({
                x: exp.epochs,
                y: exp.val_loss,
                name: `${exp.name} (val)`,
                type: 'scatter',
                mode: 'lines',
                line: { dash: 'dot' }
            });
        });
        
        const layout = {
            title: 'Training and Validation Loss',
            xaxis: { title: 'Epoch' },
            yaxis: { title: 'Loss' },
            hovermode: 'x unified'
        };
        
        Plotly.newPlot('training-plot', traces, layout);
    }
    
    renderComparisonPlot() {
        const models = this.data.experiments.map(exp => exp.name);
        const metrics = ['accuracy', 'precision', 'recall', 'f1_score'];
        
        const traces = metrics.map(metric => ({
            x: models,
            y: this.data.experiments.map(exp => exp.metrics[metric]),
            name: metric.charAt(0).toUpperCase() + metric.slice(1),
            type: 'bar'
        }));
        
        const layout = {
            title: 'Model Performance Comparison',
            xaxis: { title: 'Model' },
            yaxis: { title: 'Score' },
            barmode: 'group'
        };
        
        Plotly.newPlot('comparison-plot', traces, layout);
    }
    
    renderHyperparameterPlot() {
        // 3D散布図でハイパーパラメータと性能の関係を表示
        const trace = {
            x: this.data.experiments.map(exp => exp.hyperparameters.learning_rate),
            y: this.data.experiments.map(exp => exp.hyperparameters.batch_size),
            z: this.data.experiments.map(exp => exp.metrics.accuracy),
            mode: 'markers',
            marker: {
                size: 12,
                color: this.data.experiments.map(exp => exp.metrics.accuracy),
                colorscale: 'Viridis',
                showscale: true
            },
            text: this.data.experiments.map(exp => exp.name),
            type: 'scatter3d'
        };
        
        const layout = {
            title: 'Hyperparameter Space Exploration',
            scene: {
                xaxis: { title: 'Learning Rate', type: 'log' },
                yaxis: { title: 'Batch Size' },
                zaxis: { title: 'Accuracy' }
            }
        };
        
        Plotly.newPlot('hparam-plot', [trace], layout);
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    new ExperimentDashboard();
});
```

### 実験結果の自動更新

#### GitHub Actionsによる結果収集
```yaml
# .github/workflows/update-results.yml
name: Update Experiment Results

on:
  workflow_run:
    workflows: ["Model Training"]
    types:
      - completed

jobs:
  update-results:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          ref: gh-pages
          
      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          name: experiment-results
          path: ./temp
          
      - name: Process results
        run: |
          python scripts/process_results.py \
            --input ./temp/results.json \
            --output ./data/experiments.json
            
      - name: Generate plots
        run: |
          python scripts/generate_plots.py \
            --data ./data/experiments.json \
            --output ./images/
            
      - name: Commit and push
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          
          git add data/experiments.json images/
          git commit -m "Update experiment results - $(date +'%Y-%m-%d %H:%M:%S')"
          git push
```

## 15.5 自動デプロイとメンテナンス

### CI/CDパイプライン

#### 完全な自動デプロイワークフロー
{% raw %}
```yaml
# .github/workflows/deploy-docs.yml
name: Deploy Documentation

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'src/**'
      - 'notebooks/**'
      - 'mkdocs.yml'
  schedule:
    - cron: '0 2 * * 1'  # 毎週月曜日に再ビルド

jobs:
  build-docs:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for git-revision-date
          
      - name: Set up Python
        uses: actions/setup-python@v6
        with:
          python-version: '3.9'
          
      - name: Install dependencies
        run: |
          pip install -r requirements-docs.txt
          pip install -e .  # プロジェクトをインストール
          
      - name: Convert notebooks
        run: |
          python scripts/notebook_to_docs.py
          
      - name: Generate API documentation
        run: |
          sphinx-apidoc -o docs/api src/
          
      - name: Build MkDocs
        run: |
          mkdocs build --clean
          
      - name: Generate experiment results
        run: |
          python scripts/collect_experiments.py
          cp -r experiments/* site/experiments/
          
      - name: Optimize assets
        run: |
          # 画像の最適化
          find site -name "*.png" -exec optipng {} \;
          find site -name "*.jpg" -exec jpegoptim {} \;
          
          # HTMLの圧縮
          find site -name "*.html" -exec html-minifier \
            --collapse-whitespace \
            --remove-comments \
            --minify-css true \
            --minify-js true \
            -o {} {} \;
            
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./site
          cname: ml-docs.example.com
```
{% endraw %}

### パフォーマンス最適化

#### Service Workerでのキャッシュ
```javascript
// sw.js - Service Worker
const CACHE_NAME = 'ml-docs-v1';
const urlsToCache = [
    '/',
    '/css/style.css',
    '/js/model-demo.js',
    '/models/model.json',
    '/models/labels.json'
];

// インストール時にキャッシュ
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// フェッチ時にキャッシュを確認
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // キャッシュがあればそれを返す
                if (response) {
                    return response;
                }
                
                // なければネットワークから取得
                return fetch(event.request).then(response => {
                    // レスポンスが有効でない場合はそのまま返す
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // レスポンスをキャッシュに保存
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    
                    return response;
                });
            })
    );
});
```

### モニタリングとアナリティクス

#### カスタムアナリティクス実装
```javascript
// analytics.js
class MLDocsAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.events = [];
        this.startTime = Date.now();
        
        // ページビューを記録
        this.trackPageView();
        
        // イベントリスナーを設定
        this.setupEventListeners();
    }
    
    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    trackPageView() {
        this.track('page_view', {
            url: window.location.href,
            referrer: document.referrer,
            screen: `${window.screen.width}x${window.screen.height}`
        });
    }
    
    setupEventListeners() {
        // モデルデモの使用を追跡
        document.addEventListener('model_prediction', (e) => {
            this.track('model_demo_used', {
                model: e.detail.model,
                prediction_time: e.detail.time
            });
        });
        
        // ドキュメントのスクロール深度
        let maxScroll = 0;
        window.addEventListener('scroll', () => {
            const scrollPercentage = (window.scrollY / document.body.scrollHeight) * 100;
            maxScroll = Math.max(maxScroll, scrollPercentage);
        });
        
        // ページ離脱時に送信
        window.addEventListener('beforeunload', () => {
            this.track('page_leave', {
                time_on_page: Date.now() - this.startTime,
                max_scroll_depth: maxScroll
            });
            this.sendEvents();
        });
    }
    
    track(eventName, properties = {}) {
        this.events.push({
            event: eventName,
            properties: {
                ...properties,
                session_id: this.sessionId,
                timestamp: new Date().toISOString()
            }
        });
    }
    
    sendEvents() {
        if (this.events.length === 0) return;
        
        // Beacon APIを使用して確実に送信
        const data = JSON.stringify({
            events: this.events,
            site: 'ml-docs'
        });
        
        navigator.sendBeacon('/api/analytics', data);
        this.events = [];
    }
}

// 初期化（プライバシーに配慮）
if (!window.location.hostname.includes('localhost')) {
    new MLDocsAnalytics();
}
```

### メンテナンススクリプト

#### リンクチェッカー
```python
# scripts/check_links.py
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import concurrent.futures

class LinkChecker:
    def __init__(self, base_url):
        self.base_url = base_url
        self.checked_urls = set()
        self.broken_links = []
        
    def check_site(self):
        """サイト全体のリンクをチェック"""
        self.check_page(self.base_url)
        
        if self.broken_links:
            print(f"\nFound {len(self.broken_links)} broken links:")
            for link in self.broken_links:
                print(f"  - {link['url']} (found on {link['source']})")
        else:
            print("No broken links found!")
            
    def check_page(self, url):
        """ページ内のリンクをチェック"""
        if url in self.checked_urls:
            return
            
        self.checked_urls.add(url)
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
        except Exception as e:
            self.broken_links.append({
                'url': url,
                'source': 'direct check',
                'error': str(e)
            })
            return
            
        # HTMLを解析
        soup = BeautifulSoup(response.text, 'html.parser')
        links = soup.find_all(['a', 'link', 'script', 'img'])
        
        # 並列でリンクをチェック
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            
            for tag in links:
                href = tag.get('href') or tag.get('src')
                if not href:
                    continue
                    
                absolute_url = urljoin(url, href)
                
                # 同じドメインの場合は再帰的にチェック
                if urlparse(absolute_url).netloc == urlparse(self.base_url).netloc:
                    if absolute_url not in self.checked_urls:
                        futures.append(
                            executor.submit(self.check_page, absolute_url)
                        )
                else:
                    # 外部リンクは存在確認のみ
                    futures.append(
                        executor.submit(self.check_external_link, absolute_url, url)
                    )
                    
            concurrent.futures.wait(futures)
            
    def check_external_link(self, url, source):
        """外部リンクの存在確認"""
        try:
            response = requests.head(url, timeout=10, allow_redirects=True)
            response.raise_for_status()
        except Exception as e:
            self.broken_links.append({
                'url': url,
                'source': source,
                'error': str(e)
            })

# 実行
if __name__ == '__main__':
    checker = LinkChecker('https://username.github.io/ml-project')
    checker.check_site()
```

## まとめ

本章では、GitHub Pagesを活用したプロジェクト公開について学習しました：
- GitHub Pagesの基本設定とカスタムドメイン
- TensorFlow.jsを使用したインタラクティブなモデルデモ
- MkDocsやSphinxによる技術ドキュメントの構築
- 実験結果の可視化とダッシュボード作成
- CI/CDによる自動デプロイとメンテナンス

次章では、外部協力者との連携について学習します。

## 確認事項

- [ ] GitHub Pagesを有効化できる
- [ ] 静的サイトジェネレーターを選択・設定できる
- [ ] モデルをブラウザで実行できる形式に変換できる
- [ ] ドキュメントの自動生成パイプラインを構築できる
- [ ] パフォーマンスとアクセシビリティに配慮したサイトを作成できる