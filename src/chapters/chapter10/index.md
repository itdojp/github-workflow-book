# 第10章：組織管理とチーム運用

## 10.1 AI協働を前提としたOrganization設計

### Organizationの作成手順

#### 基本情報の設定
1. GitHub.comで「+」→「New organization」
2. プランの選択（Free/Team/Enterprise）
3. 組織情報の入力

```yaml
organization_settings:
  name: "ai-research-lab"
  display_name: "AI Research Laboratory" 
  email: "admin@ai-research-lab.org"
  description: "AI-Collaborative research and development team using CLEAR framework"
  url: "https://ai-research-lab.org"
  location: "Tokyo, Japan"
  billing_email: "billing@ai-research-lab.org"
  
  # AI協働設定（Copilot Business/Enterprise）
  copilot_settings:
    enabled: true
    plan: "business"  # business or enterprise
    
  # 本書で提唱するAI協働フレームワークを適用
  ai_collaboration_policy:
    framework: "CLEAR"  # 第2章で定義したフレームワーク
    framework_description: "Context-Learning-Explanation-Assessment-Reflection"
    templates_required: true
    metrics_tracking: enabled
    chapter2_integration: true  # 第2章のテンプレートとプロセスを使用
```

#### AI協働に最適化されたセキュリティ設定
```yaml
security_settings:
  # 二要素認証
  two_factor_authentication:
    required: true
    grace_period_days: 7
    
  # ベース権限
  base_permissions: "read"  # none, read, write, admin
  
  # AI協働権限
  ai_collaboration:
    copilot_access: "managed"  # none, all, managed
    require_ai_disclosure: true
    ai_code_review_mandatory: true
    
  # リポジトリ作成権限
  members_can_create_repositories:
    public: false
    private: true
    internal: true  # Enterprise only
    ai_template_required: true  # AI協働テンプレート必須
    
  # フォーク権限
  members_can_fork_private_repositories: false
  
  # Pages設定
  members_can_create_pages:
    public: false
    private: true
    
  # AIメトリクス
  ai_metrics:
    track_usage: true
    weekly_reports: true
    share_best_practices: true
```

### 組織プロファイルの設定

#### READMEの作成
`.github/profile/README.md`:
```markdown
# AI Research Laboratory

## 🚀 Our Mission
最先端のAI技術を研究開発し、社会に貢献する

## 🔬 Research Areas
- Computer Vision
- Natural Language Processing  
- Reinforcement Learning
- MLOps & AI Infrastructure

## 📊 Key Projects
| Project | Description | Status |
|---------|-------------|--------|
| [vision-transformer](https://github.com/YOUR_ORG/vision-transformer) | Vision Transformer implementation | Active |
| [nlp-toolkit](https://github.com/YOUR_ORG/nlp-toolkit) | NLP preprocessing tools | Stable |
| [rl-framework](https://github.com/YOUR_ORG/rl-framework) | Reinforcement learning framework | Beta |

## 👥 Teams
- **Research Team**: 基礎研究
- **Engineering Team**: 実装・最適化
- **MLOps Team**: インフラ・デプロイ

## 📚 Publications
- [Paper 1](https://arxiv.org/abs/2401.00001) - CVPR 2024
- [Paper 2](https://arxiv.org/abs/2312.00001) - NeurIPS 2023

## 🤝 Contributing
See our [Contributing Guide](CONTRIBUTING.md)

## 📬 Contact
- Email: contact@ai-research-lab.org
- Discord: [Join our server](https://discord.gg/YOUR_INVITE_CODE)
```

### 組織の可視性設定

#### メンバーの公開設定
```python
# org_visibility.py
class OrganizationVisibility:
    def __init__(self, org_name, token):
        self.github = Github(token)
        self.org = self.github.get_organization(org_name)
    
    def set_member_visibility(self, username, visibility='public'):
        """
        メンバーの可視性を設定
        visibility: 'public' or 'private'
        """
        member = self.org.get_member(username)
        
        if visibility == 'public':
            self.org.publicize_membership(member)
        else:
            self.org.conceal_membership(member)
    
    def enforce_visibility_policy(self, policy='public'):
        """組織全体の可視性ポリシーを適用"""
        for member in self.org.get_members():
            try:
                if policy == 'public':
                    self.org.publicize_membership(member)
                elif policy == 'private':
                    self.org.conceal_membership(member)
                elif policy == 'optional':
                    # デフォルトはプライベート、個人で選択可能
                    pass
            except Exception as e:
                print(f"Failed to set visibility for {member.login}: {e}")
```

