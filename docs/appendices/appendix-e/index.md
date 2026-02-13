---
layout: book
title: "付録E：便利なGitエイリアス集"
---

# 付録E：便利なGitエイリアス集

## エイリアスの設定方法

### グローバル設定
```bash
# 個別に設定
git config --global alias.co checkout
git config --global alias.br branch

# 設定ファイルを直接編集
git config --global --edit
```

### ローカル設定（プロジェクト別）
```bash
# 現在のリポジトリのみ
git config alias.st status
```

### 設定ファイルの場所
- グローバル: `~/.gitconfig`
- ローカル: `.git/config`

## 基本的なエイリアス

### 短縮系
```bash
[alias]
    # 基本コマンドの短縮
    co = checkout
    br = branch
    ci = commit
    st = status
    df = diff
    dc = diff --cached
    
    # よく使う組み合わせ
    cob = checkout -b
    cm = commit -m
    ca = commit -am
    
    # ステージング関連
    a = add
    aa = add .
    ap = add -p
    au = add -u
```

### ステータス確認
```bash
[alias]
    # 短縮ステータス
    s = status -s
    
    # ブランチ付きステータス
    sb = status -sb
    
    # 変更ファイルのみ表示
    modified = ls-files -m
    
    # 未追跡ファイルのみ表示
    untracked = ls-files -o --exclude-standard
    
    # ステージされたファイルのみ
    staged = diff --cached --name-only
```

## ログ表示系

### 美しいログ表示
```bash
[alias]
    # カラフルなワンライン表示
    l = log --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s' --graph
    
    # 詳細付きログ
    ll = log --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s' --graph --stat
    
    # 最近のコミット
    recent = log --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s' --graph -10
    
    # 今日のコミット
    today = log --since=midnight --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s'
    
    # 特定期間のコミット
    week = log --since='1 week ago' --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s'
```

### コミット検索
```bash
[alias]
    # コミットメッセージで検索
    find = log --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s' --grep
    
    # ファイル名で検索
    track = log --follow --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s' --
    
    # 変更内容で検索
    search = log -S
    
    # 作者で検索
    author = "!f() { git log --author=\"$1\" --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s'; }; f"
```

## ブランチ操作

### ブランチ管理
```bash
[alias]
    # ブランチ一覧（最終更新日付き）
    branches = branch -a --format='%(HEAD) %(color:yellow)%(refname:short)%(color:reset) - %(color:blue)%(authorname)%(color:reset) (%(color:green)%(committerdate:relative)%(color:reset))'
    
    # マージ済みブランチ
    merged = branch --merged
    
    # 未マージブランチ
    unmerged = branch --no-merged
    
    # リモートブランチ削除
    delete-remote = push origin --delete
    
    # ローカルのマージ済みブランチを削除
    cleanup = "!git branch --merged | grep -v '\\*\\|main\\|master\\|develop' | xargs -n 1 git branch -d"
```

### ブランチ切り替え
```bash
[alias]
    # 最近のブランチに切り替え
    prev = checkout @{-1}
    
    # mainに切り替えてpull
    main = !git checkout main && git pull origin main
    
    # developに切り替えてpull
    dev = !git checkout develop && git pull origin develop
    
    # 対話的にブランチ選択（fzf必要）
    coi = "!git branch | fzf | xargs git checkout"
```

## コミット操作

### コミット修正
```bash
[alias]
    # 直前のコミットを修正
    amend = commit --amend
    
    # メッセージ変更なしで修正
    amendno = commit --amend --no-edit
    
    # 空コミット
    empty = commit --allow-empty -m
    
    # コミットをなかったことに（ファイルは保持）
    uncommit = reset --soft HEAD~1
    
    # コミットとファイル変更をなかったことに
    discard = reset --hard HEAD~1
```

### インタラクティブ操作
```bash
[alias]
    # インタラクティブリベース
    rebase-i = rebase -i
    
    # 最近のn個のコミットをリベース
    fixup = "!f() { git rebase -i HEAD~$1; }; f"
    
    # コミットを1つにまとめる
    squash = "!f() { git rebase -i HEAD~$1; }; f"
```

## ML開発向けエイリアス

### 実験管理
```bash
[alias]
    # 実験ブランチを作成
    exp = "!f() { git checkout -b experiment/$1-$(date +%Y%m%d); }; f"
    
    # 実験結果をコミット
    experiment = "!f() { git add -A && git commit -m \"Experiment: $1\nResults: $2\"; }; f"
    
    # モデルをコミット（LFS使用）
    model-commit = "!f() { git lfs track \"*.pth\" \"*.h5\" \"*.onnx\" && git add .gitattributes && git add $1 && git commit -m \"Add model: $1\"; }; f"
    
    # データセットの変更を記録
    data-update = "!f() { git add data/ && git commit -m \"Update dataset: $1\"; }; f"
```

### 実験の比較
```bash
[alias]
    # 2つの実験ブランチの差分
    exp-diff = "!f() { git diff experiment/$1..experiment/$2 -- metrics/ results/; }; f"
    
    # 実験結果のサマリー
    exp-summary = "!git log --grep='Experiment:' --pretty=format:'%C(yellow)%h%Creset %C(cyan)%cr%Creset %s %C(green)%b%Creset' -10"
    
    # メトリクスの変化を追跡
    metrics = "!git log --follow --pretty=format:'%C(yellow)%h%Creset %C(cyan)%cr%Creset %s' -- metrics/"
```

