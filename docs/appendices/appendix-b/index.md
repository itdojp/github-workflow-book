---
layout: book
title: "付録B：トラブルシューティングガイド"
---

# 付録B：トラブルシューティングガイド

## 認証・接続関連

### 問題：SSHキーが認識されない
```bash
$ git push origin main
Permission denied (publickey).
fatal: Could not read from remote repository.
```

**解決方法：**
```bash
# SSHキーの確認
ls -la ~/.ssh

# SSHエージェントを起動
eval "$(ssh-agent -s)"

# キーを追加
ssh-add ~/.ssh/id_ed25519

# 接続テスト
ssh -T git@github.com

# 詳細なデバッグ情報を表示
ssh -vT git@github.com
```

### 問題：HTTPSで毎回パスワードを要求される

**解決方法：**
```bash
# 認証情報をキャッシュ（15分）
git config --global credential.helper cache

# 認証情報を永続化（macOS）
git config --global credential.helper osxkeychain

# 認証情報を永続化（Windows）
git config --global credential.helper wincred

# Personal Access Tokenを使用
git remote set-url origin https://TOKEN@github.com/username/repo.git
```

### 問題：二要素認証後にpushできない

**解決方法：**
1. Personal Access Token (PAT)を生成
   - Settings → Developer settings → Personal access tokens
   - 必要なスコープを選択（repo、workflow等）

2. PATをパスワードとして使用
```bash
Username: your-username
Password: your-personal-access-token
```

## リポジトリ操作関連

### 問題：誤って大きなファイルをコミットした
```bash
remote: error: File large_model.pth is 156.24 MB; this exceeds GitHub's file size limit of 100.00 MB
```

**解決方法：**
```bash
# 最新のコミットから削除
git rm --cached large_model.pth
git commit --amend

# 過去のコミットから削除（BFG Repo-Cleaner使用）
java -jar bfg.jar --delete-files large_model.pth
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Git LFSに移行
git lfs track "*.pth"
git add .gitattributes
git add large_model.pth
git commit -m "Move large files to LFS"
```

### 問題：間違ったブランチにコミットした

**解決方法：**
```bash
# 方法1: コミットを正しいブランチに移動
git checkout correct-branch
git cherry-pick wrong-branch-commit-hash
git checkout wrong-branch
git reset --hard HEAD~1

# 方法2: リセットして再コミット
git reset --soft HEAD~1  # コミットを取り消し（変更は保持）
git stash               # 変更を退避
git checkout correct-branch
git stash pop           # 変更を復元
git add .
git commit -m "Correct commit message"
```

### 問題：マージコンフリクトが解決できない

**解決方法：**
```bash
# コンフリクトの確認
git status

# 手動で解決
# ファイルを編集してコンフリクトマーカーを削除
<<<<<<< HEAD
Your changes
=======
Their changes
>>>>>>> branch-name

# 解決後
git add resolved_file.py
git commit

# マージを中止したい場合
git merge --abort

# Visual Mergeツールを使用
git mergetool
```

## GitHub Actions関連

### 問題：ワークフローが実行されない

**チェック項目：**
1. ワークフローファイルの場所
   - `.github/workflows/`ディレクトリ内にあるか

2. YAMLの構文エラー
```bash
# オンラインバリデーターを使用
# または
yamllint .github/workflows/workflow.yml
```

3. トリガー条件の確認
```yaml
on:
  push:
    branches: [ main ]  # ブランチ名が正しいか
    paths:
      - 'src/**'       # パスフィルターが正しいか
```

4. ワークフローの有効化
   - Actions タブで無効化されていないか確認

### 問題：Secretsが機能しない

**解決方法：**
```yaml
# 正しい参照方法
env:
  API_KEY: ${{ secrets.API_KEY }}

# デバッグ（値は隠される）
- name: Debug secrets
  run: |
    echo "Secret length: ${#API_KEY}"
    if [ -z "$API_KEY" ]; then
      echo "Secret is empty!"
    fi
```

### 問題：アーティファクトのアップロードが失敗

**解決方法：**
```yaml
# パスの確認
- name: Check files
  run: |
    ls -la
    find . -name "*.pth"

# 正しいアップロード設定
- uses: actions/upload-artifact@v3
  with:
    name: model-artifacts
    path: |
      models/*.pth
      !models/*_temp.pth  # 除外パターン
    retention-days: 30
    if-no-files-found: error  # ファイルがない場合エラー
```

## 大規模ファイル・データ管理

### 問題：Git LFSの容量制限に達した

**解決方法：**
```bash
# 使用状況の確認
git lfs ls-files --size

# 不要なLFSファイルを削除
git lfs prune

# 履歴から完全に削除
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/large/file' \
  --prune-empty --tag-name-filter cat -- --all

# 外部ストレージに移行
# S3やGoogle Cloud Storageを使用
```

### 問題：DVCでデータが同期されない

**解決方法：**
```bash
# リモートストレージの確認
dvc remote list

# 認証情報の確認
dvc remote modify myremote access_key_id ${AWS_ACCESS_KEY_ID}
dvc remote modify myremote secret_access_key ${AWS_SECRET_ACCESS_KEY}

# 強制的に再プッシュ
dvc push -f

# キャッシュをクリア
dvc cache dir
rm -rf .dvc/cache
dvc pull
```