## 10.2 AI協働チームの構造設計

### チーム階層の設計

#### AI協働を考慮した階層的チーム構造
```yaml
team_hierarchy:
  engineering:
    description: "All engineering teams with AI collaboration"
    privacy: "closed"  # secret or closed
    ai_settings:
      copilot_enabled: true
      ai_metrics_required: true
    
    sub_teams:
      backend:
        description: "Backend development"
        maintainers: ["backend-lead"]
        members: ["dev1", "dev2", "dev3"]
        ai_collaboration:
          primary_tools: ["GitHub Copilot", "ChatGPT"]
          code_review_ai: mandatory
        
      frontend:
        description: "Frontend development"
        maintainers: ["frontend-lead"]
        members: ["dev4", "dev5"]
        ai_collaboration:
          primary_tools: ["GitHub Copilot", "Figma AI"]
          design_ai_integration: true
        
      ml_engineering:
        description: "ML Engineering with AI pair programming"
        maintainers: ["ml-lead"]
        members: ["ml-eng1", "ml-eng2", "ml-eng3"]
        ai_collaboration:
          primary_tools: ["GitHub Copilot", "Claude", "ChatGPT"]
          experiment_tracking: "with AI annotations"
          model_development: "AI-assisted"
        
        sub_teams:
          computer_vision:
            description: "CV team - AI-collaborative development"
            members: ["cv-eng1", "cv-eng2"]
            ai_specialization: "image generation and analysis"
            
          nlp:
            description: "NLP team - AI language model integration"
            members: ["nlp-eng1", "nlp-eng2"]
            ai_specialization: "prompt engineering and LLM fine-tuning"
            
      ai_collaboration_team:
        description: "AI collaboration best practices and tooling"
        maintainers: ["ai-collab-lead"]
        members: ["ai-specialist1", "ai-specialist2"]
        responsibilities:
          - "第2章のフレームワーク維持・改善"
          - "AI協働メトリクスの分析"
          - "チーム向けトレーニング"
          - "ベストプラクティスの共有"
```

### チームの作成と管理

#### プログラムによるチーム管理
```python
# team_manager.py
class TeamManager:
    def __init__(self, org_name, token):
        self.github = Github(token)
        self.org = self.github.get_organization(org_name)
    
    def create_team_hierarchy(self, hierarchy_config):
        """階層的なチーム構造を作成"""
        def create_team_recursive(config, parent=None):
            # チームを作成
            team = self.org.create_team(
                name=config['name'],
                description=config.get('description', ''),
                privacy=config.get('privacy', 'closed'),
                parent_team_id=parent.id if parent else None
            )
            
            # メンテナーを追加
            for maintainer in config.get('maintainers', []):
                team.add_membership(
                    self.github.get_user(maintainer),
                    role='maintainer'
                )
            
            # メンバーを追加
            for member in config.get('members', []):
                team.add_membership(
                    self.github.get_user(member),
                    role='member'
                )
            
            # サブチームを作成
            for sub_config in config.get('sub_teams', []):
                create_team_recursive(sub_config, team)
            
            return team
        
        # ルートチームから作成開始
        create_team_recursive(hierarchy_config)
    
    def sync_team_with_ldap(self, team_name, ldap_group):
        """LDAPグループとチームを同期"""
        team = self.org.get_team_by_slug(team_name)
        
        # LDAP/SAML同期の設定（Enterprise only）
        team.create_or_update_ldap_mapping(
            ldap_dn=f"cn={ldap_group},ou=groups,dc=company,dc=com"
        )
```

### チーム権限の管理

#### リポジトリへのチーム権限付与
```python
def grant_team_permissions(self, team_name, repo_patterns, permission='write'):
    """
    チームに複数リポジトリへの権限を付与
    
    Args:
        team_name: チーム名
        repo_patterns: リポジトリパターンのリスト
        permission: 'read', 'write', 'admin'
    """
    team = self.org.get_team_by_slug(team_name)
    
    for repo in self.org.get_repos():
        for pattern in repo_patterns:
            if self._match_pattern(repo.name, pattern):
                team.add_to_repos(repo)
                team.set_repo_permission(repo, permission)
                print(f"Granted {permission} to {team_name} for {repo.name}")

def _match_pattern(self, name, pattern):
    """ワイルドカードパターンマッチング"""
    import fnmatch
    return fnmatch.fnmatch(name, pattern)

# 使用例
manager.grant_team_permissions(
    'ml_engineering',
    ['ml-*', 'model-*', 'training-*'],
    'write'
)
```

## 9.3 Outside Collaboratorの管理

### 外部協力者のポリシー

#### アクセス管理フレームワーク
```yaml
outside_collaborator_policy:
  # 承認プロセス
  approval:
    required_approvers: 2
    approver_teams: ["security", "management"]
    
  # アクセス期限
  access_duration:
    default_days: 90
    max_days: 365
    warning_days: 14
    
  # 権限制限
  permission_limits:
    max_permission: "write"  # adminは付与不可
    allowed_repos_pattern:
      - "public-*"
      - "collaboration-*"
    forbidden_repos:
      - "*-internal"
      - "*-private"
      - "infrastructure-*"
      
  # 監査要件
  audit:
    review_interval_days: 30
    activity_tracking: true
    require_2fa: true
```

### 外部協力者の自動管理

#### 期限管理システム
```python
# collaborator_manager.py
from datetime import datetime, timedelta
import json

class CollaboratorManager:
    def __init__(self, org_name, token):
        self.github = Github(token)
        self.org = self.github.get_organization(org_name)
        self.metadata_file = "collaborator_metadata.json"
    
    def add_outside_collaborator(self, username, repo_name, 
                               permission='read', days=90, 
                               reason="", approvers=[]):
        """外部協力者を追加（メタデータ付き）"""
        repo = self.org.get_repo(repo_name)
        
        # GitHubに追加
        repo.add_to_collaborators(username, permission)
        
        # メタデータを保存
        metadata = self.load_metadata()
        metadata[username] = {
            'repos': {
                repo_name: {
                    'permission': permission,
                    'added_date': datetime.now().isoformat(),
                    'expiry_date': (datetime.now() + timedelta(days=days)).isoformat(),
                    'reason': reason,
                    'approvers': approvers
                }
            }
        }
        self.save_metadata(metadata)
        
        # 通知
        self.notify_addition(username, repo_name, days)
    
    def check_expirations(self):
        """期限切れの協力者をチェック"""
        metadata = self.load_metadata()
        expired = []
        warning = []
        
        for username, user_data in metadata.items():
            for repo_name, repo_data in user_data['repos'].items():
                expiry = datetime.fromisoformat(repo_data['expiry_date'])
                days_until_expiry = (expiry - datetime.now()).days
                
                if days_until_expiry <= 0:
                    expired.append({
                        'username': username,
                        'repo': repo_name,
                        'expired_days': abs(days_until_expiry)
                    })
                elif days_until_expiry <= 14:
                    warning.append({
                        'username': username,
                        'repo': repo_name,
                        'days_remaining': days_until_expiry
                    })
        
        return {'expired': expired, 'warning': warning}
    
    def remove_expired_collaborators(self, dry_run=True):
        """期限切れの協力者を削除"""
        check_result = self.check_expirations()
        
        for item in check_result['expired']:
            if not dry_run:
                repo = self.org.get_repo(item['repo'])
                repo.remove_from_collaborators(item['username'])
                
                # メタデータを更新
                metadata = self.load_metadata()
                del metadata[item['username']]['repos'][item['repo']]
                if not metadata[item['username']]['repos']:
                    del metadata[item['username']]
                self.save_metadata(metadata)
                
            print(f"{'[DRY RUN] ' if dry_run else ''}Removed {item['username']} from {item['repo']}")
    
    def generate_access_report(self):
        """外部協力者のアクセスレポート生成"""
        report = {
            'generated_at': datetime.now().isoformat(),
            'total_collaborators': 0,
            'by_permission': {'read': 0, 'write': 0, 'admin': 0},
            'by_repo': {},
            'expiring_soon': [],
            'inactive_users': []
        }
        
        # 全リポジトリを確認
        for repo in self.org.get_repos():
            collaborators = []
            
            for collab in repo.get_collaborators(affiliation='outside'):
                permission = repo.get_collaborator_permission(collab)
                collaborators.append({
                    'username': collab.login,
                    'permission': permission,
                    'last_active': self.get_last_activity(collab, repo)
                })
                
                report['by_permission'][permission] += 1
                
                # 非アクティブユーザー
                if self.get_last_activity(collab, repo) > 30:
                    report['inactive_users'].append({
                        'username': collab.login,
                        'repo': repo.name,
                        'days_inactive': self.get_last_activity(collab, repo)
                    })
            
            if collaborators:
                report['by_repo'][repo.name] = collaborators
                report['total_collaborators'] += len(collaborators)
        
        return report
```

