# 第3章：必須コマンドとAI活用

## 3.1 環境構築とGitの初期設定

### Gitのインストール

#### Windows
```bash
# Git for Windowsをダウンロード
# https://git-scm.com/download/win
```

#### macOS
```bash
# Homebrewを使用
brew install git
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install git
```

### 初期設定

#### ユーザー情報の設定
```bash
# 名前の設定
git config --global user.name "Your Name"

# メールアドレスの設定
git config --global user.email "your.email@example.com"
```

#### エディタの設定
```bash
# VS Codeを使用する場合
git config --global core.editor "code --wait"
```

#### 設定の確認
```bash
git config --list
```

### GitHubとの接続設定

#### SSH鍵の生成
```bash
# SSH鍵を生成（ed25519推奨）
ssh-keygen -t ed25519 -C "your.email@example.com"

# 古いシステム対応が必要な場合のRSA
# ssh-keygen -t rsa -b 4096 -C "your.email@example.com"

# 公開鍵を表示（GitHubに登録）
cat ~/.ssh/id_ed25519.pub
```

> **💡 SSH鍵タイプの選択**: 
> - **ed25519（推奨）**: 高速で安全性が高く、鍵のサイズが小さい
> - **RSA**: 古いシステムとの互換性が必要な場合のみ使用（4096ビット推奨）
> 
> **注意**: ed25519は2014年以降のOpenSSHで利用可能です。古いシステム（CentOS 6等）では
> RSA 4096ビットを使用してください。

#### 接続テスト
```bash
ssh -T git@github.com
```

## 3.2 基本コマンド（clone, add, commit, push, pull）とAI支援

本節では、第2章で学んだAI協働の基礎を実際のGitコマンド操作に適用します。AIを効果的に活用することで、コマンド操作の効率化と品質向上を実現できます。

### clone - リポジトリの複製
```bash
# HTTPSを使用
git clone https://github.com/<your-username>/<repository-name>.git

# SSHを使用（推奨）
git clone git@github.com:<your-username>/<repository-name>.git

# 特定のディレクトリ名で複製
git clone git@github.com:<your-username>/<repository-name>.git my-project
```

### add - 変更をステージングエリアに追加
```bash
# 特定のファイルを追加
git add filename.py

# 複数ファイルを追加
git add file1.py file2.py

# ディレクトリ全体を追加
git add src/

# すべての変更を追加（慎重に使用）
git add .
# ⚠️ 注意: 一時ファイル、ビルド成果物、機密情報等の
# 意図しないファイルが含まれる可能性があります。
# git status で確認してから使用することを推奨

# 対話的に追加
git add -p
```

#### AIを使った効率的なファイル選択
第2章のCLEAR方式を使って、AIに適切なファイルの選択を依頼できます：

```markdown
## AI指示例（第2章のCLEAR方式を使用）

### Context
画像分類モデルの精度向上プロジェクトでデータ前処理機能を実装中です。
具体的には、データ正規化とデータ拡張機能を追加し、現在の検証精度75%を
80%以上に向上させることが目標です。複数のファイルを変更しましたが、
論理的なコミット単位に分けてどれをコミットすべきか迷っています。
このデータ前処理機能は、後続のモデル学習パイプラインに影響するため、
適切なコミット戦略が重要です。

### Logic
`git status`の出力を分析して、以下の観点でファイルを分類してください：
1. 本機能に直接関連するファイル
2. テストファイル
3. ドキュメント
4. 一時ファイルやデバッグ用ファイル

### Example
期待する出力形式：
```
Modified files:
- data/preprocessor.py (本機能)
- tests/test_preprocessor.py (テスト)
- README.md (ドキュメント)
- debug_output.log (一時ファイル)
```

### Action
適切なgit addコマンドを提案してください。

### Review
セキュリティリスクやコミット範囲の妥当性をチェックしてください。
```

**AI回答例**：
```bash
# 本機能とテストを一緒にコミット（推奨）
git add data/preprocessor.py tests/test_preprocessor.py

# ドキュメントは別コミットに
git add README.md

# debug_output.logは.gitignoreに追加を推奨
echo "debug_output.log" >> .gitignore
```

