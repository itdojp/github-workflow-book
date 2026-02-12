# 第16章：外部協力者との連携

## 16.1 Fork & Pull Requestモデル

### Fork & PRワークフローの基本

#### 外部協力者向けのワークフロー
```markdown
# Contributing Guide for External Collaborators

## Getting Started

1. **Fork the repository**
   - Navigate to https://github.com/itdojp/github-workflow-book-public
   - Click the "Fork" button
   - Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/github-workflow-book-public.git
   cd github-workflow-book-public
   git remote add upstream https://github.com/itdojp/github-workflow-book-public.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow our coding standards
   - Add tests for new functionality
   - Update documentation

4. **Keep your fork updated**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   git push origin main
   ```

5. **Submit a Pull Request**
   - Push your branch to your fork
   - Create a PR from your fork to the main repository
   - Fill out the PR template completely
```text

### フォーク管理の自動化

#### フォーク同期スクリプト
```python
# scripts/fork_manager.py
import subprocess
import requests
from github import Github

class ForkManager:
    def __init__(self, token, upstream_repo):
        self.github = Github(token)
        self.upstream_repo = upstream_repo
        
    def get_active_forks(self, days=30):
        """アクティブなフォークを取得"""
        repo = self.github.get_repo(self.upstream_repo)
        forks = []
        
        for fork in repo.get_forks():
            # 最終更新日をチェック
            if (datetime.now() - fork.updated_at).days <= days:
                forks.append({
                    'owner': fork.owner.login,
                    'name': fork.name,
                    'url': fork.html_url,
                    'behind_by': self._get_behind_count(fork)
                })
                
        return forks
    
    def _get_behind_count(self, fork):
        """フォークが何コミット遅れているかを計算"""
        upstream = self.github.get_repo(self.upstream_repo)
        
        try:
            comparison = upstream.compare(
                f"{fork.owner.login}:{fork.default_branch}",
                upstream.default_branch
            )
            return comparison.behind_by
        except:
            return None
            
    def notify_outdated_forks(self, threshold_commits=10):
        """古いフォークの所有者に通知"""
        active_forks = self.get_active_forks()
        
        for fork in active_forks:
            if fork['behind_by'] and fork['behind_by'] > threshold_commits:
                self._send_sync_reminder(fork)
                
    def _send_sync_reminder(self, fork):
        """同期リマインダーを送信"""
        issue_title = "Your fork is out of sync"
        issue_body = f"""
Hi @{fork['owner']},

Your fork is {fork['behind_by']} commits behind the upstream repository.

To sync your fork:
```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

Or use GitHub's web interface:
1. Go to your fork: {fork['url']}
2. Click "Sync fork"
3. Click "Update branch"

Let us know if you need any help!
"""
        
        # フォークにIssueを作成（可能な場合）
        fork_repo = self.github.get_repo(f"{fork['owner']}/{fork['name']}")
        try:
            fork_repo.create_issue(title=issue_title, body=issue_body)
        except:
            # Issueが無効な場合はスキップ
            pass
```text

### Pull Requestテンプレート

#### 包括的なPRテンプレート
```markdown
<!-- .github/pull_request_template.md -->
## Description
<!-- Provide a brief description of the changes -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Changes Made
<!-- List the specific changes made -->
- 
- 
- 

## Testing
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Performance Impact
<!-- Describe any performance implications -->
- Training time: 
- Inference time: 
- Memory usage: 

## Dependencies
<!-- List any new dependencies added -->
- 

## Screenshots (if applicable)
<!-- Add screenshots to help explain your changes -->

## Additional Notes
<!-- Any additional information that reviewers should know -->

## Checklist for Reviewers
- [ ] Code quality and style
- [ ] Test coverage
- [ ] Documentation updates
- [ ] Performance implications
- [ ] Security considerations
```

## 16.2 コントリビューターライセンス契約（CLA）

### CLAの実装

#### CLA自動化ボット
```python
# .github/workflows/cla.yml
name: "CLA Assistant"

on:
  issue_comment:
    types: [created]
  pull_request_target:
    types: [opened, closed, synchronize]

jobs:
  CLAAssistant:
    runs-on: ubuntu-latest
    steps:
      - name: "CLA Assistant"
        if: (github.event.comment.body == 'recheck' || github.event.comment.body == 'I have read the CLA Document and I hereby sign the CLA') || github.event_name == 'pull_request_target'
        uses: cla-assistant/github-action@v2.1.3-beta
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PERSONAL_ACCESS_TOKEN: ${{ secrets.CLA_ASSISTANT_TOKEN }}
        with:
          path-to-signatures: 'signatures/version1/cla.json'
          path-to-document: 'https://github.com/itdojp/github-workflow-book-public/blob/main/CLA.md'
          branch: 'cla-signatures'
          allowlist: bot*

          # カスタムメッセージ
          custom-notsigned-prcomment: |
            Thank you for your contribution! 
            
            Before we can merge your PR, we need you to sign our Contributor License Agreement (CLA).
            
            Please read and sign the CLA by commenting:
            ```
            I have read the CLA Document and I hereby sign the CLA
            ```
            
            You can read the full CLA here: [CLA Document](https://github.com/itdojp/github-workflow-book-public/blob/main/CLA.md)
          
          custom-allsigned-prcomment: |
            All contributors have signed the CLA ✅
            Thank you for your contribution!
```

### CLAドキュメント

#### CLA.md
```markdown
# Contributor License Agreement

## Purpose
This agreement clarifies the intellectual property license granted with contributions from any person or entity.

## Agreement

By making a contribution to this project, I agree to the following:

### 1. Definitions
- "You" (or "Your") shall mean the copyright owner or legal entity authorized by the copyright owner that is making this Agreement.
- "Contribution" shall mean any original work of authorship, including any modifications or additions to an existing work.

### 2. Grant of Copyright License
You hereby grant to the project maintainers and to recipients of software distributed by the project maintainers a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute Your Contributions and such derivative works.

### 3. Grant of Patent License
You hereby grant to the project maintainers and to recipients of software distributed by the project maintainers a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer the Work.

### 4. Representations
You represent that:
- You are legally entitled to grant the above license
- Your Contribution is Your original creation
- Your Contribution does not violate any third party rights

### 5. No Support Obligations
You are not expected to provide support for Your Contributions, except to the extent You desire to provide support.

## How to Sign
Comment on the PR with:
```
I have read the CLA Document and I hereby sign the CLA
```text
```

### CLA管理システム

#### CLA署名者の管理
```python
# scripts/cla_manager.py
import json
from datetime import datetime
from pathlib import Path

class CLAManager:
    def __init__(self, signatures_file='signatures/cla.json'):
        self.signatures_file = Path(signatures_file)
        self.signatures = self._load_signatures()
        
    def _load_signatures(self):
        """署名情報を読み込み"""
        if self.signatures_file.exists():
            with open(self.signatures_file) as f:
                return json.load(f)
        return {'signatures': []}
        
    def add_signature(self, github_username, pr_number, email=None):
        """新しい署名を追加"""
        signature = {
            'github_username': github_username,
            'signed_at': datetime.now().isoformat(),
            'pr_number': pr_number,
            'email': email,
            'cla_version': '1.0'
        }
        
        # 既存の署名をチェック
        if not self.has_signed(github_username):
            self.signatures['signatures'].append(signature)
            self._save_signatures()
            
        return signature
        
    def has_signed(self, github_username):
        """ユーザーが署名済みかチェック"""
        for sig in self.signatures['signatures']:
            if sig['github_username'] == github_username:
                return True
        return False
        
    def get_unsigned_contributors(self, pr_contributors):
        """未署名のコントリビューターを取得"""
        unsigned = []
        
        for contributor in pr_contributors:
            if not self.has_signed(contributor):
                unsigned.append(contributor)
                
        return unsigned
        
    def generate_report(self):
        """CLA署名レポートを生成"""
        total_signatures = len(self.signatures['signatures'])
        
        # 月別の署名数
        monthly_stats = {}
        for sig in self.signatures['signatures']:
            month = sig['signed_at'][:7]  # YYYY-MM
            monthly_stats[month] = monthly_stats.get(month, 0) + 1
            
        report = f"""# CLA Signature Report

## Summary
- Total Signatures: {total_signatures}
- CLA Version: 1.0

## Monthly Statistics
"""
        
        for month, count in sorted(monthly_stats.items()):
            report += f"- {month}: {count} signatures\n"
            
        return report
    
    def _save_signatures(self):
        """署名情報を保存"""
        self.signatures_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.signatures_file, 'w') as f:
            json.dump(self.signatures, f, indent=2)
```

## 16.3 外部貢献者の権限管理

### 段階的な権限付与

#### コントリビューター成長パス
```python
# contributor_management.py
from enum import Enum
import yaml

class ContributorLevel(Enum):
    NEW = "new_contributor"
    ACTIVE = "active_contributor"
    TRUSTED = "trusted_contributor"
    MAINTAINER = "maintainer"

class ContributorManager:
    def __init__(self, config_file='contributor_levels.yaml'):
        self.config = self._load_config(config_file)
        self.contributors = {}
        
    def _load_config(self, config_file):
        """権限レベル設定を読み込み"""
        with open(config_file) as f:
            return yaml.safe_load(f)
            
    def track_contribution(self, username, contribution_type):
        """貢献を追跡"""
        if username not in self.contributors:
            self.contributors[username] = {
                'level': ContributorLevel.NEW,
                'contributions': {
                    'prs_merged': 0,
                    'issues_created': 0,
                    'reviews_done': 0,
                    'docs_improved': 0
                },
                'first_contribution': datetime.now().isoformat()
            }
            
        # 貢献をカウント
        if contribution_type in self.contributors[username]['contributions']:
            self.contributors[username]['contributions'][contribution_type] += 1
            
        # レベルアップをチェック
        self._check_level_up(username)
        
    def _check_level_up(self, username):
        """レベルアップ条件をチェック"""
        contributor = self.contributors[username]
        contributions = contributor['contributions']
        
        # レベルアップ条件
        if contributor['level'] == ContributorLevel.NEW:
            if contributions['prs_merged'] >= 3:
                self._promote_contributor(username, ContributorLevel.ACTIVE)
                
        elif contributor['level'] == ContributorLevel.ACTIVE:
            if (contributions['prs_merged'] >= 10 and 
                contributions['reviews_done'] >= 5):
                self._promote_contributor(username, ContributorLevel.TRUSTED)
                
    def _promote_contributor(self, username, new_level):
        """コントリビューターを昇格"""
        old_level = self.contributors[username]['level']
        self.contributors[username]['level'] = new_level
        
        # 権限を更新
        self._update_permissions(username, new_level)
        
        # 通知を送信
        self._notify_promotion(username, old_level, new_level)
        
    def _update_permissions(self, username, level):
        """GitHubの権限を更新"""
        permissions = self.config['levels'][level.value]['permissions']
        
        # GitHub APIを使用して権限を設定
        if 'triage' in permissions:
            # Triage権限を付与
            self._grant_triage_permission(username)
            
        if 'write' in permissions:
            # Write権限を付与（特定のリポジトリ）
            self._grant_write_permission(username, permissions['write'])
```

### 外部コントリビューター向けのガイドライン

#### CONTRIBUTING.md
```markdown
# Contributing to ML Project

We love your input! We want to make contributing to this project as easy and transparent as possible.

## Development Process
We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## Code Contributions
### 1. Fork the Repository
- Fork the repo and create your branch from `develop`
- If you've added code that should be tested, add tests
- If you've changed APIs, update the documentation

### 2. Code Style
- Use [Black](https://github.com/psf/black) for Python code formatting
- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- Use type hints where applicable

### 3. Testing
- Write unit tests for new functionality
- Ensure all tests pass: `pytest tests/`
- Maintain test coverage above 80%

### 4. Commit Messages
Follow the conventional commits specification:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or corrections
- `chore:` Maintenance tasks

### 5. Pull Requests
- Fill in the required template
- Include screenshots for UI changes
- Link related issues

## First Time Contributors
Looking for a good first issue? Check out issues labeled [`good first issue`](https://github.com/itdojp/github-workflow-book-public/labels/good%20first%20issue).

### Setting Up Development Environment
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ml-project.git
cd ml-project

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements-dev.txt

# Install pre-commit hooks
pre-commit install
```

## Code Review Process
1. Automated checks must pass
2. At least one maintainer approval required
3. No merge conflicts
4. CLA must be signed

## Community
- Join our [Discord server](https://discord.gg/xxxxx)
- Attend our monthly contributor meetings
- Check out our [roadmap](https://github.com/itdojp/github-workflow-book-public/projects/1)

## Recognition
We recognize our contributors! Check out our [Contributors page](https://github.com/itdojp/github-workflow-book-public/graphs/contributors).

### Contributor Levels
- 🌱 **New Contributor**: First PR merged
- 🌿 **Active Contributor**: 3+ PRs merged
- 🌳 **Trusted Contributor**: 10+ PRs, active reviewer
- 🌲 **Maintainer**: Core team member

## License
By contributing, you agree that your contributions will be licensed under the same license as the project.
```text

## 16.4 コントリビューションガイドラインの作成

### 技術的ガイドライン

#### コーディング標準
```python
# .github/coding_standards.py
"""
ML Project Coding Standards

This module demonstrates our coding standards for Python files.
"""

from typing import List, Optional, Tuple, Union
import numpy as np
import torch
import torch.nn as nn

class ModelBase(nn.Module):
    """Base class for all models in the project.
    
    All models should inherit from this class and implement
    the required methods.
    
    Args:
        input_dim: Input dimension
        output_dim: Output dimension
        hidden_dims: List of hidden layer dimensions
        activation: Activation function (default: ReLU)
        
    Example:
        >>> model = ModelBase(784, 10, [256, 128])
        >>> output = model(torch.randn(32, 784))
    """
    
    def __init__(
        self,
        input_dim: int,
        output_dim: int,
        hidden_dims: Optional[List[int]] = None,
        activation: nn.Module = nn.ReLU()
    ):
        super().__init__()
        self.input_dim = input_dim
        self.output_dim = output_dim
        self.hidden_dims = hidden_dims or [256, 128]
        self.activation = activation
        
        # Build layers
        self.layers = self._build_layers()
        
    def _build_layers(self) -> nn.ModuleList:
        """Build the neural network layers.
        
        Returns:
            ModuleList containing all layers
        """
        layers = nn.ModuleList()
        
        # Input layer
        prev_dim = self.input_dim
        
        # Hidden layers
        for hidden_dim in self.hidden_dims:
            layers.append(nn.Linear(prev_dim, hidden_dim))
            layers.append(self.activation)
            layers.append(nn.BatchNorm1d(hidden_dim))
            prev_dim = hidden_dim
            
        # Output layer
        layers.append(nn.Linear(prev_dim, self.output_dim))
        
        return layers
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass through the network.
        
        Args:
            x: Input tensor of shape (batch_size, input_dim)
            
        Returns:
            Output tensor of shape (batch_size, output_dim)
        """
        for layer in self.layers:
            x = layer(x)
        return x
        
    def get_num_parameters(self) -> int:
        """Get the total number of trainable parameters.
        
        Returns:
            Number of parameters
        """
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


def validate_input(
    data: Union[np.ndarray, torch.Tensor],
    expected_shape: Optional[Tuple[int, ...]] = None,
    expected_dtype: Optional[type] = None
) -> torch.Tensor:
    """Validate and convert input data.
    
    Args:
        data: Input data
        expected_shape: Expected shape (None for any)
        expected_dtype: Expected data type
        
    Returns:
        Validated tensor
        
    Raises:
        ValueError: If validation fails
    """
    # Convert to tensor if needed
    if isinstance(data, np.ndarray):
        data = torch.from_numpy(data)
        
    # Validate shape
    if expected_shape is not None:
        if data.shape != expected_shape:
            raise ValueError(
                f"Expected shape {expected_shape}, got {data.shape}"
            )
            
    # Validate dtype
    if expected_dtype is not None:
        if data.dtype != expected_dtype:
            data = data.to(expected_dtype)
            
    return data
```

### コードレビューチェックリスト

#### レビュー自動化
```python
# .github/review_checklist.py
import ast
import subprocess
from pathlib import Path

class CodeReviewChecker:
    """Automated code review checks."""
    
    def __init__(self, pr_files):
        self.pr_files = pr_files
        self.issues = []
        
    def run_all_checks(self):
        """Run all automated checks."""
        checks = [
            self.check_code_style,
            self.check_type_hints,
            self.check_docstrings,
            self.check_test_coverage,
            self.check_security,
            self.check_performance
        ]
        
        for check in checks:
            check()
            
        return self.issues
        
    def check_code_style(self):
        """Check code style with Black and flake8."""
        # Black check
        result = subprocess.run(
            ['black', '--check'] + self.pr_files,
            capture_output=True
        )
        
        if result.returncode != 0:
            self.issues.append({
                'type': 'style',
                'severity': 'medium',
                'message': 'Code is not formatted with Black'
            })
            
        # Flake8 check
        result = subprocess.run(
            ['flake8'] + self.pr_files,
            capture_output=True,
            text=True
        )
        
        if result.stdout:
            self.issues.append({
                'type': 'style',
                'severity': 'low',
                'message': f'Flake8 issues:\n{result.stdout}'
            })
            
    def check_type_hints(self):
        """Check for missing type hints."""
        for file_path in self.pr_files:
            if not file_path.endswith('.py'):
                continue
                
            with open(file_path) as f:
                tree = ast.parse(f.read())
                
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    # Check return type
                    if node.returns is None and node.name != '__init__':
                        self.issues.append({
                            'type': 'type_hints',
                            'severity': 'low',
                            'message': f'Missing return type: {file_path}:{node.name}'
                        })
                        
                    # Check argument types
                    for arg in node.args.args:
                        if arg.annotation is None and arg.arg != 'self':
                            self.issues.append({
                                'type': 'type_hints',
                                'severity': 'low',
                                'message': f'Missing type hint for {arg.arg} in {node.name}'
                            })
                            
    def check_docstrings(self):
        """Check for missing or incomplete docstrings."""
        for file_path in self.pr_files:
            if not file_path.endswith('.py'):
                continue
                
            with open(file_path) as f:
                tree = ast.parse(f.read())
                
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                    docstring = ast.get_docstring(node)
                    
                    if not docstring:
                        self.issues.append({
                            'type': 'documentation',
                            'severity': 'medium',
                            'message': f'Missing docstring: {file_path}:{node.name}'
                        })
                    elif isinstance(node, ast.FunctionDef):
                        # Check for Args and Returns sections
                        if 'Args:' not in docstring and len(node.args.args) > 1:
                            self.issues.append({
                                'type': 'documentation',
                                'severity': 'low',
                                'message': f'Missing Args section in docstring: {node.name}'
                            })
```

## 16.5 オープンソースプロジェクトの運営

### プロジェクトガバナンス

#### GOVERNANCE.md
```markdown
# Project Governance

## Overview
This document describes the governance model for the ML Project.

## Roles and Responsibilities

### Users
- Use the software
- Report bugs and request features
- Contribute to discussions

### Contributors
- Submit patches and pull requests
- Review pull requests
- Participate in project discussions
- Help new contributors

### Committers
- All privileges of Contributors
- Merge pull requests
- Vote on project decisions
- Nominate new Committers

### Technical Steering Committee (TSC)
- Set project direction and roadmap
- Make architectural decisions
- Resolve conflicts
- Approve new Committers

## Decision Making

### Consensus
Most decisions are made by consensus through discussion in issues and pull requests.

### Voting
When consensus cannot be reached, decisions are made by voting:
- Simple majority for most decisions
- 2/3 majority for:
  - Adding/removing TSC members
  - Major architectural changes
  - License changes

### Proposal Process
1. Create an RFC (Request for Comments) issue
2. Allow at least 1 week for discussion
3. TSC reviews and approves/rejects
4. Implementation begins if approved

## Becoming a Committer
Contributors can be nominated to become Committers based on:
- Quality and quantity of contributions
- Engagement in the community
- Demonstrated understanding of the project

## Code of Conduct
All participants must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Changes to Governance
This governance model can be changed through the proposal process with TSC approval.
```

### コミュニティ管理

#### コミュニティ健全性メトリクス
```python
# scripts/community_health.py
import requests
from datetime import datetime, timedelta
from collections import defaultdict

class CommunityHealthMonitor:
    def __init__(self, github_token, repo_name):
        self.headers = {'Authorization': f'token {github_token}'}
        self.repo_name = repo_name
        self.base_url = f'https://api.github.com/repos/{repo_name}'
        
    def calculate_health_metrics(self, days=30):
        """コミュニティ健全性メトリクスを計算"""
        since = datetime.now() - timedelta(days=days)
        
        metrics = {
            'response_time': self._calculate_response_time(since),
            'issue_resolution': self._calculate_issue_resolution(since),
            'pr_velocity': self._calculate_pr_velocity(since),
            'contributor_growth': self._calculate_contributor_growth(since),
            'engagement': self._calculate_engagement(since),
            'diversity': self._calculate_diversity(since)
        }
        
        # 総合スコアを計算
        metrics['overall_health'] = self._calculate_overall_health(metrics)
        
        return metrics
        
    def _calculate_response_time(self, since):
        """Issue/PRへの初回応答時間"""
        response_times = []
        
        # Issues
        issues = self._get_issues(since)
        for issue in issues:
            if issue['comments'] > 0:
                first_comment = self._get_first_comment(issue['number'], 'issues')
                if first_comment:
                    created = datetime.fromisoformat(issue['created_at'].rstrip('Z'))
                    commented = datetime.fromisoformat(first_comment['created_at'].rstrip('Z'))
                    response_times.append((commented - created).total_seconds() / 3600)
                    
        # Pull Requests
        prs = self._get_pull_requests(since)
        for pr in prs:
            if pr['comments'] > 0 or pr['review_comments'] > 0:
                first_comment = self._get_first_comment(pr['number'], 'pulls')
                if first_comment:
                    created = datetime.fromisoformat(pr['created_at'].rstrip('Z'))
                    commented = datetime.fromisoformat(first_comment['created_at'].rstrip('Z'))
                    response_times.append((commented - created).total_seconds() / 3600)
                    
        if response_times:
            return {
                'median_hours': sorted(response_times)[len(response_times) // 2],
                'average_hours': sum(response_times) / len(response_times)
            }
        return {'median_hours': None, 'average_hours': None}
        
    def _calculate_contributor_growth(self, since):
        """新規コントリビューターの成長率"""
        # コミット作者を取得
        commits = self._get_commits(since)
        
        contributors_by_month = defaultdict(set)
        for commit in commits:
            if commit['author']:
                month = commit['commit']['author']['date'][:7]
                contributors_by_month[month].add(commit['author']['login'])
                
        # 月別の新規コントリビューター数を計算
        all_contributors = set()
        new_by_month = {}
        
        for month in sorted(contributors_by_month.keys()):
            new_contributors = contributors_by_month[month] - all_contributors
            new_by_month[month] = len(new_contributors)
            all_contributors.update(contributors_by_month[month])
            
        return {
            'total_new': sum(new_by_month.values()),
            'by_month': new_by_month,
            'growth_rate': self._calculate_growth_rate(new_by_month)
        }
        
    def generate_health_report(self, metrics):
        """健全性レポートを生成"""
        report = f"""# Community Health Report

Generated: {datetime.now().strftime('%Y-%m-%d')}

## Overall Health Score: {metrics['overall_health']:.1f}/100

## Key Metrics

### 📊 Response Time
- Median: {metrics['response_time']['median_hours']:.1f} hours
- Average: {metrics['response_time']['average_hours']:.1f} hours

### 🔄 Issue Resolution
- Close rate: {metrics['issue_resolution']['close_rate']:.1%}
- Median time to close: {metrics['issue_resolution']['median_days']:.1f} days

### 🚀 PR Velocity  
- Merge rate: {metrics['pr_velocity']['merge_rate']:.1%}
- Median time to merge: {metrics['pr_velocity']['median_days']:.1f} days

### 👥 Contributor Growth
- New contributors: {metrics['contributor_growth']['total_new']}
- Growth rate: {metrics['contributor_growth']['growth_rate']:.1%}

### 💬 Engagement
- Comments per issue: {metrics['engagement']['comments_per_issue']:.1f}
- Active discussions: {metrics['engagement']['active_discussions']}

### 🌍 Diversity
- Unique contributors: {metrics['diversity']['unique_contributors']}
- Geographic distribution: {metrics['diversity']['countries']} countries

## Recommendations
{self._generate_recommendations(metrics)}
"""
        return report
        
    def _generate_recommendations(self, metrics):
        """改善推奨事項を生成"""
        recommendations = []
        
        if metrics['response_time']['median_hours'] > 48:
            recommendations.append(
                "- Consider setting up automated responses for new issues/PRs"
            )
            
        if metrics['issue_resolution']['close_rate'] < 0.7:
            recommendations.append(
                "- Review and close stale issues to improve close rate"
            )
            
        if metrics['contributor_growth']['growth_rate'] < 0.05:
            recommendations.append(
                "- Create more 'good first issue' labels to attract new contributors"
            )
            
        return '\n'.join(recommendations) if recommendations else "No specific recommendations at this time."
```

### リリース管理

#### 自動リリースワークフロー
```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Generate changelog
        id: changelog
        run: |
          # 前回のタグからの変更を取得
          PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^)
          
          # Conventional Commitsを解析
          npm install -g conventional-changelog-cli
          conventional-changelog -p angular -i CHANGELOG.md -s -r 0
          
          # GitHubリリース用の本文を生成
          echo "changelog<<EOF" >> $GITHUB_OUTPUT
          cat CHANGELOG.md | sed -n "/## \[${GITHUB_REF_NAME#v}\]/,/## \[/p" | sed '$d' >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
          
      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: Release ${{ github.ref_name }}
          body: ${{ steps.changelog.outputs.changelog }}
          draft: false
          prerelease: ${{ contains(github.ref_name, '-') }}
          
      - name: Build and publish package
        run: |
          python -m pip install --upgrade pip
          pip install build twine
          
          # パッケージをビルド
          python -m build
          
          # PyPIに公開
          python -m twine upload dist/*
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_API_TOKEN }}
          
      - name: Update documentation
        run: |
          # ドキュメントをビルド
          pip install -r docs/requirements.txt
          cd docs && make html
          
          # GitHub Pagesにデプロイ
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          
          git checkout gh-pages
          cp -r docs/_build/html/* .
          git add .
          git commit -m "Update documentation for ${{ github.ref_name }}"
          git push
```

## まとめ

本章では、外部協力者との効果的な連携方法を学習しました：
- Fork & Pull Requestモデルによる貢献の受け入れ
- CLAによる知的財産権の明確化
- 段階的な権限管理とコントリビューター育成
- 明確なコントリビューションガイドライン
- 健全なオープンソースコミュニティの運営

次章では、コンプライアンスとガバナンスについて学習します。

## 確認事項

- [ ] Fork & PRワークフローを理解している
- [ ] CLAシステムを実装できる
- [ ] コントリビューターレベルを設計できる
- [ ] コントリビューションガイドラインを作成できる
- [ ] コミュニティの健全性を測定できる