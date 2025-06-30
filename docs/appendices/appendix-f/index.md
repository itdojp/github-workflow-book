# 付録F：推奨VS Code拡張機能

{% include navigation.html %}

## Git/GitHub関連

### 必須拡張機能

#### GitLens — Git supercharged
```json
{
  "id": "eamodio.gitlens",
  "description": "Git blame、履歴、差分を強化",
  "主な機能": [
    "行ごとのblame表示",
    "ファイル/行の履歴",
    "コミット検索",
    "ブランチ比較"
  ],
  "設定例": {
    "gitlens.hovers.currentLine.over": "line",
    "gitlens.currentLine.enabled": false,
    "gitlens.codeLens.enabled": false
  }
}
```

#### GitHub Pull Requests and Issues
```json
{
  "id": "GitHub.vscode-pull-request-github",
  "description": "VS Code内でPRレビュー",
  "主な機能": [
    "PR作成・レビュー",
    "Issue管理",
    "コメント対応",
    "CI状態確認"
  ]
}
```

#### GitHub Copilot
```json
{
  "id": "GitHub.copilot",
  "description": "AIペアプログラミング",
  "設定例": {
    "github.copilot.enable": {
      "*": true,
      "yaml": true,
      "plaintext": false,
      "markdown": true
    }
  }
}
```

### 追加推奨

#### Git Graph
```json
{
  "id": "mhutchie.git-graph",
  "description": "ビジュアルなGit履歴表示",
  "使い方": "コマンドパレット > Git Graph: View Git Graph"
}
```

#### Conventional Commits
```json
{
  "id": "vivaxy.vscode-conventional-commits",
  "description": "規約に従ったコミットメッセージ作成支援"
}
```

## Python/ML開発

### 基本環境

#### Python
```json
{
  "id": "ms-python.python",
  "description": "Python開発の基本",
  "設定例": {
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.formatting.provider": "black",
    "python.testing.pytestEnabled": true
  }
}
```

#### Pylance
```json
{
  "id": "ms-python.vscode-pylance",
  "description": "高速な言語サーバー",
  "設定例": {
    "python.languageServer": "Pylance",
    "python.analysis.typeCheckingMode": "strict"
  }
}
```

### Jupyter/Notebook

#### Jupyter
```json
{
  "id": "ms-toolsai.jupyter",
  "description": "Jupyter Notebook サポート",
  "主な機能": [
    "Notebookの編集・実行",
    "変数エクスプローラー",
    "プロット表示",
    "Markdownプレビュー"
  ]
}
```

#### Jupyter Keymap
```json
{
  "id": "ms-toolsai.jupyter-keymap",
  "description": "Jupyter互換のキーバインド"
}
```

### AI/ML特化

#### TensorFlow Snippets
```json
{
  "id": "vahidk.tensorflow-snippets",
  "description": "TensorFlowコードスニペット"
}
```

#### Python Docstring Generator
```json
{
  "id": "njpwerner.autodocstring",
  "description": "docstring自動生成",
  "設定例": {
    "autoDocstring.docstringFormat": "google",
    "autoDocstring.includeExtendedSummary": true
  }
}
```

## コード品質

### Linter/Formatter

#### Prettier
```json
{
  "id": "esbenp.prettier-vscode",
  "description": "コードフォーマッター",
  "設定例": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  }
}
```

#### ESLint
```json
{
  "id": "dbaeumer.vscode-eslint",
  "description": "JavaScript/TypeScript linter",
  "設定例": {
    "eslint.validate": [
      "javascript",
      "javascriptreact",
      "typescript",
      "typescriptreact"
    ]
  }
}
```

#### Black Formatter
```json
{
  "id": "ms-python.black-formatter",
  "description": "Python用Black formatter",
  "設定例": {
    "[python]": {
      "editor.defaultFormatter": "ms-python.black-formatter",
      "editor.formatOnSave": true
    }
  }
}
```

### テスト

#### Python Test Explorer
```json
{
  "id": "littlefoxteam.vscode-python-test-adapter",
  "description": "テストエクスプローラーUI"
}
```

#### Coverage Gutters
```json
{
  "id": "ryanluker.vscode-coverage-gutters",
  "description": "コードカバレッジ表示",
  "使い方": "カバレッジファイルを生成後、ガターに表示"
}
```

## Docker/コンテナ

#### Docker
```json
{
  "id": "ms-azuretools.vscode-docker",
  "description": "Docker統合",
  "主な機能": [
    "Dockerfile構文ハイライト",
    "イメージ/コンテナ管理",
    "docker-compose対応"
  ]
}
```

#### Dev Containers
```json
{
  "id": "ms-vscode-remote.remote-containers",
  "description": "コンテナ内での開発",
  "使い方": ".devcontainer/devcontainer.json を作成"
}
```

## ドキュメント作成

#### Markdown All in One
```json
{
  "id": "yzhang.markdown-all-in-one",
  "description": "Markdown執筆支援",
  "主な機能": [
    "TOC自動生成",
    "ショートカット",
    "プレビュー強化",
    "数式サポート"
  ]
}
```

#### Draw.io Integration
```json
{
  "id": "hediet.vscode-drawio",
  "description": "図表作成",
  "使い方": ".drawio ファイルを作成"
}
```

#### Mermaid Preview
```json
{
  "id": "vstirbu.vscode-mermaid-preview",
  "description": "Mermaidダイアグラムのプレビュー"
}
```

## 生産性向上

### ナビゲーション

