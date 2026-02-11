---
layout: book
title: "付録C：料金プランと機能比較表"
---

# 付録C：料金プランと機能比較表

## GitHub プラン比較（2025年版）

### 個人向けプラン

| 機能 | Free | Pro |
|------|------|-----|
| **料金** | $0/月 | $4/月 |
| **パブリックリポジトリ** | 無制限 | 無制限 |
| **プライベートリポジトリ** | 無制限 | 無制限 |
| **コラボレーター** | 無制限 | 無制限 |
| **GitHub Actions（パブリック）** | 無制限 | 無制限 |
| **GitHub Actions（プライベート）** | 2,000分/月 | 3,000分/月 |
| **ストレージ** | 500MB | 2GB |
| **GitHub Pages** | ✓ | ✓ |
| **Issue・Project** | ✓ | ✓ |
| **Protected branches** | パブリックのみ | ✓ |
| **Code owners** | パブリックのみ | ✓ |
| **Draft PR** | パブリックのみ | ✓ |
| **Multiple PR reviewers** | パブリックのみ | ✓ |
| **Wiki** | パブリックのみ | ✓ |
| **GitHub Support** | Community | Email |

### チーム・組織向けプラン

| 機能 | Free (Organization) | Team | Enterprise |
|------|---------------------|------|------------|
| **料金** | $0/月 | $4/ユーザー/月 | $21/ユーザー/月 |
| **最小ユーザー数** | - | - | - |
| **プライベートリポジトリ** | 無制限 | 無制限 | 無制限 |
| **GitHub Actions（プライベート）** | 2,000分/月 | 3,000分/月 | 50,000分/月 |
| **ストレージ** | 500MB | 2GB | 50GB |
| **Protected branches** | パブリックのみ | ✓ | ✓ |
| **Required reviewers** | - | ✓ | ✓ |
| **Code owners** | パブリックのみ | ✓ | ✓ |
| **SAML SSO** | - | - | ✓ |
| **Advanced Security** | - | - | ✓ |
| **Audit log** | - | - | ✓ |
| **LDAP/AD sync** | - | - | ✓ |
| **GitHub Connect** | - | - | ✓ |
| **99.9% SLA** | - | - | ✓ |
| **Premium Support** | Community | Email | 24/7 |

## GitHub Actions 詳細料金

### 分単位料金（プライベートリポジトリ）

| OS | 乗数 | 実効料金 |
|----|------|----------|
| Linux | 1x | $0.008/分 |
| Windows | 2x | $0.016/分 |
| macOS | 10x | $0.08/分 |

### 月間無料枠を超えた場合の計算例

```text
例：Linuxで3,000分、Windowsで500分、macOSで100分使用
- Linux: 3,000分 × 1 = 3,000分
- Windows: 500分 × 2 = 1,000分  
- macOS: 100分 × 10 = 1,000分
- 合計: 5,000分

無料枠（Teamプラン）: 3,000分
超過分: 2,000分
追加料金: 2,000 × $0.008 = $16
```

### Self-hosted Runner
- 無料（自前のインフラコスト）
- 無制限の実行時間
- GPUなど特殊なハードウェア対応可能

## ストレージ料金

### Git LFS

| プラン | データパック | 帯域幅 | 追加料金 |
|--------|-------------|--------|----------|
| Free | 1GB | 1GB/月 | - |
| データパック | 50GB | 50GB/月 | $5/月 |

### Packages（Container Registry等）

| プラン | ストレージ | データ転送 |
|--------|------------|------------|
| Free | 500MB | 1GB/月 |
| Team | 2GB | 10GB/月 |
| Enterprise | 50GB | 100GB/月 |

超過料金：
- ストレージ: $0.25/GB/月
- データ転送: $0.50/GB

## Advanced Security 機能比較

### 含まれる機能

| 機能 | Team | Enterprise |
|------|------|------------|
| **Dependabot alerts** | ✓ | ✓ |
| **Dependabot updates** | ✓ | ✓ |
| **Secret scanning (public)** | ✓ | ✓ |
| **Secret scanning (private)** | - | ✓ |
| **Code scanning** | - | ✓ |
| **Security overview** | - | ✓ |
| **Dependency review** | - | ✓ |

### Advanced Security 追加料金
- $49/コミッター/月（Enterprise以外で利用する場合）
- アクティブコミッター数で課金

## Copilot 料金

### 個人向け
| プラン | 料金 | 機能 |
|--------|------|------|
| Individual | $10/月 | 全機能 |
| Student/OSS | 無料 | 全機能 |

### 組織向け
| プラン | 料金 | 追加機能 |
|--------|------|----------|
| Business | $19/ユーザー/月 | 組織管理、ポリシー設定 |
| Enterprise | $39/ユーザー/月 | 高度な管理、カスタマイズ |

## 他サービスとの比較

### GitHub vs GitLab

| 機能 | GitHub Free | GitLab Free | GitHub Enterprise | GitLab Ultimate |
|------|------------|-------------|-------------------|-----------------|
| **料金** | $0 | $0 | $21/ユーザー | $99/ユーザー |
| **プライベートリポジトリ** | 無制限 | 無制限 | 無制限 | 無制限 |
| **CI/CD分数** | 2,000分 | 400分 | 50,000分 | 50,000分 |
| **ストレージ** | 500MB | 5GB | 50GB | 無制限 |
| **セキュリティスキャン** | 基本 | 基本 | 高度 | 高度 |
| **Container Registry** | 500MB | 10GB | 50GB | 無制限 |

### GitHub vs Bitbucket

| 機能 | GitHub Free | Bitbucket Free | GitHub Team | Bitbucket Standard |
|------|------------|----------------|-------------|-------------------|
| **料金** | $0 | $0 | $4/ユーザー | $3/ユーザー |
| **ユーザー数制限** | 無制限 | 5人まで | 無制限 | 無制限 |
| **CI/CD分数** | 2,000分 | 50分 | 3,000分 | 2,500分 |
| **LFS** | 1GB | 1GB | 1GB | 5GB |
| **統合** | 多数 | Atlassian製品 | 多数 | Atlassian製品 |

## ML/AI開発での考慮事項

### 推奨プラン（ユースケース別）

#### 個人研究者
- **GitHub Pro** + **Copilot Individual**
- 月額: $14
- 理由: Protected branchesとCopilotで効率的な開発

#### 小規模研究チーム（5人）
- **GitHub Team** + **Advanced Security**
- 月額: $20/ユーザー + $49/アクティブコミッター
- 理由: コラボレーション機能とセキュリティ

#### 企業AI部門
- **GitHub Enterprise** + **Copilot Business**
- 月額: $40/ユーザー（$21 + $19）
- 理由: SSO、監査、高度なセキュリティ

### ストレージ最適化

```yaml
# 大規模MLプロジェクトの構成例
総容量: 100GB
├── コード: 500MB（Git）
├── ドキュメント: 1GB（Git）
├── 小規模データ: 2GB（Git LFS）
├── モデルファイル: 20GB（Git LFS + S3）
└── 大規模データセット: 76.5GB（DVC + S3）

月額コスト見積もり:
- GitHub Team: $20（5ユーザー）
- Git LFS: $5（データパック）
- S3: $23（1TB、標準）
- 合計: $48/月
```

## コスト削減のヒント

### 1. GitHub Actions最適化
```yaml
# キャッシュを活用
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}

# 不要なジョブをスキップ
if: github.event_name == 'push' || contains(github.event.pull_request.labels.*.name, 'run-ci')
```

### 2. ストレージ最適化
```bash
# Git履歴の圧縮
git gc --aggressive --prune=now

# LFSの不要ファイル削除
git lfs prune

# 外部ストレージの活用
aws s3 sync models/ s3://my-ml-models/ --storage-class INTELLIGENT_TIERING
```

### 3. ユーザー管理
- 定期的にアクセス権限をレビュー
- 非アクティブユーザーを削除
- Outside Collaboratorの活用

### 4. 無料枠の活用
- オープンソースプロジェクトは多くの機能が無料
- 学生・教員向けのGitHub Education
- GitHub Sponsorsでの収益化

## 年間契約での割引

- 年間一括払い: 約16%割引（2ヶ月分無料）
- 例: Pro $4/月 → $44/年（$48相当）

## まとめ

プロジェクトの規模と要件に応じて最適なプランを選択：

1. **個人・小規模**: Free/Proで十分
2. **チーム開発**: Teamプランでコラボレーション強化
3. **企業利用**: EnterpriseでセキュリティとコンプライアンスMadrid

定期的にプランを見直し、使用状況に応じて最適化することが重要。
