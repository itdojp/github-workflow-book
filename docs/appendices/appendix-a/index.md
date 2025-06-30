# 付録A：GitHub用語集

{% include navigation.html %}

## 基本用語

### Repository（リポジトリ）
プロジェクトのファイルと変更履歴を保存する場所。プロジェクトの基本単位。

### Clone（クローン）
リモートリポジトリをローカルマシンにコピーすること。
```bash
git clone https://github.com/username/repository.git
```

### Fork（フォーク）
他のユーザーのリポジトリを自分のアカウントにコピーすること。オープンソース貢献の第一歩。

### Branch（ブランチ）
開発の独立したライン。メインコードに影響を与えずに機能開発や実験が可能。

### Commit（コミット）
ファイルの変更を記録したスナップショット。各コミットには一意のSHA-1ハッシュが付与される。

### Push（プッシュ）
ローカルの変更をリモートリポジトリに送信すること。

### Pull（プル）
リモートリポジトリの変更をローカルに取り込むこと。

### Merge（マージ）
異なるブランチの変更を統合すること。

### Pull Request（PR）
変更をマージしてもらうためのリクエスト。コードレビューとディスカッションの場。

### Issue（イシュー）
バグ報告、機能要望、タスクなどを管理するためのトラッカー。

## GitHub固有の用語

### Gist
コードスニペットを共有するためのサービス。単一ファイルや小さなプロジェクトに最適。

### GitHub Actions
CI/CDワークフローを自動化するためのプラットフォーム。

### GitHub Pages
静的ウェブサイトをホスティングするサービス。

### GitHub Packages
パッケージをホスティングするためのレジストリサービス。

### Dependabot
依存関係の更新を自動化するボット。

### Codespaces
クラウドベースの開発環境。ブラウザやVS Codeから直接コーディング可能。

### Copilot
AIペアプログラマー。コードの提案と自動補完を提供。

## 権限関連

### Collaborator（コラボレーター）
リポジトリへの書き込み権限を持つユーザー。

### Contributor（コントリビューター）
プロジェクトに貢献したユーザー。必ずしも書き込み権限は持たない。

### Maintainer（メンテナー）
プロジェクトの管理責任を持つユーザー。

### Owner（オーナー）
リポジトリまたは組織の完全な管理権限を持つユーザー。

### Team（チーム）
組織内でグループ化されたユーザーの集まり。権限を一括管理できる。

## ワークフロー用語

### CI/CD
Continuous Integration（継続的インテグレーション）とContinuous Deployment（継続的デプロイメント）。

### Workflow（ワークフロー）
GitHub Actionsで定義される自動化されたプロセス。

### Job（ジョブ）
ワークフロー内の独立した実行単位。

### Step（ステップ）
ジョブ内の個別のタスク。

### Runner（ランナー）
ワークフローを実行する仮想マシンまたは物理マシン。

### Artifact（アーティファクト）
ワークフロー実行中に生成され、保存されるファイル。

## Git操作用語

### Stage（ステージ）
コミットする前の変更を準備する領域。
```bash
git add file.txt  # ステージングエリアに追加
```

### Stash（スタッシュ）
作業中の変更を一時的に保存すること。
```bash
git stash  # 変更を退避
git stash pop  # 変更を復元
```

### Rebase（リベース）
コミット履歴を整理し直すこと。
```bash
git rebase main  # mainブランチの最新状態を基準に履歴を再構築
```

### Cherry-pick（チェリーピック）
特定のコミットを別のブランチに適用すること。
```bash
git cherry-pick abc123  # コミットabc123を現在のブランチに適用
```

### Squash（スカッシュ）
複数のコミットを1つにまとめること。

### Fast-forward（ファストフォワード）
マージコミットを作らずにブランチポインタを進めるマージ方式。

## セキュリティ用語

### Secret（シークレット）
APIキーやパスワードなどの機密情報。環境変数として安全に管理。

### CODEOWNERS
特定のファイルやディレクトリの責任者を定義するファイル。

