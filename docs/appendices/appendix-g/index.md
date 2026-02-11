---
layout: book
title: "付録G：参考資料"
---

# 付録G：参考資料

## G.1 ライセンス管理の基本

### オープンソースライセンスの選択

#### 主要なライセンスの比較
```yaml
# license_comparison.yaml
licenses:
  MIT:
    permissions:
      - commercial_use: true
      - modification: true
      - distribution: true
      - private_use: true
    conditions:
      - include_copyright: true
      - include_license: true
    limitations:
      - liability: false
      - warranty: false
    use_case: "最も制限が少ない。商用利用も自由"
    
  Apache-2.0:
    permissions:
      - commercial_use: true
      - modification: true
      - distribution: true
      - private_use: true
      - patent_use: true
    conditions:
      - include_copyright: true
      - include_license: true
      - state_changes: true
      - include_notice: true
    limitations:
      - liability: false
      - warranty: false
    use_case: "特許条項あり。企業向けプロジェクトに適している"
    
  GPL-3.0:
    permissions:
      - commercial_use: true
      - modification: true
      - distribution: true
      - private_use: true
      - patent_use: true
    conditions:
      - include_copyright: true
      - include_license: true
      - state_changes: true
      - disclose_source: true
      - same_license: true
    limitations:
      - liability: false
      - warranty: false
    use_case: "コピーレフト。派生物も同じライセンスが必要"
    
  BSD-3-Clause:
    permissions:
      - commercial_use: true
      - modification: true
      - distribution: true
      - private_use: true
    conditions:
      - include_copyright: true
      - include_license: true
    limitations:
      - liability: false
      - warranty: false
    use_case: "MITに似ているが、名前の使用に制限あり"
```

### ライセンスチェッカーの実装

#### 依存関係のライセンス確認
```python
# scripts/license_checker.py
import subprocess
import json
import requests
from typing import Dict, List, Set

class LicenseChecker:
    def __init__(self):
        self.allowed_licenses = {
            'MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause',
            'ISC', 'Python-2.0', 'PSF', 'CC0-1.0', 'Unlicense'
        }
        
        self.copyleft_licenses = {
            'GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0'
        }
        
        self.commercial_restricted = {
            'CC-BY-NC', 'CC-BY-NC-SA', 'CC-BY-NC-ND'
        }
        
    def check_dependencies(self, requirements_file='requirements.txt'):
        """依存関係のライセンスをチェック"""
        issues = []
        
        # pip-licensesを使用してライセンス情報を取得
        result = subprocess.run(
            ['pip-licenses', '--format=json', '--with-urls'],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise RuntimeError("Failed to run pip-licenses")
            
        licenses_data = json.loads(result.stdout)
        
        for package in licenses_data:
            license_name = package['License']
            
            # ライセンスをチェック
            if license_name in self.copyleft_licenses:
                issues.append({
                    'package': package['Name'],
                    'version': package['Version'],
                    'license': license_name,
                    'type': 'copyleft',
                    'severity': 'high',
                    'message': f"Copyleft license may require source code disclosure"
                })
                
            elif license_name in self.commercial_restricted:
                issues.append({
                    'package': package['Name'],
                    'version': package['Version'],
                    'license': license_name,
                    'type': 'commercial_restriction',
                    'severity': 'high',
                    'message': f"License restricts commercial use"
                })
                
            elif license_name not in self.allowed_licenses:
                if license_name == 'UNKNOWN':
                    severity = 'high'
                    message = "Unknown license - manual review required"
                else:
                    severity = 'medium'
                    message = f"License not in allowed list"
                    
                issues.append({
                    'package': package['Name'],
                    'version': package['Version'],
                    'license': license_name,
                    'type': 'not_allowed',
                    'severity': severity,
                    'message': message
                })
                
        return issues
    
    def generate_license_report(self):
        """ライセンスレポートを生成"""
        issues = self.check_dependencies()
        
        # ライセンス別に集計
        by_license = {}
        for package in self._get_all_packages():
            license_name = package['license']
            if license_name not in by_license:
                by_license[license_name] = []
            by_license[license_name].append(package['name'])
            
        report = """# License Compliance Report

## Summary
- Total packages: {}
- License issues found: {}
- High severity issues: {}

## License Distribution
""".format(
            self._count_packages(),
            len(issues),
            len([i for i in issues if i['severity'] == 'high'])
        )
        
        for license_name, packages in sorted(by_license.items()):
            report += f"\n### {license_name} ({len(packages)} packages)\n"
            if len(packages) <= 10:
                for pkg in packages:
                    report += f"- {pkg}\n"
            else:
                report += f"- {', '.join(packages[:5])}... and {len(packages)-5} more\n"
                
        if issues:
            report += "\n## Issues Found\n"
            
            # 重要度順にソート
            for issue in sorted(issues, key=lambda x: x['severity'], reverse=True):
                report += f"""
### {issue['package']} v{issue['version']}
- **License**: {issue['license']}
- **Type**: {issue['type']}
- **Severity**: {issue['severity']}
- **Issue**: {issue['message']}
"""
                
        report += "\n## Recommendations\n"
        report += self._generate_recommendations(issues)
        
        return report
    
    def check_license_compatibility(self, project_license, dependency_licenses):
        """ライセンスの互換性をチェック"""
        compatibility_matrix = {
            'MIT': {
                'compatible': ['MIT', 'BSD', 'Apache-2.0', 'ISC'],
                'incompatible': []
            },
            'Apache-2.0': {
                'compatible': ['MIT', 'BSD', 'Apache-2.0', 'ISC'],
                'incompatible': ['GPL-2.0']  # GPL-2.0とは非互換
            },
            'GPL-3.0': {
                'compatible': ['MIT', 'BSD', 'Apache-2.0', 'LGPL', 'GPL-3.0'],
                'incompatible': ['proprietary']
            }
        }
        
        issues = []
        project_compat = compatibility_matrix.get(project_license, {})
        
        for dep_license in dependency_licenses:
            if dep_license in project_compat.get('incompatible', []):
                issues.append({
                    'project_license': project_license,
                    'dependency_license': dep_license,
                    'issue': 'License incompatibility detected'
                })
                
        return issues
```

