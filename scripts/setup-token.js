#!/usr/bin/env node

/**
 * Deployment Token Setup Wizard
 * 
 * Interactive wizard to guide users through the deployment token setup process.
 * Simplifies the complex token creation and configuration process.
 */

const readline = require('readline');
const fs = require('fs');
const { TokenValidator } = require('./validate-token.js');

class TokenSetupWizard {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.config = {};
  }

  async start() {
    console.log('🚀 Book Publishing Template - デプロイトークンセットアップウィザード\n');
    console.log('このウィザードでは、デプロイに必要なGitHubトークンの設定を行います。\n');

    try {
      await this.detectConfiguration();
      await this.checkExistingToken();
      await this.guideTokenCreation();
      await this.validateToken();
      await this.setupSecrets();
      await this.showNextSteps();
    } catch (error) {
      console.error('❌ エラー:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  async detectConfiguration() {
    console.log('📋 設定の検出中...\n');

    // Try to load existing configuration
    const configFiles = ['template-config.json', 'book-config.json'];
    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        try {
          this.config = JSON.parse(fs.readFileSync(file, 'utf8'));
          console.log(`✅ 設定ファイルを読み込みました: ${file}`);
          break;
        } catch (error) {
          console.log(`⚠️  ${file} の読み込みに失敗しました`);
        }
      }
    }

    // Detect repository URLs from package.json
    if (fs.existsSync('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        if (pkg.repository && pkg.repository.url) {
          this.config.repositoryUrl = pkg.repository.url;
        }
      } catch (error) {
        // Ignore
      }
    }

    if (Object.keys(this.config).length > 0) {
      console.log('検出された設定:');
      if (this.config.githubUsername) {
        console.log(`   GitHubユーザー名: ${this.config.githubUsername}`);
      }
      if (this.config.publicRepoName) {
        console.log(`   パブリックリポジトリ: ${this.config.publicRepoName}`);
      }
      if (this.config.privateRepoName) {
        console.log(`   プライベートリポジトリ: ${this.config.privateRepoName}`);
      }
      console.log('');
    }
  }

  async checkExistingToken() {
    console.log('🔍 既存のトークン確認...\n');

    const tokenSources = [
      { name: 'GITHUB_TOKEN', value: process.env.GITHUB_TOKEN },
      { name: 'DEPLOY_TOKEN', value: process.env.DEPLOY_TOKEN }
    ];

    for (const source of tokenSources) {
      if (source.value) {
        console.log(`環境変数 ${source.name} が見つかりました。検証中...`);
        
        const validator = new TokenValidator(source.value);
        const results = await validator.validate();
        
        if (results.valid) {
          console.log('✅ 既存のトークンが有効です！');
          const useExisting = await this.askQuestion('既存のトークンを使用しますか？ (y/N): ');
          if (useExisting.toLowerCase() === 'y' || useExisting.toLowerCase() === 'yes') {
            this.config.token = source.value;
            await this.showNextSteps();
            return;
          }
        } else {
          console.log('❌ 既存のトークンに問題があります。新しいトークンを作成することをお勧めします。');
        }
        console.log('');
      }
    }
  }

  async guideTokenCreation() {
    console.log('🔑 新しいPersonal Access Tokenの作成\n');
    
    console.log('GitHubでPersonal Access Tokenを作成する必要があります。');
    console.log('以下の手順に従ってください：\n');

    console.log('1. GitHubにログインして以下のURLにアクセス:');
    console.log('   https://github.com/settings/tokens/new\n');

    console.log('2. 以下の項目を設定:');
    console.log('   • Note: "Book Publishing Template Deployment"');
    console.log('   • Expiration: "90 days" (推奨)');
    console.log('   • Scopes:');
    console.log('     ✅ repo (Full control of private repositories) ※必須');
    console.log('     ✅ workflow (Update GitHub Action workflows) ※GitHub Actions使用時');
    
    // Show organization-specific instructions if applicable
    if (this.config.githubUsername && this.config.githubUsername.includes('-') || 
        (this.config.repositoryUrl && this.config.repositoryUrl.includes('github.com/'))) {
      console.log('\n   組織のリポジトリを使用する場合、追加で以下も必要な場合があります:');
      console.log('     ⚡ admin:org (組織のサードパーティアクセス制限設定による)');
      console.log('     ⚡ read:org (組織のメンバーシップ確認が必要な場合)');
    }

    console.log('\n3. "Generate token" をクリック');
    console.log('4. 生成されたトークンをコピー (一度しか表示されません!)\n');

    await this.waitForUserConfirmation('準備ができたら Enter キーを押してください...');
  }

  async validateToken() {
    console.log('🔍 トークンの検証\n');

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const token = await this.askQuestion('作成したトークンを貼り付けてください: ', true);
      
      if (!token || token.trim().length === 0) {
        console.log('❌ トークンが入力されていません。もう一度お試しください。\n');
        attempts++;
        continue;
      }

      console.log('\n検証中...');
      const validator = new TokenValidator(token.trim(), { verbose: false });
      const results = await validator.validate();

      if (results.valid) {
        console.log('\n✅ トークンの検証が完了しました！');
        this.config.token = token.trim();
        return;
      } else {
        console.log('\n❌ トークンに問題があります:');
        results.errors.forEach(error => console.log(`   • ${error}`));
        results.warnings.forEach(warning => console.log(`   • ${warning}`));
        
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`\nもう一度トークンを確認してください。 (${attempts}/${maxAttempts})`);
          const retry = await this.askQuestion('再試行しますか？ (Y/n): ');
          if (retry.toLowerCase() === 'n' || retry.toLowerCase() === 'no') {
            break;
          }
        }
      }
    }

    throw new Error('有効なトークンを設定できませんでした。');
  }

  async setupSecrets() {
    console.log('\n🔐 GitHub Secretsの設定\n');

    const repoName = this.config.privateRepoName || 'your-private-repo';
    const username = this.config.githubUsername || 'YOUR_USERNAME';

    console.log('GitHub Actionsでトークンを使用するため、リポジトリのSecretsに設定する必要があります。\n');

    console.log('以下の手順に従ってください:');
    console.log(`1. https://github.com/${username}/${repoName}/settings/secrets/actions にアクセス`);
    console.log('2. "New repository secret" をクリック');
    console.log('3. 以下を設定:');
    console.log('   • Name: DEPLOY_TOKEN');
    console.log(`   • Value: ${this.config.token.substring(0, 8)}... (先ほど検証したトークン)`);
    console.log('4. "Add secret" をクリック\n');

    // Option to set environment variable for local development
    const setupLocal = await this.askQuestion('ローカル開発用に環境変数も設定しますか？ (y/N): ');
    if (setupLocal.toLowerCase() === 'y' || setupLocal.toLowerCase() === 'yes') {
      console.log('\nローカル環境での設定:');
      console.log('以下のコマンドをターミナルで実行してください:\n');
      console.log(`export GITHUB_TOKEN="${this.config.token}"`);
      console.log(`export DEPLOY_TOKEN="${this.config.token}"`);
      
      if (this.config.publicRepoName) {
        const publicUrl = `https://github.com/${username}/${this.config.publicRepoName}.git`;
        console.log(`export PUBLIC_REPO_URL="${publicUrl}"`);
      }
      
      console.log('\n永続化するには ~/.bashrc または ~/.zshrc に追加してください。');
    }

    await this.waitForUserConfirmation('\nSecretsの設定が完了したら Enter キーを押してください...');
  }

  async showNextSteps() {
    console.log('\n🎉 セットアップ完了！\n');

    console.log('✅ デプロイトークンの設定が完了しました。');
    console.log('\n📋 次のステップ:');

    if (!fs.existsSync('public') && !fs.existsSync('dist')) {
      console.log('1. コンテンツをビルド:');
      console.log('   npm run build');
    }

    console.log('2. 初回デプロイを実行:');
    console.log('   npm run deploy:full');

    console.log('\n3. GitHub Actionsの確認:');
    if (this.config.githubUsername && this.config.privateRepoName) {
      console.log(`   https://github.com/${this.config.githubUsername}/${this.config.privateRepoName}/actions`);
    } else {
      console.log('   リポジトリのActionsタブで自動デプロイを確認');
    }

    console.log('\n💡 ヒント:');
    console.log('• トークンは定期的に期限切れになります。その際はこのウィザードを再実行してください。');
    console.log('• トークンの検証: npm run validate-token');
    console.log('• セットアップの再実行: npm run setup-token');

    console.log('\n🔗 詳細なドキュメント:');
    console.log('• deployment-guide.md - デプロイメントの詳細');
    console.log('• docs/troubleshooting.md - トラブルシューティング');
  }

  askQuestion(question, hideInput = false) {
    return new Promise((resolve) => {
      if (hideInput) {
        // For password/token input, disable echo
        this.rl.stdoutMuted = true;
        this.rl._writeToOutput = function(stringToWrite) {
          if (this.stdoutMuted) {
            this.output.write('*');
          } else {
            this.output.write(stringToWrite);
          }
        };
      }

      this.rl.question(question, (answer) => {
        if (hideInput) {
          this.rl.stdoutMuted = false;
          this.rl._writeToOutput = function(stringToWrite) {
            this.output.write(stringToWrite);
          };
          console.log(''); // New line after hidden input
        }
        resolve(answer);
      });
    });
  }

  waitForUserConfirmation(message) {
    return new Promise((resolve) => {
      this.rl.question(message, () => {
        resolve();
      });
    });
  }
}

// CLI usage
if (require.main === module) {
  const wizard = new TokenSetupWizard();
  wizard.start().catch(error => {
    console.error('❌ セットアップに失敗しました:', error.message);
    process.exit(1);
  });
}

module.exports = { TokenSetupWizard };