### Protected Branch（保護ブランチ）
直接プッシュを制限し、PRとレビューを必須とするブランチ。

### Signed Commit（署名付きコミット）
GPGキーで署名されたコミット。作者の真正性を保証。

### Security Advisory（セキュリティアドバイザリ）
脆弱性情報の管理と公開のための機能。

## 組織関連用語

### Organization（組織）
複数のユーザーとリポジトリを管理するためのアカウント。

### Member（メンバー）
組織に所属するユーザー。

### Outside Collaborator（外部コラボレーター）
組織のメンバーではないが、特定のリポジトリへのアクセス権を持つユーザー。

### Billing Manager（課金管理者）
組織の課金情報を管理する権限を持つユーザー。

### Base Permission（ベース権限）
組織のすべてのメンバーに付与されるデフォルトの権限レベル。

## ML/AI開発特有の用語

### Model Card（モデルカード）
機械学習モデルのドキュメント。性能、制限、倫理的配慮などを記載。

### Experiment Tracking（実験追跡）
機械学習実験の結果とパラメータを記録・管理すること。

### Data Version Control（DVC）
大規模なデータセットとモデルファイルのバージョン管理。

### LFS（Large File Storage）
大きなファイルを効率的に管理するためのGit拡張。

### Pipeline（パイプライン）
データ処理、モデル訓練、評価などの一連のプロセス。

## コミュニケーション用語

### Mention（メンション）
`@username`でユーザーに通知を送ること。

### Review Request（レビューリクエスト）
特定のユーザーにコードレビューを依頼すること。

### Discussion（ディスカッション）
リポジトリ内でのフォーラム形式の議論。

### Comment（コメント）
Issue、PR、コミットに対するフィードバック。

### Reaction（リアクション）
絵文字による簡易的な反応（👍、❤️、🎉など）。

## ステータス用語

### Open（オープン）
Issue やPRが未解決・未マージの状態。

### Closed（クローズド）
Issue が解決済み、またはPRがマージ/却下された状態。

### Draft（ドラフト）
作業中のPR。レビューの準備ができていない状態。

### Stale（ステイル）
長期間更新されていないIssueやPR。

### Locked（ロック）
新しいコメントを受け付けない状態。

## その他の重要用語

### README
プロジェクトの説明、使用方法、貢献方法などを記載するファイル。

### License（ライセンス）
プロジェクトの使用条件を定義する法的文書。

### .gitignore
Gitで追跡しないファイルやディレクトリを指定するファイル。

### Webhook
特定のイベントが発生したときに外部サービスに通知を送る仕組み。

### API
プログラムからGitHubを操作するためのインターフェース。REST APIとGraphQL APIがある。

### Markdown
GitHubで広く使用される軽量マークアップ言語。

### SHA/Hash
コミットを一意に識別する40文字の16進数文字列。

### HEAD
現在チェックアウトしているブランチの最新コミットを指すポインタ。

### Origin
クローン元のリモートリポジトリのデフォルト名。

### Upstream
フォーク元のオリジナルリポジトリ。

---

## 略語一覧

- **API**: Application Programming Interface
- **CI/CD**: Continuous Integration/Continuous Deployment
- **CLA**: Contributor License Agreement
- **CLI**: Command Line Interface
- **CODEOWNERS**: Code Owners
- **DVC**: Data Version Control
- **ECCN**: Export Control Classification Number
- **GDPR**: General Data Protection Regulation
- **GPG**: GNU Privacy Guard
- **LFS**: Large File Storage
- **ML**: Machine Learning
- **PR**: Pull Request
- **SAML**: Security Assertion Markup Language
- **SHA**: Secure Hash Algorithm
- **SSH**: Secure Shell
- **SSO**: Single Sign-On
- **TFA/2FA**: Two-Factor Authentication
- **UI**: User Interface
- **URL**: Uniform Resource Locator
- **YAML**: YAML Ain't Markup Language

{% include navigation.html %}