### commit - 変更を記録
```bash
# コミットメッセージを指定
git commit -m "Add feature: data preprocessing pipeline"

# エディタでメッセージを編集
git commit

# ステージングをスキップして直接コミット
git commit -am "Fix: correct validation split ratio"

# ⚠️ 注意: -aオプションの使用上の注意
# ・追跡中のファイルのみが対象（新規ファイルはステージングされない）
# ・意図しない変更もコミットされる可能性があるため、
#   変更内容をよく確認してから使用することを推奨
# ・レビュー前に必ず git show で変更内容を確認
```

#### コミットメッセージの規約
```
<type>: <subject>

<body>

<footer>
```

型の例：
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: フォーマット
- `refactor`: リファクタリング
- `test`: テスト
- `chore`: ビルドツールなど

### push - リモートに送信
```bash
# 現在のブランチをプッシュ
git push

# 初回プッシュ（上流ブランチを設定）
git push -u origin main

# 特定のブランチをプッシュ
git push origin feature/new-model

# タグをプッシュ
git push --tags
```

### pull - リモートから取得
```bash
# 現在のブランチを更新
git pull

# リベースモードで取得（個人ブランチでの使用推奨）
git pull --rebase
# ⚠️ 注意: 共有ブランチ（main、develop）での使用は要注意
# ・履歴を書き換えるため、チーム合意が必要
# ・リモートと異なる履歴になる可能性

# 特定のリモートブランチから取得
git pull origin develop
```

## 3.3 ブランチ操作（checkout, branch, merge）

### branch - ブランチの管理
```bash
# ブランチ一覧を表示
git branch

# リモートブランチも含めて表示
git branch -a

# 新しいブランチを作成
git branch feature/data-augmentation

# ブランチを削除
git branch -d feature/completed-feature

# 強制削除
git branch -D feature/abandoned-feature
```

### checkout - ブランチの切り替え
```bash
# 既存のブランチに切り替え
git checkout develop

# 新しいブランチを作成して切り替え
git checkout -b feature/new-architecture

# 特定のファイルを復元
git checkout -- filename.py

# リモートブランチを追跡
git checkout -b feature/remote-feature origin/feature/remote-feature
```

#### 💡 新しいコマンド（Git 2.23以降）
Git 2.23以降では、`checkout`の多機能性を分割したより明確なコマンドが利用可能です：

```bash
# ブランチ切り替え専用コマンド
git switch develop
git switch -c feature/new-architecture  # 新ブランチ作成＋切り替え

# ファイル復元専用コマンド  
git restore filename.py                 # ワーキングディレクトリを復元
git restore --staged filename.py        # ステージングエリアから除外
```

> **推奨**: 新しいプロジェクトでは`switch`と`restore`の使用を推奨します。
> 
> **背景**: `git checkout`は多機能すぎて混乱を招くため、Git 2.23で機能を分割：
> - `switch`: ブランチ操作専用（より直感的）
> - `restore`: ファイル復元専用（誤操作リスクを軽減）

### switch（新しいコマンド）
```bash
# ブランチの切り替え
git switch develop

# 新しいブランチを作成して切り替え
git switch -c feature/new-feature
```

### merge - ブランチの統合
```bash
# 現在のブランチに他のブランチをマージ
git merge feature/completed-feature

# マージコミットを作成しない（fast-forward）
git merge --ff-only feature/simple-change

# 必ずマージコミットを作成
git merge --no-ff feature/important-feature

# マージを中止
git merge --abort
```

## 3.4 状態確認（status, log, diff）

### status - 作業状態の確認
```bash
# 現在の状態を表示
git status

# 短縮表示
git status -s

# ブランチ情報も表示
git status -sb
```

出力の読み方：
```
On branch main
Your branch is up to date with 'origin/main'.

Changes to be committed:     # ステージング済み
  (use "git restore --staged <file>..." to unstage)
        modified:   src/model.py

Changes not staged for commit:  # 未ステージング
  (use "git add <file>..." to update what will be committed)
        modified:   src/train.py

Untracked files:              # 未追跡
  (use "git add <file>..." to include in what will be committed)
        data/
```

### log - 履歴の確認
```bash
# 基本的な履歴表示
git log

# 1行表示
git log --oneline

# グラフ表示
git log --graph --oneline --all

# 特定ファイルの履歴
git log -- src/model.py

# 検索
git log --grep="fix"

# 統計情報付き
git log --stat

# カスタムフォーマット
git log --pretty=format:"%h - %an, %ar : %s"
```

