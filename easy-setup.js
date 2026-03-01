#!/usr/bin/env node

/**
 * 📚 Easy Setup Script for Book Publishing Template
 * 
 * このスクリプトは複雑な手動設定を自動化し、
 * 使い勝手を大幅に改善します。
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Color functions for better UX
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

class EasySetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.config = {};
  }

  async ask(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  log(message, type = 'info') {
    const prefix = {
      info: '📝',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    console.log(`${prefix[type]} ${message}`);
  }

  async main() {
    console.clear();
    console.log(colors.bold(colors.blue('📚 Book Publishing Template - Easy Setup')));
    console.log('==========================================\n');

    try {
      await this.checkEnvironment();
      await this.gatherBasicInfo();
      await this.setupDependencies();
      await this.createConfiguration();
      await this.generateReadme();
      await this.setupGitIgnore();
      await this.finalizeSetup();
      
      this.showSuccess();
    } catch (error) {
      this.log(`セットアップエラー: ${error.message}`, 'error');
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  async checkEnvironment() {
    this.log('環境をチェック中...');
    
    // Node.js version check
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    // Keep aligned with package.json engines.node (>=20.0.0)
    if (majorVersion < 20) {
      throw new Error(`Node.js 20以上が必要です。現在: ${nodeVersion}`);
    }
    
    // Git check
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch {
      throw new Error('Gitがインストールされていません');
    }

    this.log('環境チェック完了', 'success');
  }

  async gatherBasicInfo() {
    this.log('基本情報を入力してください:');
    
    this.config.title = await this.ask('📖 書籍タイトル: ');
    this.config.author = await this.ask('👤 著者名: ');
    this.config.githubUser = await this.ask('🐙 GitHubユーザー名: ');
    this.config.description = await this.ask('📝 書籍の説明: ');
    
    // Repository name suggestion
    const suggestedRepo = this.config.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Remove public repository prompt - using single repository architecture
    
    console.log('\n' + colors.green('✅ 基本情報を収集しました\n'));
  }

  async setupDependencies() {
    this.log('依存関係をセットアップ中...');
    
    try {
      // Check if package.json exists
      await fs.access('package.json');
      
      // Install only essential dependencies to avoid issues
      const essentialDeps = [
        'fs-extra',
        'gray-matter',
        'glob',
        'markdownlint-cli'
      ];
      
      this.log('必要最小限の依存関係をインストール中...');
      execSync(`npm install ${essentialDeps.join(' ')}`, { stdio: 'pipe' });
      
      this.log('依存関係のセットアップ完了', 'success');
    } catch (error) {
      this.log('依存関係のインストールをスキップ（オプション機能のため）', 'warning');
    }
  }

  async createConfiguration() {
    this.log('設定ファイルを作成中...');
    
    const config = {
      book: {
        title: this.config.title,
        author: {
          name: this.config.author,
          github: this.config.githubUser
        },
        description: this.config.description,
        language: "ja",
        version: "1.0.0"
      },
      deployment: {
        siteUrl: `https://${this.config.githubUser}.github.io/${suggestedRepo}/`,
        sourceFolder: "docs"
      },
      contentSections: [
        {
          name: "introduction",
          title: "はじめに",
          directory: "introduction",
          enabled: true,
          order: 1
        },
        {
          name: "chapters",
          title: "本章",
          directory: "chapters",
          enabled: true,
          order: 2,
          numbering: true
        }
      ],
      excludePatterns: [
        "draft.md",
        "*.tmp",
        ".private"
      ],
      contentExcludePatterns: [
        "<!-- PRIVATE:",
        "<!-- TODO:",
        "<!-- DRAFT:"
      ]
    };

    await fs.writeFile('book-config.json', JSON.stringify(config, null, 2));
    this.log('設定ファイル作成完了', 'success');
  }

  async generateReadme() {
    this.log('README.mdを生成中...');
    
    const readme = `# ${this.config.title}

${this.config.description}

## 著者
${this.config.author}

## セットアップ

このリポジトリは [Book Publishing Template](https://github.com/itdojp/book-publishing-template) を使用しています。

### ローカル開発

\`\`\`bash
# 依存関係をインストール
npm install

# ビルド
npm run build

# プレビュー
npm run preview
\`\`\`

### GitHub Pages設定

1. リポジトリの Settings > Pages を開く
2. Source: Deploy from a branch を選択
3. Branch: main, Folder: /docs を選択
4. Save をクリック

## 執筆

- \`src/introduction/\`: はじめに
- \`src/chapters/\`: 各章
- \`assets/\`: 画像とリソース

## 公開サイト

https://${this.config.githubUser}.github.io/${suggestedRepo}/

---

Generated with ❤️ by Book Publishing Template
`;

    await fs.writeFile('README.md', readme);
    this.log('README.md生成完了', 'success');
  }

  async setupGitIgnore() {
    this.log('.gitignore を設定中...');
    
    const gitignore = `# Build outputs
public/
output/
temp/

# Dependencies
node_modules/

# Logs
*.log
npm-debug.log*

# Runtime data
pids
*.pid
*.seed

# Cache
.cache/
.build-meta.json

# OS files
.DS_Store
Thumbs.db

# Private content
*.private.*
.private/
draft/

# IDE
.vscode/
.idea/
*.swp
*.swo

# Environment
.env
.env.local
`;

    await fs.writeFile('.gitignore', gitignore);
    this.log('.gitignore設定完了', 'success');
  }

  async finalizeSetup() {
    this.log('最終設定を実行中...');
    
    // Create basic directory structure
    const dirs = [
      'src/introduction',
      'src/chapters/chapter01',
      'assets/images'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Create sample content
    const sampleIntro = `# はじめに

${this.config.title}へようこそ。

この書籍では...
`;

    const sampleChapter = `# 第1章 基礎編

## 1.1 概要

この章では基礎的な内容について説明します。

## 1.2 詳細

詳細な内容をここに記述...
`;

    await fs.writeFile('src/introduction/index.md', sampleIntro);
    await fs.writeFile('src/chapters/chapter01/index.md', sampleChapter);
    
    this.log('ディレクトリ構造とサンプルコンテンツを作成', 'success');
  }

  showSuccess() {
    console.log('\n' + colors.bold(colors.green('🎉 セットアップ完了!')));
    console.log('==========================================');
    console.log(colors.blue('次のステップ:'));
    console.log('1. ' + colors.yellow('npm run build') + ' でコンテンツをビルド');
    console.log('2. ' + colors.yellow('git status && git add README.md .gitignore book-config.json src/ && git commit -m "Initial commit"'));
    console.log('3. GitHubにリポジトリを作成してプッシュ');
    console.log('4. Settings > Pages > Source: main branch /docs folder');
    console.log('\n詳細は README.md を参照してください。');
    console.log('\n' + colors.green('Happy Writing! 📚✨'));
  }
}

// Execute setup
if (require.main === module) {
  const setup = new EasySetup();
  setup.main().catch(console.error);
}

module.exports = EasySetup;