### ライセンスヘッダーの管理

#### 自動ヘッダー挿入
```python
# scripts/license_header.py
import os
from pathlib import Path
from datetime import datetime

class LicenseHeaderManager:
    def __init__(self, license_type='MIT', organization='AI Research Lab'):
        self.license_type = license_type
        self.organization = organization
        self.year = datetime.now().year
        
        self.headers = {
            'MIT': """# Copyright (c) {year} {organization}
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
""",
            'Apache-2.0': """# Copyright {year} {organization}
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""
        }
        
    def add_header_to_file(self, file_path):
        """ファイルにライセンスヘッダーを追加"""
        file_path = Path(file_path)
        
        # 既存の内容を読み込み
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # すでにヘッダーがある場合はスキップ
        if 'Copyright' in content[:500]:
            return False
            
        # ヘッダーを追加
        header = self.headers[self.license_type].format(
            year=self.year,
            organization=self.organization
        )
        
        # Shebangがある場合は、その後に挿入
        if content.startswith('#!'):
            lines = content.split('\n', 1)
            new_content = lines[0] + '\n' + header + '\n' + lines[1]
        else:
            new_content = header + '\n' + content
            
        # ファイルに書き込み
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        return True
    
    def add_headers_to_project(self, root_dir, extensions=['.py', '.js']):
        """プロジェクト全体にヘッダーを追加"""
        root_path = Path(root_dir)
        files_updated = 0
        
        for ext in extensions:
            for file_path in root_path.rglob(f'*{ext}'):
                # 除外パス
                if any(part in file_path.parts for part in 
                       ['venv', '__pycache__', 'node_modules', '.git']):
                    continue
                    
                if self.add_header_to_file(file_path):
                    files_updated += 1
                    print(f"Added header to: {file_path}")
                    
        return files_updated
```

## G.2 Export Control対応

### 暗号化技術の輸出規制

#### 輸出規制チェッカー
```python
# scripts/export_control.py
import re
from pathlib import Path

class ExportControlChecker:
    def __init__(self):
        # 規制対象となる可能性のある暗号化関連キーワード
        self.crypto_keywords = {
            'high_risk': [
                'AES', 'RSA', 'DES', 'Blowfish', 'Twofish',
                'encrypt', 'decrypt', 'cipher', 'cryptography'
            ],
            'medium_risk': [
                'hash', 'SHA', 'MD5', 'HMAC', 'signature',
                'public_key', 'private_key', 'symmetric_key'
            ],
            'ml_specific': [
                'homomorphic_encryption', 'secure_aggregation',
                'differential_privacy', 'secure_multiparty'
            ]
        }
        
    def scan_codebase(self, root_dir):
        """コードベースをスキャンして輸出規制対象を検出"""
        findings = []
        root_path = Path(root_dir)
        
        for py_file in root_path.rglob('*.py'):
            # ファイルを読み込み
            try:
                with open(py_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # キーワードをチェック
                file_findings = self._check_content(content, py_file)
                if file_findings:
                    findings.extend(file_findings)
                    
            except Exception as e:
                print(f"Error reading {py_file}: {e}")
                
        return findings
    
    def _check_content(self, content, file_path):
        """コンテンツに規制対象のキーワードが含まれるかチェック"""
        findings = []
        
        # インポート文をチェック
        imports = re.findall(r'^\s*(?:from|import)\s+([^\s]+)', 
                           content, re.MULTILINE)
        
        for imp in imports:
            if any(crypto in imp.lower() for crypto in ['crypto', 'cipher', 'ssl']):
                findings.append({
                    'file': str(file_path),
                    'type': 'import',
                    'risk': 'high',
                    'detail': f"Cryptographic import: {imp}",
                    'line': self._find_line_number(content, imp)
                })
                
        # 関数・クラス定義をチェック
        for risk_level, keywords in self.crypto_keywords.items():
            for keyword in keywords:
                pattern = rf'\b{keyword}\b'
                matches = re.finditer(pattern, content, re.IGNORECASE)
                
                for match in matches:
                    findings.append({
                        'file': str(file_path),
                        'type': 'keyword',
                        'risk': risk_level.replace('_risk', ''),
                        'detail': f"Found: {match.group()}",
                        'line': self._find_line_number(content, match.group(), 
                                                     match.start())
                    })
                    
        return findings
    
    def generate_eccn_classification(self, findings):
        """ECCN（輸出規制分類番号）の推定"""
        classification = {
            'likely_eccn': None,
            'confidence': 'low',
            'requires_review': True,
            'notes': []
        }
        
        # 暗号化機能の検出
        crypto_imports = [f for f in findings if 
                         f['type'] == 'import' and f['risk'] == 'high']
        
        if crypto_imports:
            classification['likely_eccn'] = '5D002'  # 暗号ソフトウェア
            classification['confidence'] = 'medium'
            classification['notes'].append(
                "Contains cryptographic functionality - likely subject to export controls"
            )
            
        # 機械学習特有の暗号化
        ml_crypto = [f for f in findings if 
                    any(kw in f['detail'] for kw in 
                        self.crypto_keywords['ml_specific'])]
        
        if ml_crypto:
            classification['notes'].append(
                "Contains ML-specific encryption (federated learning, etc.)"
            )
            
        return classification
    
    def generate_export_notice(self):
        """輸出規制通知を生成"""
        return """# Export Control Notice

This software may be subject to export control laws and regulations, including but not limited to:

- U.S. Export Administration Regulations (EAR)
- EU Dual-Use Regulation
- Wassenaar Arrangement

## Classification
- ECCN: 5D002 (Provisional - requires official classification)
- License Exception: TSU (Technology and Software - Unrestricted)

## Restricted Countries
This software may NOT be exported/re-exported to:
- Countries under U.S. embargo
- Entities on denied parties lists

## Cryptographic Notice
This distribution includes cryptographic software. The country in which you currently reside may have restrictions on the \
import, possession, use, and/or re-export to another country, of encryption software.

## Compliance Requirements
Before using or distributing this software:
1. Verify your local laws regarding encryption
2. Ensure compliance with all applicable export regulations
3. Maintain records of distribution for compliance purposes

## Contact
For export compliance questions: compliance@example.com
"""
```