#### Bookmarks
```json
{
  "id": "alefragnani.Bookmarks",
  "description": "コードブックマーク",
  "ショートカット": {
    "ブックマーク追加/削除": "Ctrl+Alt+K",
    "次のブックマーク": "Ctrl+Alt+L"
  }
}
```

#### TODO Highlight
```json
{
  "id": "wayou.vscode-todo-highlight",
  "description": "TODO/FIXMEハイライト",
  "設定例": {
    "todohighlight.keywords": [
      "TODO:",
      "FIXME:",
      "HACK:",
      "NOTE:",
      "WARNING:"
    ]
  }
}
```

### コード補完

#### Path Intellisense
```json
{
  "id": "christian-kohler.path-intellisense",
  "description": "ファイルパス自動補完"
}
```

#### Auto Rename Tag
```json
{
  "id": "formulahendry.auto-rename-tag",
  "description": "HTMLタグの自動リネーム"
}
```

## セキュリティ

#### GitLab Workflow
```json
{
  "id": "GitLab.gitlab-workflow",
  "description": "GitLab統合（セキュリティスキャン含む）"
}
```

#### Snyk Security
```json
{
  "id": "snyk-security.snyk-vulnerability-scanner",
  "description": "脆弱性スキャン"
}
```

## リモート開発

#### Remote - SSH
```json
{
  "id": "ms-vscode-remote.remote-ssh",
  "description": "SSH経由でリモート開発"
}
```

#### Live Share
```json
{
  "id": "MS-vsliveshare.vsliveshare",
  "description": "リアルタイムコラボレーション"
}
```

## 推奨設定ファイル

### .vscode/extensions.json
```json
{
  "recommendations": [
    // Git/GitHub
    "eamodio.gitlens",
    "GitHub.vscode-pull-request-github",
    "GitHub.copilot",
    
    // Python/ML
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-toolsai.jupyter",
    
    // 品質
    "ms-python.black-formatter",
    "charliermarsh.ruff",
    
    // 生産性
    "alefragnani.Bookmarks",
    "wayou.vscode-todo-highlight",
    
    // Docker
    "ms-azuretools.vscode-docker",
    "ms-vscode-remote.remote-containers"
  ]
}
```

### .vscode/settings.json（プロジェクト設定）
```json
{
  // Python
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black",
  "python.testing.pytestEnabled": true,
  "python.testing.unittestEnabled": false,
  
  // Jupyter
  "jupyter.askForKernelRestart": false,
  "jupyter.interactiveWindow.textEditor.executeSelection": true,
  
  // Git
  "git.autofetch": true,
  "git.confirmSync": false,
  "git.enableSmartCommit": true,
  
  // エディタ
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  
  // ファイル
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true,
    "**/.pytest_cache": true,
    "**/.ipynb_checkpoints": true
  },
  
  // 拡張機能別設定
  "gitlens.hovers.currentLine.over": "line",
  "python.analysis.typeCheckingMode": "basic",
  "jupyter.widgetScriptSources": ["jsdelivr.com", "unpkg.com"]
}
```

## ML開発向けワークスペース設定

### ml-project.code-workspace
```json
{
  "folders": [
    {
      "path": ".",
      "name": "ML Project"
    }
  ],
  "settings": {
    // Python環境
    "python.defaultInterpreterPath": "${workspaceFolder}/venv/bin/python",
    
    // Jupyter
    "jupyter.notebookFileRoot": "${workspaceFolder}",
    
    // ターミナル
    "terminal.integrated.env.linux": {
      "PYTHONPATH": "${workspaceFolder}/src"
    },
    
    // 検索除外
    "search.exclude": {
      "**/data": true,
      "**/models/*.pth": true,
      "**/logs": true
    }
  },
  "extensions": {
    "recommendations": [
      "ms-python.python",
      "ms-toolsai.jupyter",
      "GitHub.copilot"
    ]
  },
  "launch": {
    "version": "0.2.0",
    "configurations": [
      {
        "name": "Python: Current File",
        "type": "python",
        "request": "launch",
        "program": "${file}",
        "console": "integratedTerminal",
        "env": {
          "PYTHONPATH": "${workspaceFolder}/src"
        }
      },
      {
        "name": "Python: Train Model",
        "type": "python",
        "request": "launch",
        "program": "${workspaceFolder}/src/train.py",
        "args": ["--config", "configs/default.yaml"],
        "console": "integratedTerminal"
      }
    ]
  }
}
```

## インストールスクリプト

### install_extensions.sh
```bash
#!/bin/bash
# VS Code拡張機能一括インストール

extensions=(
  # Git/GitHub
  "eamodio.gitlens"
  "GitHub.vscode-pull-request-github"
  "GitHub.copilot"
  "mhutchie.git-graph"
  
  # Python/ML
  "ms-python.python"
  "ms-python.vscode-pylance"
  "ms-toolsai.jupyter"
  "ms-python.black-formatter"
  
  # 生産性
  "alefragnani.Bookmarks"
  "wayou.vscode-todo-highlight"
  "christian-kohler.path-intellisense"
  
  # Docker/Remote
  "ms-azuretools.vscode-docker"
  "ms-vscode-remote.remote-containers"
  "ms-vscode-remote.remote-ssh"
)

for extension in "${extensions[@]}"
do
  code --install-extension "$extension"
done

echo "✅ All extensions installed!"
```

これらの拡張機能を組み合わせることで、GitHub と連携した効率的な ML 開発環境を構築できます。プロジェクトの要件に応じて必要な拡張機能を選択してください。

{% include navigation.html %}