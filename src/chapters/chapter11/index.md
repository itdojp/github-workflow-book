# 第11章：セキュリティ実践

## 11.1 AI協働時代のSecrets管理

### AI生成コードを考慮したSecrets管理

AIが誤って機密情報を生成するリスクを踏まえ、第2章の品質ゲートと連携した管理が必要です。

#### AI対応を含むSecretsの階層
```yaml
secrets_hierarchy:
  # Organization secrets
  organization:
    scope: "All repositories in organization"
    examples:
      - DOCKERHUB_TOKEN
      - NPM_AUTH_TOKEN
      - SONAR_TOKEN
      - GITHUB_COPILOT_API_TOKEN  # Copilot API利用時のトークン（Enterprise設定の自動化用）
    ai_safety:
      - scan_for_hardcoded: true
      - ai_generation_block: true
    
  # Repository secrets  
  repository:
    scope: "Specific repository only"
    examples:
      - DATABASE_URL
      - API_KEY
      - DEPLOYMENT_KEY
    ai_protection:
      - pattern_detection: enabled
      - placeholder_check: true  # AIが生成しやすいプレースホルダー検出
      
  # Environment secrets
  environment:
    scope: "Specific environment in repository"
    examples:
      - PROD_DATABASE_URL
      - STAGING_API_KEY
      - DEV_CREDENTIALS
    ai_restrictions:
      - production:
          ai_access: "read-only"  # 本番環境はAIアクセス制限
      - development:
          ai_access: "full"  # 開発環境はAI支援許可
```

**注意：GitHub Copilot APIトークンについて**

`GITHUB_COPILOT_API_TOKEN`は、GitHub Copilot Enterprise環境でAPI経由での設定自動化や使用状況監視を行う場合に必要となるトークンです。一般的なCopilotの利用では不要ですが、大規模組織でのCopilot設定の一括管理や、使用統計の自動収集を行う際に使用されます。

### Secretsの作成と管理

#### GitHub CLIを使用した一括設定
```bash
#!/bin/bash
# set_secrets.sh

# Organization secrets
gh secret set DOCKERHUB_TOKEN --org ai-research-lab < ~/.docker/token
gh secret set NPM_AUTH_TOKEN --org ai-research-lab < ~/.npm/token

# Repository secrets
gh secret set DATABASE_URL --repo ai-research-lab/ml-platform < .env.production
gh secret set AWS_ACCESS_KEY_ID --repo ai-research-lab/ml-platform

# Environment secrets
gh secret set PROD_DATABASE_URL \
  --repo ai-research-lab/ml-platform \
  --env production < .env.production
```

#### プログラムによるSecrets管理
```python
# secrets_manager.py
import base64
from nacl import encoding, public

class SecretsManager:
    def __init__(self, github_client):
        self.github = github_client
    
    def encrypt_secret(self, public_key, secret_value):
        """GitHub用にシークレットを暗号化"""
        public_key_obj = public.PublicKey(
            public_key.encode("utf-8"), 
            encoding.Base64Encoder()
        )
        sealed_box = public.SealedBox(public_key_obj)
        encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
        
        return base64.b64encode(encrypted).decode("utf-8")
    
    def set_repository_secret(self, repo_name, secret_name, secret_value):
        """リポジトリシークレットを設定"""
        repo = self.github.get_repo(repo_name)
        
        # 公開鍵を取得
        public_key = repo.get_public_key()
        
        # 暗号化
        encrypted_value = self.encrypt_secret(
            public_key.key, 
            secret_value
        )
        
        # シークレットを作成/更新
        repo.create_secret(
            secret_name,
            encrypted_value,
            public_key.key_id
        )
    
    def rotate_secrets(self, repo_name, secret_mapping):
        """シークレットのローテーション"""
        repo = self.github.get_repo(repo_name)
        
        rotation_log = []
        
        for secret_name, new_value in secret_mapping.items():
            try:
                # 新しい値を設定
                self.set_repository_secret(repo_name, secret_name, new_value)
                
                rotation_log.append({
                    'secret': secret_name,
                    'status': 'rotated',
                    'timestamp': datetime.now().isoformat()
                })
                
                # 通知
                self.notify_secret_rotation(repo_name, secret_name)
                
            except Exception as e:
                rotation_log.append({
                    'secret': secret_name,
                    'status': 'failed',
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                })
        
        return rotation_log
```