### 地域制限の実装

#### アクセス制御
```python
# scripts/geo_restrictions.py
import requests
from functools import wraps

class GeoRestrictionManager:
    def __init__(self):
        # 制限対象国（例）
        self.restricted_countries = {
            'embargoed': ['CU', 'IR', 'KP', 'SY'],  # 完全禁輸
            'restricted': ['CN', 'RU'],  # 一部制限
        }
        
        # IPジオロケーションサービス
        self.geo_api_url = "https://ipapi.co/{ip}/json/"
        
    def check_ip_location(self, ip_address):
        """IPアドレスの地理的位置を確認"""
        try:
            response = requests.get(
                self.geo_api_url.format(ip=ip_address),
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'country_code': data.get('country_code'),
                    'country_name': data.get('country_name'),
                    'region': data.get('region'),
                    'city': data.get('city')
                }
        except Exception as e:
            print(f"Geolocation error: {e}")
            
        return None
    
    def is_restricted(self, country_code):
        """国が制限対象かチェック"""
        if country_code in self.restricted_countries['embargoed']:
            return 'embargoed'
        elif country_code in self.restricted_countries['restricted']:
            return 'restricted'
        return None
    
    def enforce_geo_restrictions(self, func):
        """デコレータ：地理的制限を強制"""
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            # リクエストからIPを取得
            ip = self.get_client_ip(request)
            location = self.check_ip_location(ip)
            
            if location:
                restriction = self.is_restricted(location['country_code'])
                
                if restriction == 'embargoed':
                    return {
                        'error': 'Access denied',
                        'message': 'This service is not available in your region due to export control regulations'
                    }, 403
                    
                elif restriction == 'restricted':
                    # 制限付きアクセス
                    kwargs['restricted_access'] = True
                    
            return func(request, *args, **kwargs)
            
        return wrapper
    
    def generate_distribution_log(self, download_info):
        """配布ログを生成（コンプライアンス用）"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'ip_address': download_info['ip'],
            'country': download_info.get('country'),
            'file': download_info['file'],
            'version': download_info['version'],
            'user_agent': download_info.get('user_agent'),
            'compliance_check': 'passed'
        }
        
        # ログをファイルに追記
        with open('distribution_log.jsonl', 'a') as f:
            f.write(json.dumps(log_entry) + '\n')
            
        return log_entry
```

## G.3 AIツール利用時の知的財産権配慮

### Copilot使用ポリシー

#### コード生成ガイドライン
```markdown
# AI Code Generation Policy

## Purpose
This policy governs the use of AI-powered code generation tools (GitHub Copilot, etc.) in our projects.

## Guidelines

### 1. Acceptable Use
- ✅ Boilerplate code generation
- ✅ Test case generation
- ✅ Documentation generation
- ✅ Code refactoring suggestions

### 2. Prohibited Use
- ❌ Generating entire modules without review
- ❌ Using suggestions that appear to be copyrighted
- ❌ Blindly accepting security-sensitive code

### 3. Review Requirements
All AI-generated code MUST be:
1. Thoroughly reviewed by a human developer
2. Tested for functionality and security
3. Checked for potential license issues
4. Modified to meet project standards

### 4. Attribution
- Document when significant portions are AI-generated
- Include comments for complex AI-generated algorithms
- Maintain a log of AI tool usage

### 5. Intellectual Property
- Ensure generated code doesn't infringe on third-party rights
- Verify that generated code aligns with project license
- Report any suspicious similarities to known codebases

### 6. Security Considerations
- Never use AI to generate cryptographic code
- Avoid AI generation for authentication/authorization
- Manually review all security-critical sections

## Compliance Checklist
- [ ] Generated code has been reviewed
- [ ] No obvious copyright infringement
- [ ] Security implications considered
- [ ] Appropriate documentation added
- [ ] Team lead approval for significant usage
```

### AI生成コードの追跡