### diff - 差分の確認
```bash
# 作業ディレクトリとステージングの差分
git diff

# ステージングとリポジトリの差分
git diff --staged

# ブランチ間の差分
git diff main..feature/new-model

# 特定のコミット間の差分
git diff abc123..def456

# ファイル名のみ表示
git diff --name-only

# 統計情報
git diff --stat
```

## 3.5 コンフリクト解決の基本

### コンフリクトの発生
マージ時に同じ箇所が異なる内容に変更されている場合に発生。

### コンフリクトマーカー
```python
<<<<<<< HEAD
def calculate_loss(y_true, y_pred):
    return mean_squared_error(y_true, y_pred)
=======
def calculate_loss(y_true, y_pred):
    return mean_absolute_error(y_true, y_pred)
>>>>>>> feature/mae-loss
```

### 解決手順
1. コンフリクトファイルを開く
2. コンフリクトマーカーを確認
3. 正しい内容に編集
4. マーカーを削除
5. ファイルを保存

```bash
# コンフリクトを解決後
git add src/loss.py
git commit -m "Merge: resolve loss function conflict"
```

### コンフリクト解決ツール
```bash
# マージツールを起動
git mergetool

# VS Codeを使用する場合の設定
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'
```

## 2.6 .gitignoreの設定

### .gitignoreの役割
Gitで管理しないファイルを指定します。

### AI開発向け.gitignoreの例
```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv

# Jupyter Notebook
.ipynb_checkpoints/
*.ipynb_checkpoints

# データセット（特定ディレクトリのみ除外）
data/raw/
data/processed/
data/cache/
# 注意: プロジェクトによってはサンプルデータは含める場合があります
# その場合は data/samples/ をこのリストから除外してください

# 大きなデータファイル（プロジェクト要件に応じて調整）
# *.csv  # すべてのCSVを除外する場合（要検討）
# *.json # すべてのJSONを除外する場合（要検討）
*.parquet
*.h5
*.hdf5

# AI/MLライブラリ固有のキャッシュ
# Hugging Face Transformers
.cache/huggingface/
transformers_cache/

# PyTorch Lightning
lightning_logs/
.pl_cache/

# TensorFlow
tf_logs/
.tensorflow/

# MLflow
mlruns/
mlflow_artifacts/

# Weights & Biases
wandb/

# DVC (Data Version Control)
.dvc/cache
.dvc/tmp

# モデルファイル
models/saved/
models/checkpoints/
*.pkl
*.pth
*.ckpt
*.onnx
checkpoints/

# ログとメトリクス
logs/
*.log
tensorboard/
results/

# 環境設定とシークレット
.env
.env.local
.env.*.local
config/secrets.yaml
credentials.json

# IDE設定
.vscode/
.idea/
*.swp
*.swo

# OS固有
.DS_Store
Thumbs.db

# 実験・出力結果
experiments/
outputs/
artifacts/
temp/
tmp/
results/
```

> **💡 カスタマイズのガイド**: 上記は主要なAI/MLプロジェクトの共通項目をリストアップしています。プロジェクトの要件に応じて以下のように調整してください：
> - **設定ファイル**: サンプル設定ファイルは含める場合があります
> - **小さなデータ**: デモ用の小さなデータセットは含める場合があります  
> - **フレームワーク固有**: 使用しないフレームワークの項目は削除可能
> - **チーム固有**: チームの開発環境に合わせて IDE設定を調整

### .gitignoreの適用
```bash
# .gitignoreを作成後
git add .gitignore
git commit -m "Add .gitignore for AI project"

# 既に追跡されているファイルを除外
git rm --cached filename
git commit -m "Remove tracked file from repository"
```

### グローバル.gitignore
```bash
# グローバル設定
git config --global core.excludesfile ~/.gitignore_global
```

## まとめ

本章では、Gitの基本的なコマンドと操作を学習しました：
- 初期設定でユーザー情報とGitHub接続を設定
- clone, add, commit, push, pullの基本サイクル
- ブランチ操作でパラレル開発が可能
- status, log, diffで状態を確認
- コンフリクト解決は避けられない作業
- .gitignoreで不要ファイルを除外

次章では、GitHubでの協働作業について実践的に学習します。

## 確認事項

- [ ] Gitの初期設定が完了している
- [ ] 基本的なコマンドを実行できる
- [ ] ブランチの作成と切り替えができる
- [ ] コンフリクトの解決方法を理解している
- [ ] .gitignoreファイルを作成できる