## 9.4 SAML SSOとの連携

### SAML SSO設定（Enterprise）

#### 基本設定
```yaml
saml_configuration:
  # Identity Provider設定
  idp:
    entity_id: "https://idp.company.com"
    sso_url: "https://idp.company.com/sso"
    certificate: |
      -----BEGIN CERTIFICATE-----
      MIIDxTCCAq2gAwIBAgIQAqxcJmoLQJuPC3nyrkYldzANBgkqhkiG9w0BAQUFADBs
      ...
      -----END CERTIFICATE-----
      
  # 属性マッピング
  attribute_mapping:
    name_id: "email"
    email: "email"
    name: "displayName"
    username: "sAMAccountName"
    groups: "memberOf"
    
  # グループ同期
  group_sync:
    enabled: true
    base_dn: "ou=github,ou=groups,dc=company,dc=com"
    filter: "(objectClass=group)"
    
  # セッション設定
  session:
    timeout_hours: 8
    require_reauthentication: true
```

### SCIM プロビジョニング

#### 自動ユーザー管理
```python
# scim_sync.py
class SCIMSync:
    def __init__(self, org_name, scim_token):
        self.org_name = org_name
        self.scim_endpoint = f"https://api.github.com/scim/v2/organizations/{org_name}"
        self.headers = {
            'Authorization': f'Bearer {scim_token}',
            'Content-Type': 'application/scim+json'
        }
    
    def create_user(self, user_data):
        """SCIMでユーザーを作成"""
        scim_user = {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "userName": user_data['username'],
            "name": {
                "givenName": user_data['first_name'],
                "familyName": user_data['last_name']
            },
            "emails": [{
                "value": user_data['email'],
                "primary": True
            }],
            "externalId": user_data['employee_id'],
            "active": True
        }
        
        response = requests.post(
            f"{self.scim_endpoint}/Users",
            json=scim_user,
            headers=self.headers
        )
        
        return response.json()
    
    def sync_groups(self, group_mappings):
        """ADグループとGitHubチームを同期"""
        for ad_group, github_team in group_mappings.items():
            ad_members = self.get_ad_group_members(ad_group)
            
            # GitHubチームを作成/更新
            team_data = {
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                "displayName": github_team,
                "members": [
                    {"value": member['id']} for member in ad_members
                ]
            }
            
            # 既存チームを検索
            existing_team = self.find_team(github_team)
            
            if existing_team:
                # 更新
                requests.put(
                    f"{self.scim_endpoint}/Groups/{existing_team['id']}",
                    json=team_data,
                    headers=self.headers
                )
            else:
                # 作成
                requests.post(
                    f"{self.scim_endpoint}/Groups",
                    json=team_data,
                    headers=self.headers
                )
```

## 9.5 監査ログの活用

### 監査ログの収集と分析

#### ログ収集設定
```python
# audit_log_collector.py
class AuditLogCollector:
    def __init__(self, org_name, token):
        self.org_name = org_name
        self.headers = {
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
    def fetch_audit_log(self, start_date=None, end_date=None):
        """監査ログを取得"""
        url = f"https://api.github.com/orgs/{self.org_name}/audit-log"
        
        params = {}
        if start_date:
            params['after'] = start_date.isoformat()
        if end_date:
            params['before'] = end_date.isoformat()
            
        all_events = []
        page = 1
        
        while True:
            params['page'] = page
            response = requests.get(url, headers=self.headers, params=params)
            
            if response.status_code != 200:
                break
                
            events = response.json()
            if not events:
                break
                
            all_events.extend(events)
            page += 1
            
        return all_events
    
    def analyze_security_events(self, events):
        """セキュリティ関連イベントを分析"""
        security_events = {
            'auth_failures': [],
            'permission_changes': [],
            'repo_visibility_changes': [],
            'member_changes': [],
            'suspicious_activities': []
        }
        
        for event in events:
            # 認証失敗
            if event['action'] == 'auth.login_failed':
                security_events['auth_failures'].append(event)
                
            # 権限変更
            elif event['action'] in ['team.add_repository', 
                                   'org.update_member_permission']:
                security_events['permission_changes'].append(event)
                
            # リポジトリ可視性変更
            elif event['action'] == 'repo.change_visibility':
                security_events['repo_visibility_changes'].append(event)
                
            # メンバー変更
            elif event['action'] in ['org.add_member', 'org.remove_member']:
                security_events['member_changes'].append(event)
                
            # 疑わしい活動
            if self.is_suspicious(event):
                security_events['suspicious_activities'].append(event)
                
        return security_events
    
    def is_suspicious(self, event):
        """疑わしい活動を検出"""
        suspicious_patterns = [
            # 短時間での大量操作
            lambda e: e['action'].startswith('repo.download') and 
                     self.count_recent_downloads(e['actor']) > 10,
            
            # 通常と異なる時間帯のアクセス
            lambda e: self.is_unusual_time(e['timestamp']),
            
            # 通常と異なる場所からのアクセス
            lambda e: self.is_unusual_location(e.get('actor_location'))
        ]
        
        return any(pattern(event) for pattern in suspicious_patterns)
    
    def generate_compliance_report(self, start_date, end_date):
        """コンプライアンスレポート生成"""
        events = self.fetch_audit_log(start_date, end_date)
        
        report = {
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'summary': {
                'total_events': len(events),
                'unique_actors': len(set(e['actor'] for e in events)),
                'event_types': {}
            },
            'security_analysis': self.analyze_security_events(events),
            'compliance_checks': {
                'unauthorized_access_attempts': 0,
                'policy_violations': 0,
                'data_exports': 0
            }
        }
        
        # イベントタイプ別集計
        for event in events:
            action = event['action']
            report['summary']['event_types'][action] = \
                report['summary']['event_types'].get(action, 0) + 1
        
        return report
```

### リアルタイム監視

#### Webhook設定
```yaml
# audit-webhook.yml
webhook_config:
  url: "https://security.company.com/github-audit"
  secret: "${WEBHOOK_SECRET}"
  events:
    - organization
    - repository
    - team
    - member
    - security_alert
  
  filters:
    actions:
      - "*.delete"
      - "*.create"
      - "repo.change_visibility"
      - "org.update_member_permission"
```

## まとめ

本章では、GitHub組織管理とチーム運用について学習しました：
- Organizationの作成と適切な初期設定
- 階層的なチーム構造で効率的な権限管理
- 外部協力者の期限付きアクセス管理
- SAML SSOでエンタープライズ認証統合
- 監査ログでセキュリティとコンプライアンス確保

次章では、実践的なセキュリティ設定について学習します。

## 確認事項

- [ ] Organizationの基本設定が完了している
- [ ] チーム構造を設計・実装できる
- [ ] 外部協力者の管理プロセスを確立している
- [ ] SSO連携の仕組みを理解している（Enterprise）
- [ ] 監査ログを活用した監視体制がある
