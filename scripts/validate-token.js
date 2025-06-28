#!/usr/bin/env node

/**
 * Deployment Token Validator
 * 
 * This script validates GitHub Personal Access Tokens for deployment use.
 * It checks:
 * - Token validity and authentication
 * - Required permission scopes
 * - Token expiration status
 * - Access to target repositories
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class TokenValidator {
  constructor(token, options = {}) {
    this.token = token;
    this.options = {
      checkExpiration: true,
      checkRepoAccess: true,
      verbose: false,
      ...options
    };
    this.results = {
      valid: false,
      authenticated: false,
      scopes: [],
      expiresAt: null,
      daysUntilExpiration: null,
      repoAccess: {},
      warnings: [],
      errors: []
    };
  }

  async validate() {
    try {
      console.log('🔍 トークンの検証を開始しています...\n');

      // 1. Basic authentication check
      await this.checkAuthentication();
      
      if (!this.results.authenticated) {
        return this.results;
      }

      // 2. Check scopes
      await this.checkScopes();

      // 3. Check expiration if enabled
      if (this.options.checkExpiration) {
        await this.checkExpiration();
      }

      // 4. Check repository access if enabled
      if (this.options.checkRepoAccess) {
        await this.checkRepositoryAccess();
      }

      // Determine overall validity
      this.results.valid = this.results.authenticated && 
                          this.hasRequiredScopes() && 
                          !this.isExpiringSoon();

      this.printResults();
      return this.results;

    } catch (error) {
      this.results.errors.push(`検証中にエラーが発生しました: ${error.message}`);
      console.error('❌ エラー:', error.message);
      return this.results;
    }
  }

  async checkAuthentication() {
    try {
      const data = await this.makeGitHubRequest('/user');
      this.results.authenticated = true;
      console.log('✅ 認証: 成功');
      
      if (this.options.verbose) {
        console.log(`   ユーザー: ${data.login}`);
        console.log(`   アカウントタイプ: ${data.type}`);
      }
    } catch (error) {
      this.results.authenticated = false;
      this.results.errors.push('トークンが無効です');
      console.log('❌ 認証: 失敗');
    }
  }

  async checkScopes() {
    try {
      // Get token scopes from response headers
      const response = await this.makeGitHubRequestWithHeaders('/user');
      const scopeHeader = response.headers['x-oauth-scopes'];
      
      if (scopeHeader) {
        this.results.scopes = scopeHeader.split(',').map(s => s.trim()).filter(Boolean);
      }

      console.log('🔑 権限スコープ:');
      if (this.results.scopes.length === 0) {
        console.log('   スコープが検出されませんでした');
        this.results.warnings.push('トークンのスコープが検出できませんでした');
      } else {
        this.results.scopes.forEach(scope => {
          const isRequired = this.isRequiredScope(scope);
          const status = isRequired ? '✅' : '  ';
          console.log(`   ${status} ${scope}`);
        });
      }

      // Check for missing required scopes
      const missing = this.getMissingRequiredScopes();
      if (missing.length > 0) {
        console.log('\n⚠️  不足している必須スコープ:');
        missing.forEach(scope => {
          console.log(`   ❌ ${scope}`);
        });
        this.results.warnings.push(`不足スコープ: ${missing.join(', ')}`);
      }

    } catch (error) {
      this.results.warnings.push('スコープの確認に失敗しました');
      console.log('⚠️  スコープの確認に失敗しました');
    }
  }

  async checkExpiration() {
    try {
      // Note: GitHub API doesn't directly expose token expiration for classic PATs
      // This is a placeholder for future enhancement or when using fine-grained PATs
      console.log('📅 有効期限: チェック機能は今後実装予定');
      this.results.warnings.push('有効期限の自動チェックは今後実装予定です。手動でトークンの期限をご確認ください。');
    } catch (error) {
      this.results.warnings.push('有効期限の確認に失敗しました');
    }
  }

  async checkRepositoryAccess() {
    try {
      // Load repository configuration
      const config = this.loadRepositoryConfig();
      
      if (!config) {
        this.results.warnings.push('リポジトリ設定が見つからないため、アクセス確認をスキップします');
        return;
      }

      console.log('\n🏛️  リポジトリアクセス確認:');

      // Check access to public repository if configured
      if (config.publicRepoUrl) {
        const repoInfo = this.parseGitHubUrl(config.publicRepoUrl);
        if (repoInfo) {
          await this.checkRepoAccess(repoInfo.owner, repoInfo.repo, 'public');
        }
      }

      // Check access to private repository if configured  
      if (config.privateRepo) {
        const repoInfo = this.parseRepoString(config.privateRepo);
        if (repoInfo) {
          await this.checkRepoAccess(repoInfo.owner, repoInfo.repo, 'private');
        }
      }

    } catch (error) {
      this.results.warnings.push('リポジトリアクセスの確認に失敗しました');
      console.log('⚠️  リポジトリアクセスの確認に失敗しました');
    }
  }

  async checkRepoAccess(owner, repo, type) {
    try {
      await this.makeGitHubRequest(`/repos/${owner}/${repo}`);
      this.results.repoAccess[`${owner}/${repo}`] = true;
      console.log(`   ✅ ${owner}/${repo} (${type})`);
    } catch (error) {
      this.results.repoAccess[`${owner}/${repo}`] = false;
      console.log(`   ❌ ${owner}/${repo} (${type}) - アクセス不可`);
      this.results.warnings.push(`${owner}/${repo} への アクセスが確認できませんでした`);
    }
  }

  loadRepositoryConfig() {
    const configPaths = [
      'template-config.json',
      'book-config.json',
      'package.json'
    ];

    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          return config;
        }
      } catch (error) {
        // Ignore parsing errors and try next file
      }
    }

    return null;
  }

  parseGitHubUrl(url) {
    const match = url.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    return null;
  }

  parseRepoString(repoString) {
    const match = repoString.match(/^([^\/]+)\/([^\/]+)$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    return null;
  }

  isRequiredScope(scope) {
    const requiredScopes = ['repo', 'workflow'];
    const optionalScopes = ['admin:org', 'read:org'];
    return requiredScopes.includes(scope);
  }

  getMissingRequiredScopes() {
    const requiredScopes = ['repo'];
    return requiredScopes.filter(scope => !this.results.scopes.includes(scope));
  }

  hasRequiredScopes() {
    return this.getMissingRequiredScopes().length === 0;
  }

  isExpiringSoon() {
    // Placeholder for expiration logic
    return false;
  }

  printResults() {
    console.log('\n📊 検証結果:');
    console.log(`   認証: ${this.results.authenticated ? '✅ 成功' : '❌ 失敗'}`);
    console.log(`   必須スコープ: ${this.hasRequiredScopes() ? '✅ OK' : '❌ 不足'}`);
    console.log(`   総合判定: ${this.results.valid ? '✅ 利用可能' : '❌ 設定が必要'}`);

    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  警告:');
      this.results.warnings.forEach(warning => {
        console.log(`   • ${warning}`);
      });
    }

    if (this.results.errors.length > 0) {
      console.log('\n❌ エラー:');
      this.results.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }

    if (!this.results.valid) {
      console.log('\n💡 推奨アクション:');
      if (!this.results.authenticated) {
        console.log('   1. 新しいPersonal Access Tokenを生成してください');
        console.log('   2. トークンが正しく設定されているか確認してください');
      }
      if (!this.hasRequiredScopes()) {
        console.log('   1. トークンに "repo" スコープを追加してください');
        console.log('   2. GitHub Actions を使用する場合は "workflow" スコープも追加してください');
      }
    }
  }

  makeGitHubRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: path,
        method: 'GET',
        headers: {
          'Authorization': `token ${this.token}`,
          'User-Agent': 'book-publishing-template-validator',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => reject(new Error('Request timeout')));
      req.end();
    });
  }

  makeGitHubRequestWithHeaders(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: path,
        method: 'GET',
        headers: {
          'Authorization': `token ${this.token}`,
          'User-Agent': 'book-publishing-template-validator',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ 
                data: JSON.parse(data),
                headers: res.headers
              });
            } catch (error) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => reject(new Error('Request timeout')));
      req.end();
    });
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const token = process.env.GITHUB_TOKEN || process.env.DEPLOY_TOKEN || args[0];

  if (!token) {
    console.error('❌ エラー: GitHubトークンが指定されていません');
    console.error('');
    console.error('使用方法:');
    console.error('  node scripts/validate-token.js <token>');
    console.error('  GITHUB_TOKEN=<token> node scripts/validate-token.js');
    console.error('  DEPLOY_TOKEN=<token> node scripts/validate-token.js');
    process.exit(1);
  }

  const validator = new TokenValidator(token, {
    verbose: args.includes('--verbose') || args.includes('-v'),
    checkExpiration: !args.includes('--no-expiration'),
    checkRepoAccess: !args.includes('--no-repo-check')
  });

  validator.validate().then(results => {
    process.exit(results.valid ? 0 : 1);
  });
}

module.exports = { TokenValidator };