### Secretsの使用パターン

#### AI生成コードセキュリティチェックを含むワークフロー
```yaml
name: Deploy to Production with AI Security

on:
  push:
    branches: [main]

jobs:
  # 第2章の品質ゲートにAIセキュリティチェックを追加
  ai-security-check:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: AI Placeholder Detection
      run: |
        python scripts/ai_security_checker.py --check-placeholders
        
    - name: AI Hardcoded Secrets Scan
      run: |
        python scripts/ai_security_checker.py --check-secrets
        
    - name: AI Code Pattern Analysis
      run: |
        # AI生成コードの脆弱性パターンをチェック
        python scripts/ai_vulnerability_scanner.py

  deploy:
    needs: ai-security-check
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Login to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}
    
    - name: Deploy application
      env:
        DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
        API_KEY: ${{ secrets.PROD_API_KEY }}
      run: |
        # Secretsは環境変数として利用可能
        ./deploy.sh
```

## 10.2 Environment設定と環境変数

### Environment（環境）の設計

#### 環境の定義
```yaml
environments:
  development:
    protection_rules: false
    secrets:
      - DEV_DATABASE_URL
      - DEV_API_KEY
    variables:
      - LOG_LEVEL: "debug"
      - FEATURE_FLAGS: "all"
      
  staging:
    protection_rules:
      required_reviewers: ["qa-team"]
      wait_timer: 0
    secrets:
      - STAGING_DATABASE_URL
      - STAGING_API_KEY
    variables:
      - LOG_LEVEL: "info"
      - FEATURE_FLAGS: "stable"
      
  production:
    protection_rules:
      required_reviewers: ["ops-team", "security-team"]
      wait_timer: 30  # 30分の待機時間
    secrets:
      - PROD_DATABASE_URL
      - PROD_API_KEY
    variables:
      - LOG_LEVEL: "warning"
      - FEATURE_FLAGS: "production"
```

### 環境保護ルール

#### Protection Rules設定
```python
# environment_manager.py
class EnvironmentManager:
    def __init__(self, repo):
        self.repo = repo
    
    def create_environment(self, env_name, protection_rules=None):
        """環境を作成して保護ルールを設定"""
        # GitHub APIを使用して環境を作成
        url = f"{self.repo.url}/environments/{env_name}"
        
        data = {
            "wait_timer": protection_rules.get("wait_timer", 0),
            "reviewers": [
                {"type": "User", "id": user_id} 
                for user_id in protection_rules.get("required_reviewers", [])
            ],
            "deployment_branch_policy": {
                "protected_branches": protection_rules.get("protected_branches", True),
                "custom_branch_policies": protection_rules.get("branch_patterns", False)
            }
        }
        
        response = requests.put(url, json=data, headers=self.headers)
        return response.json()
    
    def set_environment_secrets(self, env_name, secrets):
        """環境固有のシークレットを設定"""
        for secret_name, secret_value in secrets.items():
            self.set_environment_secret(
                env_name, 
                secret_name, 
                secret_value
            )
    
    def deploy_with_approval(self, env_name, deployment_data):
        """承認付きデプロイメント"""
        # デプロイメントを作成
        deployment = self.repo.create_deployment(
            ref=deployment_data['ref'],
            environment=env_name,
            required_contexts=[],
            payload=deployment_data.get('payload', {})
        )
        
        # 承認待ち
        if self.requires_approval(env_name):
            print(f"Waiting for approval for {env_name} deployment...")
            # 承認プロセス
            
        return deployment
```

### 環境変数のベストプラクティス

