#!/usr/bin/env node

/**
 * シークレット管理セットアップツール
 * GitHub Actionsのシークレットを簡単に設定・検証
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// カラー出力
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// シークレットテンプレート
const SECRETS_TEMPLATE = {
  required: [
    {
      name: 'DEPLOY_TOKEN',
      description: 'デプロイ用のGitHubトークン（異なる組織へのデプロイ時のみ必要）',
      scopes: ['repo'],
      optional: true,
      note: '同一組織内のデプロイではGITHUB_TOKENが自動的に使用されます'
    }
  ],
  optional: [
    {
      name: 'PUBLIC_REPO_URL',
      description: '公開先リポジトリのカスタムURL',
      format: 'https://github.com/owner/repo.git',
      example: 'https://github.com/yourorg/your-book-public.git'
    },
    {
      name: 'GIT_USER_EMAIL',
      description: 'Git コミット用のメールアドレス',
      default: 'actions@github.com'
    },
    {
      name: 'GIT_USER_NAME',
      description: 'Git コミット用のユーザー名',
      default: 'GitHub Actions'
    },
    {
      name: 'CNAME',
      description: 'カスタムドメイン（GitHub Pages用）',
      example: 'book.example.com'
    }
  ]
};

// ユーティリティ関数
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}\n`);
}

async function question(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// GitHub CLIのチェック
function checkGHCLI() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// GitHub認証状態のチェック
function checkGHAuth() {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 現在のリポジトリ情報を取得
function getRepoInfo() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (error) {
    log('Git リポジトリ情報を取得できませんでした', 'yellow');
  }
  return null;
}

// シークレットの存在確認
async function checkSecret(secretName) {
  try {
    execSync(`gh secret list --json name | grep -q "${secretName}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// シークレットの設定
async function setSecret(secretName, secretValue) {
  try {
    const tempFile = path.join(__dirname, '.temp-secret');
    await fs.writeFile(tempFile, secretValue);
    execSync(`gh secret set ${secretName} < "${tempFile}"`, { stdio: 'inherit' });
    await fs.unlink(tempFile);
    return true;
  } catch (error) {
    log(`エラー: ${secretName} の設定に失敗しました`, 'red');
    return false;
  }
}

// シークレットテンプレートファイルの生成
async function generateSecretsTemplate() {
  const templatePath = path.join(process.cwd(), '.github', 'secrets-template.yml');
  const content = `# GitHub Actions シークレットテンプレート
# このファイルは設定が必要なシークレットの参考情報です
# 実際の値は GitHub の Settings > Secrets で設定してください

secrets:
  # 必須シークレット（条件による）
  required:
${SECRETS_TEMPLATE.required.map(secret => `    - name: ${secret.name}
      description: "${secret.description}"
      scopes: ${JSON.stringify(secret.scopes || [])}
      optional: ${secret.optional || false}
      note: "${secret.note || ''}"
`).join('\n')}

  # オプションシークレット
  optional:
${SECRETS_TEMPLATE.optional.map(secret => `    - name: ${secret.name}
      description: "${secret.description}"
      ${secret.format ? `format: "${secret.format}"` : ''}
      ${secret.example ? `example: "${secret.example}"` : ''}
      ${secret.default ? `default: "${secret.default}"` : ''}
`).join('\n')}

# 設定方法:
# 1. GitHub リポジトリの Settings > Secrets and variables > Actions
# 2. "New repository secret" をクリック
# 3. Name と Value を入力して保存
#
# または、このツールを使用:
# npm run setup:secrets
`;

  await fs.mkdir(path.dirname(templatePath), { recursive: true });
  await fs.writeFile(templatePath, content);
  log(`✅ シークレットテンプレートを生成しました: ${templatePath}`, 'green');
}

// 対話的セットアップ
async function interactiveSetup() {
  logSection('GitHub Actions シークレット設定');

  // GitHub CLI のチェック
  if (!checkGHCLI()) {
    log('❌ GitHub CLI (gh) がインストールされていません', 'red');
    log('インストール方法: https://cli.github.com/', 'yellow');
    return;
  }

  // GitHub 認証チェック
  if (!checkGHAuth()) {
    log('❌ GitHub CLI が認証されていません', 'red');
    log('実行してください: gh auth login', 'yellow');
    return;
  }

  const repoInfo = getRepoInfo();
  if (repoInfo) {
    log(`📦 リポジトリ: ${repoInfo.owner}/${repoInfo.repo}`, 'cyan');
  }

  // デプロイ設定の確認
  logSection('デプロイ設定の確認');
  
  const deployToSameOrg = await question(
    '同一組織内のリポジトリにデプロイしますか？ (Y/n): '
  );
  
  const needsDeployToken = deployToSameOrg.toLowerCase() === 'n';

  // 必要なシークレットの確認と設定
  logSection('シークレットの設定');

  if (needsDeployToken) {
    const hasDeployToken = await checkSecret('DEPLOY_TOKEN');
    if (!hasDeployToken) {
      log('⚠️  DEPLOY_TOKEN が設定されていません', 'yellow');
      log('異なる組織へのデプロイには Personal Access Token が必要です', 'yellow');
      
      const setupToken = await question('今すぐ設定しますか？ (y/N): ');
      if (setupToken.toLowerCase() === 'y') {
        log('\n1. https://github.com/settings/tokens/new にアクセス', 'cyan');
        log('2. "repo" スコープを選択', 'cyan');
        log('3. トークンを生成してコピー\n', 'cyan');
        
        const token = await question('トークンを入力してください: ');
        if (token) {
          await setSecret('DEPLOY_TOKEN', token);
          log('✅ DEPLOY_TOKEN を設定しました', 'green');
        }
      }
    } else {
      log('✅ DEPLOY_TOKEN は設定済みです', 'green');
    }
  } else {
    log('✅ 同一組織内のデプロイ: GITHUB_TOKEN を自動的に使用します', 'green');
  }

  // オプションシークレット
  logSection('オプション設定');
  
  const setupOptional = await question('オプションのシークレットを設定しますか？ (y/N): ');
  if (setupOptional.toLowerCase() === 'y') {
    for (const secret of SECRETS_TEMPLATE.optional) {
      const exists = await checkSecret(secret.name);
      if (!exists) {
        log(`\n${secret.name}: ${secret.description}`, 'cyan');
        if (secret.example) log(`例: ${secret.example}`, 'yellow');
        if (secret.default) log(`デフォルト: ${secret.default}`, 'yellow');
        
        const value = await question(`値を入力 (スキップする場合は Enter): `);
        if (value) {
          await setSecret(secret.name, value);
          log(`✅ ${secret.name} を設定しました`, 'green');
        }
      } else {
        log(`✅ ${secret.name} は設定済みです`, 'green');
      }
    }
  }

  // 設定レポート
  logSection('設定状況レポート');
  await generateStatusReport();
}

// 設定状況レポート
async function generateStatusReport() {
  const report = {
    timestamp: new Date().toISOString(),
    secrets: {
      required: [],
      optional: []
    }
  };

  // 必須シークレットのチェック
  for (const secret of SECRETS_TEMPLATE.required) {
    const exists = await checkSecret(secret.name);
    report.secrets.required.push({
      name: secret.name,
      configured: exists,
      optional: secret.optional
    });
  }

  // オプションシークレットのチェック
  for (const secret of SECRETS_TEMPLATE.optional) {
    const exists = await checkSecret(secret.name);
    report.secrets.optional.push({
      name: secret.name,
      configured: exists
    });
  }

  // レポート表示
  log('必須シークレット:', 'bright');
  report.secrets.required.forEach(s => {
    const status = s.configured ? '✅' : (s.optional ? '⚪' : '❌');
    const note = s.optional && !s.configured ? ' (オプション)' : '';
    log(`  ${status} ${s.name}${note}`);
  });

  log('\nオプションシークレット:', 'bright');
  report.secrets.optional.forEach(s => {
    const status = s.configured ? '✅' : '⚪';
    log(`  ${status} ${s.name}`);
  });

  // レポートファイルの保存
  const reportPath = path.join(process.cwd(), '.github', 'secrets-status.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  log(`\n📄 詳細レポート: ${reportPath}`, 'cyan');
}

// CLI コマンドの処理
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'template':
        await generateSecretsTemplate();
        break;
      
      case 'check':
      case 'status':
        logSection('シークレット設定状況');
        await generateStatusReport();
        break;
      
      case 'help':
        console.log(`
${colors.bright}GitHub Actions シークレット管理ツール${colors.reset}

使用方法:
  npm run setup:secrets              対話的セットアップ
  npm run setup:secrets template     テンプレートファイルを生成
  npm run setup:secrets check        設定状況をチェック
  npm run setup:secrets help         このヘルプを表示

詳細なドキュメント:
  https://github.com/yourusername/book-publishing-template#environment-variables
        `);
        break;
      
      default:
        await interactiveSetup();
    }
  } catch (error) {
    log(`\nエラーが発生しました: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main();
}

module.exports = { SECRETS_TEMPLATE, checkSecret, setSecret };