#### メタデータ管理
```python
# scripts/ai_code_tracker.py
import ast
import json
from datetime import datetime
from pathlib import Path

class AICodeTracker:
    def __init__(self, metadata_file='ai_generated.json'):
        self.metadata_file = Path(metadata_file)
        self.metadata = self._load_metadata()
        
    def _load_metadata(self):
        """既存のメタデータを読み込み"""
        if self.metadata_file.exists():
            with open(self.metadata_file) as f:
                return json.load(f)
        return {'files': {}}
        
    def mark_ai_generated(self, file_path, lines, tool='copilot', confidence=0.8):
        """AI生成コードをマーク"""
        file_path = str(Path(file_path).resolve())
        
        if file_path not in self.metadata['files']:
            self.metadata['files'][file_path] = {
                'ai_sections': [],
                'last_reviewed': None
            }
            
        self.metadata['files'][file_path]['ai_sections'].append({
            'lines': lines,
            'tool': tool,
            'confidence': confidence,
            'marked_at': datetime.now().isoformat(),
            'reviewed': False
        })
        
        self._save_metadata()
        
    def add_review_comment(self, file_path, line_range, comment):
        """レビューコメントを追加"""
        file_path = str(Path(file_path).resolve())
        
        if file_path in self.metadata['files']:
            for section in self.metadata['files'][file_path]['ai_sections']:
                if section['lines'] == line_range:
                    section['review_comment'] = comment
                    section['reviewed'] = True
                    section['reviewed_at'] = datetime.now().isoformat()
                    
        self._save_metadata()
        
    def generate_ai_usage_report(self):
        """AI使用状況レポートを生成"""
        total_files = len(self.metadata['files'])
        total_sections = sum(
            len(file_data['ai_sections']) 
            for file_data in self.metadata['files'].values()
        )
        
        reviewed_sections = sum(
            sum(1 for section in file_data['ai_sections'] if section['reviewed'])
            for file_data in self.metadata['files'].values()
        )
        
        report = f"""# AI Code Generation Report

## Summary
- Files with AI-generated code: {total_files}
- Total AI-generated sections: {total_sections}
- Reviewed sections: {reviewed_sections} ({reviewed_sections/total_sections*100:.1f}%)

## Files Requiring Review
"""
        
        for file_path, file_data in self.metadata['files'].items():
            unreviewed = [s for s in file_data['ai_sections'] if not s['reviewed']]
            
            if unreviewed:
                report += f"\n### {Path(file_path).name}\n"
                for section in unreviewed:
                    report += f"- Lines {section['lines'][0]}-{section['lines'][1]}"
                    report += f" (Tool: {section['tool']}, Confidence: {section['confidence']:.1%})\n"
                    
        return report
    
    def check_similarity(self, code_snippet, threshold=0.8):
        """コードスニペットの類似性をチェック"""
        # 簡易的な類似性チェック（実際はより高度な手法を使用）
        from difflib import SequenceMatcher
        
        similar_snippets = []
        
        # 既知のコードベースと比較
        for known_file in Path('known_code').rglob('*.py'):
            with open(known_file) as f:
                known_code = f.read()
                
            # 類似度を計算
            similarity = SequenceMatcher(None, code_snippet, known_code).ratio()
            
            if similarity > threshold:
                similar_snippets.append({
                    'file': str(known_file),
                    'similarity': similarity,
                    'license': self._get_file_license(known_file)
                })
                
        return similar_snippets
    
    def _save_metadata(self):
        """メタデータを保存"""
        with open(self.metadata_file, 'w') as f:
            json.dump(self.metadata, f, indent=2)
```

## G.4 監査要件への対応

### 監査ログシステム

#### 包括的な監査ログ
```python
# scripts/audit_system.py
import hashlib
import json
from datetime import datetime
from enum import Enum

class AuditEventType(Enum):
    ACCESS_GRANTED = "access_granted"
    ACCESS_DENIED = "access_denied"
    DATA_DOWNLOAD = "data_download"
    MODEL_DEPLOYMENT = "model_deployment"
    CONFIGURATION_CHANGE = "configuration_change"
    SECURITY_INCIDENT = "security_incident"
    COMPLIANCE_CHECK = "compliance_check"

class AuditLogger:
    def __init__(self, log_file='audit_log.jsonl'):
        self.log_file = log_file
        
    def log_event(self, event_type, user, details, severity='info'):
        """監査イベントをログ"""
        event = {
            'id': self._generate_event_id(),
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type.value,
            'user': user,
            'severity': severity,
            'details': details,
            'hash': None  # 後で計算
        }
        
        # イベントのハッシュを計算（改ざん検知用）
        event['hash'] = self._calculate_hash(event)
        
        # ログファイルに追記
        with open(self.log_file, 'a') as f:
            f.write(json.dumps(event) + '\n')
            
        # 重要なイベントは即座に通知
        if severity in ['critical', 'high']:
            self._send_alert(event)
            
        return event['id']
    
    def verify_log_integrity(self):
        """ログの整合性を検証"""
        issues = []
        
        with open(self.log_file) as f:
            for line_num, line in enumerate(f, 1):
                try:
                    event = json.loads(line)
                    
                    # ハッシュを検証
                    stored_hash = event['hash']
                    event['hash'] = None
                    calculated_hash = self._calculate_hash(event)
                    
                    if stored_hash != calculated_hash:
                        issues.append({
                            'line': line_num,
                            'event_id': event['id'],
                            'issue': 'Hash mismatch - possible tampering'
                        })
                        
                except Exception as e:
                    issues.append({
                        'line': line_num,
                        'issue': f'Parse error: {str(e)}'
                    })
                    
        return issues
    
    def generate_audit_report(self, start_date=None, end_date=None):
        """監査レポートを生成"""
        events = self._load_events(start_date, end_date)
        
        report = {
            'period': {
                'start': start_date or 'all',
                'end': end_date or 'current'
            },
            'summary': {
                'total_events': len(events),
                'by_type': {},
                'by_severity': {},
                'by_user': {}
            },
            'critical_events': [],
            'compliance_status': 'compliant'
        }
        
        # イベントを集計
        for event in events:
            # タイプ別
            event_type = event['event_type']
            report['summary']['by_type'][event_type] = \
                report['summary']['by_type'].get(event_type, 0) + 1
                
            # 重要度別
            severity = event['severity']
            report['summary']['by_severity'][severity] = \
                report['summary']['by_severity'].get(severity, 0) + 1
                
            # ユーザー別
            user = event['user']
            report['summary']['by_user'][user] = \
                report['summary']['by_user'].get(user, 0) + 1
                
            # 重要イベント
            if event['severity'] in ['critical', 'high']:
                report['critical_events'].append(event)
                
        # コンプライアンス違反をチェック
        violations = self._check_compliance_violations(events)
        if violations:
            report['compliance_status'] = 'violations_found'
            report['violations'] = violations
            
        return report
    
    def _calculate_hash(self, event):
        """イベントのハッシュを計算"""
        # ハッシュフィールドを除外してJSON化
        event_copy = {k: v for k, v in event.items() if k != 'hash'}
        event_str = json.dumps(event_copy, sort_keys=True)
        
        return hashlib.sha256(event_str.encode()).hexdigest()
    
    def _check_compliance_violations(self, events):
        """コンプライアンス違反をチェック"""
        violations = []
        
        # 不正アクセスの試行
        failed_access = [e for e in events if 
                        e['event_type'] == AuditEventType.ACCESS_DENIED.value]
        
        # 同一ユーザーから短時間に複数の失敗
        from collections import defaultdict
        user_failures = defaultdict(list)
        
        for event in failed_access:
            user_failures[event['user']].append(event['timestamp'])
            
        for user, timestamps in user_failures.items():
            if len(timestamps) > 5:  # 5回以上の失敗
                violations.append({
                    'type': 'excessive_access_failures',
                    'user': user,
                    'count': len(timestamps),
                    'severity': 'high'
                })
                
        return violations
```

### レギュレーション対応

#### GDPR対応
```python
# scripts/gdpr_compliance.py
class GDPRCompliance:
    def __init__(self):
        self.personal_data_fields = [
            'email', 'name', 'phone', 'address', 'ip_address',
            'user_id', 'device_id', 'location'
        ]
        
    def anonymize_data(self, data, fields_to_anonymize=None):
        """個人データを匿名化"""
        fields = fields_to_anonymize or self.personal_data_fields
        anonymized = data.copy()
        
        for field in fields:
            if field in anonymized:
                if field == 'email':
                    # メールアドレスの匿名化
                    parts = anonymized[field].split('@')
                    anonymized[field] = f"{parts[0][:3]}****@{parts[1]}"
                    
                elif field == 'ip_address':
                    # IPアドレスの匿名化
                    parts = anonymized[field].split('.')
                    anonymized[field] = f"{parts[0]}.{parts[1]}.*.*"
                    
                else:
                    # その他のフィールドはハッシュ化
                    anonymized[field] = hashlib.sha256(
                        str(anonymized[field]).encode()
                    ).hexdigest()[:8]
                    
        return anonymized
    
    def handle_deletion_request(self, user_id):
        """削除リクエストの処理"""
        deletion_log = {
            'user_id': user_id,
            'requested_at': datetime.now().isoformat(),
            'status': 'pending',
            'affected_systems': []
        }
        
        # 各システムからデータを削除
        systems = ['database', 'logs', 'backups', 'analytics']
        
        for system in systems:
            try:
                self._delete_from_system(user_id, system)
                deletion_log['affected_systems'].append({
                    'system': system,
                    'status': 'deleted'
                })
            except Exception as e:
                deletion_log['affected_systems'].append({
                    'system': system,
                    'status': 'failed',
                    'error': str(e)
                })
                
        deletion_log['status'] = 'completed'
        deletion_log['completed_at'] = datetime.now().isoformat()
        
        return deletion_log
    
    def generate_privacy_report(self, user_id):
        """プライバシーレポートを生成（データポータビリティ）"""
        user_data = {
            'user_id': user_id,
            'generated_at': datetime.now().isoformat(),
            'data_categories': {}
        }
        
        # 各カテゴリーのデータを収集
        categories = [
            'profile_data',
            'activity_logs',
            'preferences',
            'generated_content'
        ]
        
        for category in categories:
            data = self._collect_user_data(user_id, category)
            if data:
                user_data['data_categories'][category] = data
                
        return user_data
```

## G.5 ポリシー違反の検出と対応

### 自動ポリシー検出

#### ポリシー違反検出器
```python
# scripts/policy_violation_detector.py
class PolicyViolationDetector:
    def __init__(self, policy_config='policies.yaml'):
        self.policies = self._load_policies(policy_config)
        self.violations = []
        
    def scan_repository(self, repo_path):
        """リポジトリ全体をスキャン"""
        scanners = [
            self.scan_credentials,
            self.scan_licenses,
            self.scan_security,
            self.scan_code_quality,
            self.scan_data_handling
        ]
        
        for scanner in scanners:
            violations = scanner(repo_path)
            self.violations.extend(violations)
            
        return self.violations
    
    def scan_credentials(self, repo_path):
        """認証情報の検出"""
        violations = []
        patterns = [
            (r'api[_-]?key\s*=\s*["\']([^"\']+)["\']', 'api_key'),
            (r'password\s*=\s*["\']([^"\']+)["\']', 'password'),
            (r'AWS[_-]?ACCESS[_-]?KEY[_-]?ID\s*=\s*([A-Z0-9]{20})', 'aws_key'),
            (r'-----BEGIN (RSA|DSA|EC) PRIVATE KEY-----', 'private_key')
        ]
        
        for file_path in Path(repo_path).rglob('*'):
            if file_path.is_file() and file_path.suffix in ['.py', '.js', '.yml']:
                try:
                    content = file_path.read_text()
                    
                    for pattern, cred_type in patterns:
                        matches = re.finditer(pattern, content, re.IGNORECASE)
                        for match in matches:
                            violations.append({
                                'type': 'credential_exposure',
                                'severity': 'critical',
                                'file': str(file_path),
                                'line': content[:match.start()].count('\n') + 1,
                                'credential_type': cred_type,
                                'remediation': 'Use environment variables or secret management'
                            })
                            
                except Exception as e:
                    continue
                    
        return violations
    
    def generate_violation_report(self):
        """違反レポートを生成"""
        report = f"""# Policy Violation Report

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary
Total violations found: {len(self.violations)}

### By Severity
"""
        
        # 重要度別に集計
        by_severity = {}
        for violation in self.violations:
            sev = violation['severity']
            by_severity[sev] = by_severity.get(sev, 0) + 1
            
        for severity in ['critical', 'high', 'medium', 'low']:
            if severity in by_severity:
                report += f"- {severity.upper()}: {by_severity[severity]}\n"
                
        report += "\n## Critical Violations\n"
        
        # 重要な違反を詳細表示
        critical = [v for v in self.violations if v['severity'] == 'critical']
        
        for violation in critical[:10]:  # 最初の10件
            report += f"""
### {violation['type']}
- **File**: {violation['file']}
- **Line**: {violation.get('line', 'N/A')}
- **Details**: {violation.get('details', 'N/A')}
- **Remediation**: {violation['remediation']}
"""
            
        return report
    
    def auto_remediate(self, violation):
        """可能な場合は自動修正"""
        if violation['type'] == 'missing_license_header':
            # ライセンスヘッダーを追加
            header_manager = LicenseHeaderManager()
            header_manager.add_header_to_file(violation['file'])
            return True
            
        elif violation['type'] == 'code_formatting':
            # コードフォーマットを修正
            subprocess.run(['black', violation['file']])
            return True
            
        # 自動修正できない場合
        return False
```

### インシデント対応プロセス

#### ポリシー違反時のワークフロー
```yaml
# .github/workflows/policy-enforcement.yml
name: Policy Enforcement

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # 週次スキャン

jobs:
  policy-check:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Run policy scanner
        id: scan
        run: |
          python scripts/policy_violation_detector.py > violations.json
          
          # 重大な違反があるかチェック
          CRITICAL=$(jq '[.[] | select(.severity == "critical")] | length' violations.json)
          
          if [ $CRITICAL -gt 0 ]; then
            echo "critical_found=true" >> $GITHUB_OUTPUT
          fi
          
      - name: Create issue for violations
        if: steps.scan.outputs.critical_found == 'true'
        uses: actions/github-script@v6
        with:
          script: |
            const violations = require('./violations.json');
            const critical = violations.filter(v => v.severity === 'critical');
            
            const issueBody = `## 🚨 Critical Policy Violations Detected
            
            Found ${critical.length} critical violations that require immediate attention.
            
            ### Violations:
            ${critical.map(v => `- **${v.type}** in \`${v.file}\` (line ${v.line})`).join('\n')}
            
            ### Required Actions:
            1. Review the violations
            2. Apply recommended remediations
            3. Re-run the policy check
            
            cc @security-team
            `;
            
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Critical Policy Violations',
              body: issueBody,
              labels: ['security', 'critical', 'policy-violation']
            });
            
      - name: Block PR if critical violations
        if: github.event_name == 'pull_request' && steps.scan.outputs.critical_found == 'true'
        run: |
          echo "Critical policy violations found. PR cannot be merged."
          exit 1
          
      - name: Upload violation report
        uses: actions/upload-artifact@v4
        with:
          name: policy-violations
          path: |
            violations.json
            violation_report.html
```

## まとめ

本章では、コンプライアンスとガバナンスについて学習しました：
- オープンソースライセンスの適切な選択と管理
- 輸出規制への対応と地域制限の実装
- AI生成コードの知的財産権管理
- 包括的な監査ログとレポート生成
- ポリシー違反の自動検出と対応

## 確認事項

- [ ] プロジェクトに適切なライセンスを選択できる
- [ ] 依存関係のライセンス互換性を確認できる
- [ ] 輸出規制に対応した実装ができる
- [ ] AI生成コードを適切に管理できる
- [ ] 監査要件を満たすシステムを構築できる