#### 設定ファイルテンプレート
```python
# config_template.py
import os
from typing import Dict, Any

class ConfigTemplate:
    """環境別設定テンプレート"""
    
    @staticmethod
    def get_config(environment: str) -> Dict[str, Any]:
        base_config = {
            'app_name': 'ml-platform',
            'version': '1.0.0',
            'features': {
                'ml_monitoring': True,
                'auto_scaling': False,
                'debug_mode': False
            }
        }
        
        env_configs = {
            'development': {
                'database_url': os.getenv('DEV_DATABASE_URL'),
                'api_endpoint': 'https://dev-api.example.com',
                'log_level': 'DEBUG',
                'features': {
                    'ml_monitoring': True,
                    'auto_scaling': False,
                    'debug_mode': True
                }
            },
            'staging': {
                'database_url': os.getenv('STAGING_DATABASE_URL'),
                'api_endpoint': 'https://staging-api.example.com',
                'log_level': 'INFO',
                'features': {
                    'ml_monitoring': True,
                    'auto_scaling': True,
                    'debug_mode': False
                }
            },
            'production': {
                'database_url': os.getenv('PROD_DATABASE_URL'),
                'api_endpoint': 'https://api.example.com',
                'log_level': 'WARNING',
                'features': {
                    'ml_monitoring': True,
                    'auto_scaling': True,
                    'debug_mode': False
                }
            }
        }
        
        # ベース設定と環境固有設定をマージ
        config = base_config.copy()
        config.update(env_configs.get(environment, {}))
        
        return config
    
    @staticmethod
    def validate_config(config: Dict[str, Any]) -> bool:
        """設定の妥当性を検証"""
        required_keys = ['database_url', 'api_endpoint', 'log_level']
        
        for key in required_keys:
            if key not in config or not config[key]:
                raise ValueError(f"Missing required config: {key}")
        
        return True
```

## 10.3 Dependabotによる脆弱性対策

### Dependabot設定の最適化

#### 包括的な設定例
`.github/dependabot.yml`:
```yaml
version: 2
updates:
  # Python dependencies
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "daily"
      time: "09:00"
      timezone: "Asia/Tokyo"
    open-pull-requests-limit: 10
    
    # バージョニング戦略
    versioning-strategy: "increase-if-necessary"
    
    # レビュアーとラベル
    reviewers:
      - "security-team"
      - "ml-team"
    labels:
      - "dependencies"
      - "security"
      
    # コミットメッセージ
    commit-message:
      prefix: "chore"
      prefix-development: "chore"
      include: "scope"
      
    # 特定の依存関係を無視
    ignore:
      - dependency-name: "tensorflow"
        versions: ["2.x"]  # TF 1.xを使い続ける
        
    # セキュリティアップデートのみ
    allow:
      - dependency-type: "direct"
      - dependency-type: "indirect"
        
    # グループ化
    groups:
      ml-dependencies:
        patterns:
          - "torch*"
          - "tensorflow*"
          - "scikit-learn"
        
  # Docker dependencies
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    reviewers:
      - "devops-team"
      
  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    commit-message:
      prefix: "ci"
```

### 脆弱性対応の自動化

#### 自動マージ設定
```yaml
name: Auto-merge Dependabot PRs

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Metadata
      id: metadata
      uses: dependabot/fetch-metadata@v1
      with:
        github-token: "${{ secrets.GITHUB_TOKEN }}"
        
    - name: Auto-merge for patch and minor updates
      if: |
        steps.metadata.outputs.update-type == 'version-update:semver-patch' ||
        steps.metadata.outputs.update-type == 'version-update:semver-minor'
      run: gh pr merge --auto --merge "$PR_URL"
      env:
        PR_URL: ${{ github.event.pull_request.html_url }}
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Approve PR
      if: |
        steps.metadata.outputs.update-type == 'version-update:semver-patch' ||
        steps.metadata.outputs.update-type == 'version-update:semver-minor'
      run: gh pr review --approve "$PR_URL"
      env:
        PR_URL: ${{ github.event.pull_request.html_url }}
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 脆弱性レポートの生成

#### カスタムレポートツール
```python
# vulnerability_reporter.py
import json
from datetime import datetime
from typing import List, Dict

class VulnerabilityReporter:
    def __init__(self, github_client):
        self.github = github_client
        
    def get_vulnerability_alerts(self, repo_name):
        """脆弱性アラートを取得"""
        repo = self.github.get_repo(repo_name)
        
        query = """
        query($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            vulnerabilityAlerts(first: 100) {
              nodes {
                createdAt
                dismissedAt
                securityVulnerability {
                  package {
                    name
                    ecosystem
                  }
                  severity
                  advisory {
                    summary
                    description
                    cvss {
                      score
                    }
                  }
                }
              }
            }
          }
        }
        """
        
        # GraphQL APIを使用
        import requests
        
        headers = {
            'Authorization': f'token {self.github._Github__requester._Requester__authorizationHeader.split()[1]}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'query': query,
            'variables': {"owner": repo.owner.login, "name": repo.name}
        }
        
        response = requests.post(
            'https://api.github.com/graphql',
            headers=headers,
            json=data
        )
        result = response.json()
        
        return result['data']['repository']['vulnerabilityAlerts']['nodes']
    
    def generate_report(self, repos: List[str]) -> Dict:
        """複数リポジトリの脆弱性レポート生成"""
        report = {
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_vulnerabilities': 0,
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0
            },
            'by_repository': {},
            'by_package': {}
        }
        
        for repo_name in repos:
            alerts = self.get_vulnerability_alerts(repo_name)
            active_alerts = [a for a in alerts if not a['dismissedAt']]
            
            repo_summary = {
                'total': len(active_alerts),
                'by_severity': {},
                'vulnerabilities': []
            }
            
            for alert in active_alerts:
                vuln = alert['securityVulnerability']
                severity = vuln['severity']
                package_name = vuln['package']['name']
                
                # サマリー更新
                report['summary']['total_vulnerabilities'] += 1
                report['summary'][severity.lower()] += 1
                
                # リポジトリ別
                repo_summary['by_severity'][severity] = \
                    repo_summary['by_severity'].get(severity, 0) + 1
                
                repo_summary['vulnerabilities'].append({
                    'package': package_name,
                    'severity': severity,
                    'summary': vuln['advisory']['summary'],
                    'cvss_score': vuln['advisory']['cvss']['score']
                })
                
                # パッケージ別
                if package_name not in report['by_package']:
                    report['by_package'][package_name] = {
                        'affected_repos': [],
                        'severity': severity
                    }
                report['by_package'][package_name]['affected_repos'].append(repo_name)
            
            report['by_repository'][repo_name] = repo_summary
        
        return report
    
    def prioritize_fixes(self, report: Dict) -> List[Dict]:
        """修正の優先順位付け"""
        priorities = []
        
        for package, info in report['by_package'].items():
            score = 0
            
            # 深刻度によるスコア
            severity_scores = {
                'CRITICAL': 40,
                'HIGH': 30,
                'MEDIUM': 20,
                'LOW': 10
            }
            score += severity_scores.get(info['severity'], 0)
            
            # 影響範囲によるスコア
            score += len(info['affected_repos']) * 5
            
            priorities.append({
                'package': package,
                'priority_score': score,
                'severity': info['severity'],
                'affected_repos': info['affected_repos']
            })
        
        # スコアの高い順にソート
        priorities.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return priorities
```

## 10.4 Security Policyの設定

### セキュリティポリシーファイル

#### SECURITY.md の作成
```markdown
# Security Policy

## Supported Versions

現在サポートされているバージョン：

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

### 報告方法

セキュリティ脆弱性を発見した場合は、以下の手順で報告してください：

1. **公開しない**: GitHub Issuesやその他の公開チャンネルで報告しないでください
2. **プライベート報告**: security@example.com にメールを送信
3. **暗号化**: 可能であればPGP暗号化を使用（公開鍵: [link]）

### 報告に含めるべき情報

- 脆弱性の詳細な説明
- 再現手順
- 影響範囲
- 可能であれば修正案

### 対応プロセス

1. **受領確認**: 48時間以内に受領確認をお送りします
2. **初期評価**: 1週間以内に深刻度を評価し、対応計画をお知らせします
3. **修正**: 深刻度に応じて以下のタイムラインで対応します：
   - Critical: 48時間以内
   - High: 1週間以内
   - Medium: 2週間以内
   - Low: 次回リリース時

### 報奨金プログラム

有効な脆弱性報告には、深刻度に応じて報奨金を提供しています：

- Critical: $1,000 - $5,000
- High: $500 - $1,000
- Medium: $100 - $500
- Low: クレジット表記

### 除外事項

以下は脆弱性報告の対象外です：

- DoS攻撃
- ソーシャルエンジニアリング
- 物理的な攻撃
- サービスの乱用

## Security Advisories

過去のセキュリティアドバイザリは[こちら](/security/advisories)で確認できます。

## Contact

- セキュリティチーム: security@example.com
- PGP公開鍵: [0xABCDEF12](https://keys.example.com)
```

### セキュリティスキャンの統合

#### 複数スキャナーの統合
```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # 毎週日曜日

jobs:
  security-scan:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    # 1. CodeQL
    - name: Initialize CodeQL
      uses: github/codeql-action/init@v4
      with:
        languages: 'python, javascript'
        
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v4
      
    # 2. Trivy (コンテナスキャン)
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@0.33.1
      with:
        image-ref: 'myapp:${{ github.sha }}'
        format: 'sarif'
        output: 'trivy-results.sarif'
        
    - name: Upload Trivy results
      uses: github/codeql-action/upload-sarif@v4
      with:
        sarif_file: 'trivy-results.sarif'
        
    # 3. Snyk
    - name: Run Snyk to check for vulnerabilities
      uses: snyk/actions/python@v1.0.0
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high
        
    # 4. OWASP Dependency Check
    - name: Run OWASP Dependency Check
      uses: jeremylong/dependency-check-action@main
      with:
        project: 'ml-platform'
        path: '.'
        format: 'ALL'
        
    # 5. カスタムセキュリティチェック
    - name: Run custom security checks
      run: |
        python scripts/security_check.py
        bash scripts/secret_scan.sh
```

## 10.5 セキュリティインシデント対応

### インシデント対応プレイブック

#### 対応フロー
```python
# incident_response.py
from enum import Enum
from datetime import datetime
import asyncio

class IncidentSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class IncidentResponse:
    def __init__(self):
        self.response_times = {
            IncidentSeverity.CRITICAL: 30,    # 30分
            IncidentSeverity.HIGH: 120,       # 2時間
            IncidentSeverity.MEDIUM: 480,     # 8時間
            IncidentSeverity.LOW: 1440        # 24時間
        }
    
    async def handle_incident(self, incident):
        """インシデント対応のオーケストレーション"""
        # 1. インシデントの記録
        incident_id = self.log_incident(incident)
        
        # 2. 深刻度の評価
        severity = self.assess_severity(incident)
        
        # 3. 通知
        await self.notify_stakeholders(incident_id, severity)
        
        # 4. 初期対応
        if severity in [IncidentSeverity.CRITICAL, IncidentSeverity.HIGH]:
            await self.immediate_containment(incident)
        
        # 5. 調査
        investigation = await self.investigate(incident)
        
        # 6. 修復
        await self.remediate(incident, investigation)
        
        # 7. 事後分析
        await self.post_mortem(incident_id)
        
        return incident_id
    
    def assess_severity(self, incident):
        """インシデントの深刻度を評価"""
        severity_factors = {
            'data_breach': IncidentSeverity.CRITICAL,
            'unauthorized_access': IncidentSeverity.HIGH,
            'malware_detection': IncidentSeverity.HIGH,
            'policy_violation': IncidentSeverity.MEDIUM,
            'suspicious_activity': IncidentSeverity.LOW
        }
        
        return severity_factors.get(
            incident['type'], 
            IncidentSeverity.MEDIUM
        )
    
    async def immediate_containment(self, incident):
        """即座の封じ込め措置"""
        actions = []
        
        if incident['type'] == 'unauthorized_access':
            # アクセストークンの無効化
            actions.append(self.revoke_tokens(incident['user']))
            
            # リポジトリへのアクセス制限
            actions.append(self.restrict_access(incident['repositories']))
            
        elif incident['type'] == 'data_breach':
            # 影響を受けたシークレットのローテーション
            actions.append(self.rotate_secrets(incident['compromised_secrets']))
            
            # 監査ログの保全
            actions.append(self.preserve_audit_logs())
            
        await asyncio.gather(*actions)
    
    def generate_incident_report(self, incident_id):
        """インシデントレポートの生成"""
        incident = self.get_incident(incident_id)
        
        report = f"""
# Security Incident Report

## Incident ID: {incident_id}

### Summary
- **Date/Time**: {incident['timestamp']}
- **Type**: {incident['type']}
- **Severity**: {incident['severity']}
- **Status**: {incident['status']}

### Timeline
{self.format_timeline(incident['timeline'])}

### Impact Assessment
- **Affected Systems**: {incident['affected_systems']}
- **Data Exposure**: {incident['data_exposure']}
- **User Impact**: {incident['user_impact']}

### Response Actions
{self.format_actions(incident['response_actions'])}

### Root Cause Analysis
{incident['root_cause']}

### Lessons Learned
{incident['lessons_learned']}

### Recommendations
{self.format_recommendations(incident['recommendations'])}
"""
        return report
```

### 自動化されたインシデント検知

#### リアルタイム監視
```python
# security_monitor.py
class SecurityMonitor:
    def __init__(self):
        self.alert_threshold = {
            'failed_logins': 5,
            'api_rate_limit': 1000,
            'suspicious_downloads': 10
        }
    
    async def monitor_events(self):
        """セキュリティイベントの監視"""
        while True:
            events = await self.fetch_recent_events()
            
            for event in events:
                if self.is_suspicious(event):
                    await self.trigger_alert(event)
            
            await asyncio.sleep(60)  # 1分ごとにチェック
    
    def is_suspicious(self, event):
        """疑わしいイベントの検出"""
        suspicious_patterns = [
            # 大量のリポジトリダウンロード
            lambda e: e['action'] == 'repo.download' and 
                     e['count'] > self.alert_threshold['suspicious_downloads'],
            
            # 短時間での複数の認証失敗
            lambda e: e['action'] == 'auth.failed' and
                     e['count'] > self.alert_threshold['failed_logins'],
            
            # 異常なAPI使用
            lambda e: e['action'] == 'api.call' and
                     e['rate'] > self.alert_threshold['api_rate_limit'],
            
            # 不審な時間帯のアクセス
            lambda e: e['hour'] < 6 or e['hour'] > 22,
            
            # 不審な地域からのアクセス
            lambda e: e['country'] not in ['JP', 'US', 'GB']
        ]
        
        return any(pattern(event) for pattern in suspicious_patterns)
```

## まとめ

本章では、GitHubでのセキュリティ実践について学習しました：
- Secrets管理で機密情報を安全に保管
- Environment設定で環境別のセキュリティ制御
- Dependabotで脆弱性を自動検出・修正
- Security Policyで脆弱性報告プロセスを確立
- インシデント対応プレイブックで迅速な対応

次章では、実践的なワークフロー設計について学習します。

## 確認事項

- [ ] Secretsを安全に管理している
- [ ] 環境別のアクセス制御を設定している
- [ ] Dependabotが有効で適切に設定されている
- [ ] Security Policyを作成・公開している
- [ ] インシデント対応プロセスが確立されている