## パフォーマンス問題

### 問題：git操作が遅い

**解決方法：**
```bash
# リポジトリの最適化
git gc --aggressive --prune=now

# 部分クローン（大規模リポジトリ）
git clone --filter=blob:none --sparse <url>

# 必要なディレクトリのみチェックアウト
git sparse-checkout init --cone
git sparse-checkout set src docs

# プロトコルの変更（HTTP → SSH）
git remote set-url origin git@github.com:user/repo.git
```

### 問題：GitHub Actionsの実行時間が長い

**最適化方法：**
```yaml
# 1. キャッシュの活用
- uses: actions/cache@v3
  with:
    path: |
      ~/.cache/pip
      ~/.cache/pre-commit
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}

# 2. 並列実行
strategy:
  matrix:
    python-version: [3.8, 3.9, 3.10]
  max-parallel: 3

# 3. 条件付き実行
- name: Run expensive tests
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  run: pytest tests/integration/

# 4. self-hosted runnerの使用
runs-on: [self-hosted, gpu]
```

## セキュリティ関連

### 問題：誤ってシークレットをコミットした

**緊急対処：**
```bash
# 1. 即座にシークレットを無効化
# GitHub、AWS、API providerで該当のキーを無効化

# 2. コミット履歴から削除
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/secret/file' \
  --prune-empty --tag-name-filter cat -- --all

# 3. 強制プッシュ
git push origin --force --all
git push origin --force --tags

# 4. GitHub Supportに連絡
# キャッシュからの削除を依頼
```

### 問題：依存関係の脆弱性警告

**解決方法：**
```bash
# Dependabotアラートの確認
# Security → Dependabot alerts

# 手動アップデート
pip install --upgrade vulnerable-package

# requirements.txtの更新
pip freeze > requirements.txt

# 自動修正PRのマージ
# Dependabot PRを確認してマージ
```

## ML/AI特有の問題

### 問題：モデルファイルのバージョン管理

**解決方法：**
```python
# モデル保存時にメタデータを含める
import torch
import json

checkpoint = {
    'model_state_dict': model.state_dict(),
    'optimizer_state_dict': optimizer.state_dict(),
    'epoch': epoch,
    'loss': loss,
    'git_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD']).decode().strip(),
    'timestamp': datetime.now().isoformat()
}

torch.save(checkpoint, f'model_v{version}.pth')

# メタデータを別ファイルに保存
with open(f'model_v{version}_meta.json', 'w') as f:
    json.dump({
        'commit': checkpoint['git_commit'],
        'timestamp': checkpoint['timestamp'],
        'metrics': {'loss': loss, 'accuracy': accuracy}
    }, f)
```

### 問題：実験の再現性

**解決方法：**
```bash
# 環境の固定
pip freeze > requirements.txt
conda env export > environment.yml

# Dockerfileの使用
FROM python:3.9
COPY requirements.txt .
RUN pip install -r requirements.txt

# シード値の固定
python train.py --seed 42

# Git LFSでデータセットも管理
git lfs track "data/*.csv"
```

## コラボレーション問題

### 問題：PRがマージできない

**チェック項目：**
1. ブランチ保護ルール
   - 必要なレビュー数
   - ステータスチェック
   - ブランチが最新か

2. コンフリクトの解決
```bash
git checkout feature-branch
git merge main
# コンフリクトを解決
git push
```

3. CIの失敗
   - Actionsタブで詳細を確認
   - ローカルでテストを実行

### 問題：Issueやの整理ができていない

**解決方法：**
```yaml
# .github/stale.yml
daysUntilStale: 60
daysUntilClose: 7
staleLabel: wontfix
exemptLabels:
  - pinned
  - security
markComment: >
  This issue has been automatically marked as stale.
```

## デバッグのコツ

### Git操作の詳細ログ
```bash
# 詳細なログを表示
GIT_TRACE=1 git push
GIT_CURL_VERBOSE=1 git clone https://...
GIT_SSH_COMMAND="ssh -v" git clone git@github.com:...
```

### GitHub APIのデバッグ
```bash
# APIレート制限の確認
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/rate_limit

# 詳細なエラー情報
curl -v -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/owner/repo
```

### Actions のデバッグ
```yaml
# デバッグログを有効化
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true

# tmate でSSHデバッグ
- name: Setup tmate session
  uses: mxschmitt/action-tmate@v3
  if: ${{ failure() }}
```

## よくあるエラーメッセージ

### "Updates were rejected because the remote contains work"
```bash
# 解決方法
git pull --rebase origin main
git push origin main
```

### "You have divergent branches"
```bash
# 解決方法
git config pull.rebase false  # merge (default)
git config pull.rebase true   # rebase
git pull
```

### "filename too long"（Windows）
```bash
# 解決方法
git config --system core.longpaths true
```

### "SSL certificate problem"
```bash
# 一時的な解決（非推奨）
git config --global http.sslVerify false

# 正しい解決方法
git config --global http.sslCAInfo /path/to/certificate.crt
```

---

## サポートリソース

- GitHub Status: https://www.githubstatus.com/
- GitHub Community Forum: https://github.community/
- GitHub Documentation: https://docs.github.com/
- Stack Overflow: https://stackoverflow.com/questions/tagged/github