#!/usr/bin/env node

/**
 * 🚀 Simplified Build Script
 * 
 * 複雑な依存関係を排除し、基本的なビルド機能のみを提供
 * 使い勝手を重視した軽量版ビルドスクリプト
 */

const fs = require('fs').promises;
const path = require('path');

// Color output for better UX
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`
};

class SimpleBuild {
  constructor() {
    this.config = null;
    this.processedFiles = 0;
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

  async loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'book-config.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configContent);
      this.log('設定ファイルを読み込みました');
    } catch (error) {
      // Fallback to default config
      this.config = {
        book: { title: 'My Book', author: { name: 'Author' } },
        contentSections: [
          { name: 'introduction', directory: 'introduction', enabled: true, order: 1 },
          { name: 'chapters', directory: 'chapters', enabled: true, order: 2 }
        ],
        excludePatterns: ['draft.md', '*.tmp'],
        contentExcludePatterns: ['<!-- PRIVATE:', '<!-- TODO:']
      };
      this.log('デフォルト設定を使用します', 'warning');
    }
  }

  async createPublicDirectory() {
    const publicDir = path.join(process.cwd(), 'docs');
    const indexPath = path.join(publicDir, 'index.md');
    let indexBackup = null;
    
    try {
      await fs.access(publicDir);
      
      // Backup index.md if it exists and has substantial content
      try {
        const indexContent = await fs.readFile(indexPath, 'utf-8');
        if (indexContent.length > 200) {
          indexBackup = indexContent;
          this.log('index.mdをバックアップしました');
        }
      } catch {
        // index.md doesn't exist, continue
      }
      
      // Clean existing directory
      await fs.rm(publicDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, which is fine
    }
    
    await fs.mkdir(publicDir, { recursive: true });
    
    // Restore index.md if we had a backup
    if (indexBackup) {
      await fs.writeFile(indexPath, indexBackup, 'utf-8');
      this.log('index.mdを復元しました');
    }
    
    this.log('公開ディレクトリを準備しました');
    return publicDir;
  }

  async processContentSections(srcDir, publicDir) {
    const sections = this.config.contentSections
      .filter(section => section.enabled)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    for (const section of sections) {
      await this.processSection(
        path.join(srcDir, section.directory),
        path.join(publicDir, section.directory),
        section
      );
    }
  }

  async processSection(srcPath, destPath, section) {
    try {
      await fs.access(srcPath);
      
      await fs.mkdir(destPath, { recursive: true });
      const entries = await fs.readdir(srcPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcFile = path.join(srcPath, entry.name);
        const destFile = path.join(destPath, entry.name);
        
        if (entry.isDirectory()) {
          await this.processSection(srcFile, destFile, section);
        } else if (entry.isFile() && this.shouldIncludeFile(entry.name)) {
          if (entry.name.endsWith('.md')) {
            await this.processMarkdownFile(srcFile, destFile);
          } else {
            await this.copyFile(srcFile, destFile);
          }
          this.processedFiles++;
        }
      }
      
      this.log(`${section.directory} を処理しました`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log(`${section.directory} ディレクトリが見つかりません`, 'warning');
      } else {
        throw error;
      }
    }
  }

  shouldIncludeFile(filename) {
    const excludePatterns = this.config.excludePatterns || [];
    
    for (const pattern of excludePatterns) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        if (regex.test(filename)) return false;
      } else if (filename === pattern) {
        return false;
      }
    }
    
    return true;
  }

  async processMarkdownFile(srcPath, destPath) {
    let content = await fs.readFile(srcPath, 'utf-8');
    
    // Remove private content
    const excludePatterns = this.config.contentExcludePatterns || [];
    for (const pattern of excludePatterns) {
      const regex = new RegExp(`${this.escapeRegex(pattern)}.*?-->`, 'gs');
      content = content.replace(regex, '');
    }
    
    await fs.writeFile(destPath, content, 'utf-8');
  }

  async copyFile(srcPath, destPath) {
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(srcPath, destPath);
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async copyAssets(srcDir, publicDir) {
    const assetsPath = path.join(srcDir, '..', 'assets');
    const publicAssetsPath = path.join(publicDir, 'assets');
    
    try {
      await fs.access(assetsPath);
      await this.copyDirectory(assetsPath, publicAssetsPath);
      this.log('アセットをコピーしました');
    } catch {
      this.log('アセットディレクトリが見つかりません', 'warning');
    }
  }

  async copyDirectory(srcDir, destDir) {
    await fs.mkdir(destDir, { recursive: true });
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  async generateIndex(publicDir) {
    const indexPath = path.join(publicDir, 'index.md');
    
    // Check if index.md already exists and has substantial content
    try {
      const existingContent = await fs.readFile(indexPath, 'utf-8');
      if (existingContent.length > 200) {
        this.log('既存のインデックスページを保持しました');
        return;
      }
    } catch {
      // File doesn't exist, continue with generation
    }

    const indexContent = `# ${this.config.book?.title || 'Book Title'}

${this.config.book?.description || 'Book description'}

## 目次

- [はじめに](introduction/)
- [第1章](chapters/chapter01/)

---

Built with Book Publishing Template
`;

    await fs.writeFile(indexPath, indexContent);
    this.log('インデックスページを生成しました');
  }

  async copyJekyllConfig(publicDir) {
    const configPath = path.join(process.cwd(), '_config.yml');
    const destPath = path.join(publicDir, '_config.yml');
    
    try {
      await fs.access(configPath);
      await fs.copyFile(configPath, destPath);
      this.log('Jekyll設定をコピーしました');
    } catch {
      // Generate default Jekyll config
      const defaultConfig = `title: "${this.config.book?.title || 'My Book'}"
description: "${this.config.book?.description || 'Book description'}"
baseurl: ""
url: ""

markdown: kramdown
highlighter: rouge
theme: minima

plugins:
  - jekyll-feed

exclude:
  - node_modules/
  - scripts/
  - package*.json
  - README.md
`;
      await fs.writeFile(destPath, defaultConfig);
      this.log('デフォルトJekyll設定を生成しました');
    }
  }

  async build() {
    console.log(colors.blue('🔨 Simplified Build Process Starting...\n'));
    
    try {
      await this.loadConfig();
      
      const srcDir = path.join(process.cwd(), 'src');
      const publicDir = await this.createPublicDirectory();
      
      await this.processContentSections(srcDir, publicDir);
      await this.copyAssets(srcDir, publicDir);
      // Skip auto-generation of index.md to preserve custom index
      // await this.generateIndex(publicDir);
      await this.copyJekyllConfig(publicDir);
      
      console.log('\n' + colors.green('✅ ビルド完了!'));
      console.log(colors.blue(`📁 出力先: ${publicDir}`));
      console.log(colors.blue(`📄 処理ファイル数: ${this.processedFiles}`));
      console.log('\n' + colors.yellow('次のステップ:'));
      console.log('  npm run preview  # ローカルプレビュー');
      console.log('  GitHub Pages設定  # Settings > Pages > Source: Deploy from a branch > Branch: main > Folder: /docs');
      
    } catch (error) {
      console.error('\n' + colors.red('❌ ビルドエラー:'));
      console.error(colors.red(error.message));
      console.log('\n' + colors.yellow('トラブルシューティング:'));
      console.log('1. src/ ディレクトリが存在するか確認');
      console.log('2. book-config.json の設定を確認');
      console.log('3. ファイルの読み書き権限を確認');
      process.exit(1);
    }
  }
}

// Execute build
if (require.main === module) {
  const builder = new SimpleBuild();
  builder.build();
}

module.exports = SimpleBuild;