## 統計・分析

### コントリビューション統計
```bash
[alias]
    # コントリビューター統計
    contributors = shortlog -sn
    
    # 今週のコントリビューション
    stats = "!git log --author=\"$(git config user.name)\" --since='1 week ago' --pretty=tformat: --numstat | awk '{a+=$1;r+=$2}END{printf \"Added: %s, Removed: %s, Total: %s\\n\",a,r,a-r}'"
    
    # ファイル別の変更頻度
    churn = "!git log --all -M -C --name-only --format='format:' \"$@\" | sort | grep -v '^$' | uniq -c | sort -n"
    
    # 最も変更されているファイル
    hotfiles = "!git log --pretty=format: --name-only | sort | uniq -c | sort -rg | head -20"
```

### コードレビュー支援
```bash
[alias]
    # PRレビュー用（ベースブランチとの差分）
    review = "!f() { git diff $(git merge-base HEAD ${1:-main})..HEAD; }; f"
    
    # レビュー対象ファイル一覧
    review-files = "!f() { git diff --name-only $(git merge-base HEAD ${1:-main})..HEAD; }; f"
    
    # コンフリクトファイルを表示
    conflicts = diff --name-only --diff-filter=U
```

## 危険な操作（注意して使用）

### 履歴の書き換え
```bash
[alias]
    # 特定のファイルを履歴から完全削除
    remove-file = "!f() { git filter-branch --force --index-filter \"git rm --cached --ignore-unmatch $1\" --prune-empty --tag-name-filter cat -- --all; }; f"
    
    # 作者情報を変更
    change-author = "!f() { git filter-branch --env-filter 'export GIT_AUTHOR_NAME=\"$1\"; export GIT_AUTHOR_EMAIL=\"$2\"' --tag-name-filter cat -- --all; }; f"
    
    # リモートを強制的に上書き
    force-push = push --force-with-lease
```

## ワークフロー支援

### GitHub連携
```bash
[alias]
    # PRを作成（GitHub CLI必要）
    pr = "!gh pr create"
    
    # Issueを作成
    issue = "!gh issue create"
    
    # 現在のブランチのPRを表示
    show-pr = "!gh pr view"
    
    # ブラウザで開く
    browse = "!gh repo view --web"
```

### 日常のワークフロー
```bash
[alias]
    # 作業開始（最新を取得してブランチ作成）
    start = "!f() { git checkout main && git pull && git checkout -b $1; }; f"
    
    # 作業完了（add, commit, push）
    # ※ 新規ファイルは `git add <path>` 等で明示的に追加する（`git add -u` は tracked のみ）
    done = "!f() { git add -u && git commit -m \"$1\" && git push -u origin HEAD; }; f"
    
    # 一時保存
    # ※ 新規ファイルは `git add <path>` 等で明示的に追加する（`git add -u` は tracked のみ）
    wip = "!git add -u && git commit -m 'WIP: Work in progress'"
    
    # 同期（pull → rebase → push）
    sync = "!f() { git pull --rebase origin $(git branch --show-current) && git push; }; f"
```

## カスタム関数エイリアス

### 高度な機能
```bash
[alias]
    # ブランチをバックアップ
    backup = "!f() { git branch backup/$(git branch --show-current)-$(date +%Y%m%d-%H%M%S); }; f"
    
    # タグを作成してプッシュ
    release = "!f() { git tag -a v$1 -m \"Release version $1\" && git push origin v$1; }; f"
    
    # 特定のコミットまでリセット（確認付き）
    reset-to = "!f() { echo \"Reset to $1? [y/N]\"; read answer; if [ \"$answer\" = \"y\" ]; then git reset --hard $1; fi; }; f"
    
    # すべてのリモートから最新を取得
    fetch-all = "!git remote | xargs -L1 git fetch --prune"
```

## エイリアス設定例（.gitconfig）

```ini
[alias]
    # === 基本短縮形 ===
    co = checkout
    br = branch
    ci = commit
    st = status
    
    # === ログ表示 ===
    l = log --pretty=format:'%C(yellow)%h%Creset %C(blue)%an%Creset %C(cyan)%cr%Creset %s' --graph
    
    # === ブランチ操作 ===
    cleanup = "!git branch --merged | grep -v '\\*\\|main\\|master\\|develop' | xargs -n 1 git branch -d"
    
    # === ML開発 ===
    exp = "!f() { git checkout -b experiment/$1-$(date +%Y%m%d); }; f"
    
    # === 日常ワークフロー ===
    sync = "!f() { git pull --rebase origin $(git branch --show-current) && git push; }; f"
```

## 使用例

```bash
# 実験を開始
git exp resnet50

# 作業完了
git done "Implement data augmentation"

# ログを美しく表示
git l

# マージ済みブランチをクリーンアップ
git cleanup

# 統計情報を表示
git stats
```

これらのエイリアスを活用することで、日常的なGit操作を大幅に効率化できます。プロジェクトやチームの慣習に合わせてカスタマイズしてください。
