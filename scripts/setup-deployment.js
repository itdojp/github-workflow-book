#!/usr/bin/env node

/**
 * デプロイ設定セットアップスクリプト
 * デプロイトークンの設定を簡素化します
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// カラー出力
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(level, message) {
  const color = colors[level] || colors.reset;
  console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
}

// ユーザー入力を取得
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// パッケージ情報を読み込み
async function loadPackageInfo() {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const content = await fs.readFile(packagePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

// 設定ファイルを読み込み/作成
async function loadDeployConfig() {
  const configPath = path.join(__dirname, '..', '.deploy-config.json');
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // 設定ファイルが存在しない場合はデフォルト値を返す
    return {
      publicRepo: '',
      deployBranch: 'gh-pages',
      buildDir: 'public'
    };
  }
}

// 設定ファイルを保存
async function saveDeployConfig(config) {
  const configPath = path.join(__dirname, '..', '.deploy-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// GitHubのユーザー名とリポジトリ名を推測
function parseGitHubInfo(packageInfo) {
  const repository = packageInfo.repository;
  if (repository && repository.url) {
    const match = repository.url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return {
        username: match[1],
        repoName: match[2]
      };
    }
  }
  return { username: '', repoName: '' };
}

// 環境変数を設定するためのヘルプを表示
function showEnvironmentHelp(config) {
  log('blue', '\n🔧 環境変数の設定方法:');
  
  console.log('\n1. GitHub Personal Access Token を作成:');
  console.log('   https://github.com/settings/tokens/new');
  console.log('   - Note: "Book deployment"');
  console.log('   - Expiration: 必要に応じて設定');
  console.log('   - Scopes: ✅ repo');
  
  console.log('\n2. 環境変数を設定:');
  
  if (config.isGitHubActions) {
    console.log('\n   📁 GitHub Actions (推奨):');
    console.log('   - Settings → Secrets and variables → Actions');
    console.log('   - New repository secret');
    console.log('   - Name: GITHUB_TOKEN');
    console.log('   - Value: [作成したトークン]');
    
    console.log('\n   📋 GitHub Actions環境変数:');
    console.log(`   PUBLIC_REPO_URL: "${config.publicRepo}"`);
    console.log(`   DEPLOY_BRANCH: "${config.deployBranch}"`);
    console.log(`   BUILD_DIR: "${config.buildDir}"`);
  } else {
    console.log('\n   🖥️  ローカル環境:');
    console.log('   ```bash');
    console.log(`   export GITHUB_TOKEN="ghp_あなたのトークン"`);
    console.log(`   export PUBLIC_REPO_URL="${config.publicRepo}"`);
    console.log(`   export DEPLOY_BRANCH="${config.deployBranch}"`);
    console.log(`   export BUILD_DIR="${config.buildDir}"`);
    console.log('   ```');
    
    console.log('\n   または .env ファイルを作成:');
    console.log('   ```');
    console.log(`   GITHUB_TOKEN=ghp_あなたのトークン`);
    console.log(`   PUBLIC_REPO_URL=${config.publicRepo}`);
    console.log(`   DEPLOY_BRANCH=${config.deployBranch}`);
    console.log(`   BUILD_DIR=${config.buildDir}`);
    console.log('   ```');
  }
}

// .env ファイルを作成
async function createEnvFile(config) {
  const envPath = path.join(__dirname, '..', '.env.example');
  const envContent = `# Book Publishing Template Environment Variables
# Copy this file to .env and fill in your values

# GitHub Personal Access Token (required)
# Create at: https://github.com/settings/tokens/new
# Scopes needed: repo
GITHUB_TOKEN=ghp_your_token_here

# Public repository URL (required)
PUBLIC_REPO_URL=${config.publicRepo}

# Optional settings (use defaults if not specified)
DEPLOY_BRANCH=${config.deployBranch}
BUILD_DIR=${config.buildDir}

# Git user information (optional)
GIT_USER_EMAIL=your-email@example.com
GIT_USER_NAME=Your Name
`;

  await fs.writeFile(envPath, envContent, 'utf-8');
  log('green', `✅ 環境変数テンプレートを作成しました: .env.example`);
}

// GitHub Actions ワークフローを更新
async function updateGitHubActions(config) {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'deploy.yml');
  
  try {
    let content = await fs.readFile(workflowPath, 'utf-8');
    
    // 環境変数の設定セクションを更新
    const envSection = `      - name: Setup environment variables
        run: |
          echo "PUBLIC_REPO_URL=${config.publicRepo}" >> $GITHUB_ENV
          echo "DEPLOY_BRANCH=${config.deployBranch}" >> $GITHUB_ENV
          echo "BUILD_DIR=${config.buildDir}" >> $GITHUB_ENV`;
    
    // 既存の環境変数設定を置換
    content = content.replace(
      /- name: Setup environment variables[\s\S]*?echo "BUILD_DIR.*?" >> \$GITHUB_ENV/,
      envSection
    );
    
    await fs.writeFile(workflowPath, content, 'utf-8');
    log('green', '✅ GitHub Actions ワークフローを更新しました');
  } catch (error) {
    log('yellow', `⚠️  GitHub Actions ワークフローの更新に失敗: ${error.message}`);
  }
}

// メイン関数
async function main() {
  console.log('🚀 Book Publishing Template - デプロイ設定セットアップ\n');
  
  // 既存の設定を読み込み
  const packageInfo = await loadPackageInfo();
  const existingConfig = await loadDeployConfig();
  const githubInfo = parseGitHubInfo(packageInfo);
  
  log('blue', '現在の設定を確認します...');
  
  // 設定を対話的に収集
  const config = { ...existingConfig };
  
  // 公開リポジトリURL
  if (!config.publicRepo) {
    const suggestedRepo = githubInfo.username && githubInfo.repoName 
      ? `https://github.com/${githubInfo.username}/${githubInfo.repoName}-public.git`
      : '';
    
    const publicRepo = await askQuestion(
      `📁 公開リポジトリのURL ${suggestedRepo ? `[${suggestedRepo}]` : ''}: `
    );
    config.publicRepo = publicRepo || suggestedRepo;
  }
  
  // デプロイブランチ
  const deployBranch = await askQuestion(
    `🌳 デプロイブランチ名 [${config.deployBranch}]: `
  );
  if (deployBranch) config.deployBranch = deployBranch;
  
  // ビルドディレクトリ
  const buildDir = await askQuestion(
    `📦 ビルド出力ディレクトリ [${config.buildDir}]: `
  );
  if (buildDir) config.buildDir = buildDir;
  
  // GitHub Actions の使用確認
  const useGitHubActions = await askQuestion(
    '🤖 GitHub Actions を使用しますか？ [Y/n]: '
  );
  config.isGitHubActions = !useGitHubActions || useGitHubActions.toLowerCase().startsWith('y');
  
  // 設定を保存
  await saveDeployConfig(config);
  log('green', '✅ デプロイ設定を保存しました: .deploy-config.json');
  
  // .env ファイルを作成
  await createEnvFile(config);
  
  // GitHub Actions を更新
  if (config.isGitHubActions) {
    await updateGitHubActions(config);
  }
  
  // ヘルプを表示
  showEnvironmentHelp(config);
  
  console.log('\n🎉 セットアップが完了しました！');
  console.log('\n次のステップ:');
  console.log('1. GitHub Personal Access Token を作成');
  console.log('2. 環境変数を設定');
  console.log('3. npm run deploy でデプロイを実行');
  
  // .gitignore に .deploy-config.json を追加するかチェック
  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  try {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes('.deploy-config.json')) {
      await fs.appendFile(gitignorePath, '\n# Deployment configuration\n.deploy-config.json\n.env\n');
      log('green', '✅ .gitignore を更新しました');
    }
  } catch (error) {
    log('yellow', '⚠️  .gitignore の更新に失敗しました');
  }
  
  // シークレット設定の案内
  console.log('\n' + '='.repeat(50) + '\n');
  log('yellow', '🔐 次のステップ: GitHub Actions シークレットの設定\n');
  
  const needsDeployToken = config.publicRepo && 
    config.publicRepo.includes('github.com/') && 
    !config.publicRepo.includes(process.env.GITHUB_REPOSITORY || '');
  
  if (needsDeployToken) {
    log('cyan', '異なる組織へのデプロイが検出されました。');
    log('cyan', 'DEPLOY_TOKEN の設定が必要です。\n');
  }
  
  log('bright', '以下のコマンドでシークレットを設定してください:');
  log('green', '  npm run setup:secrets\n');
  
  log('cyan', 'または、現在の設定状況を確認:');
  log('green', '  npm run secrets:check\n');
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  log('red', `❌ エラー: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log('red', `❌ エラー: ${error.message}`);
  process.exit(1);
});

// 実行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };