#!/usr/bin/env node

/**
 * リリースノート自動生成ツール
 * Automatic release notes generator
 */

const fs = require('fs').promises;
const path = require('path');
const { VersionManager } = require('./version-manager');
const { VersionComparator } = require('./version-compare');

// 設定
const CONFIG = {
  releaseNotesDir: path.join(__dirname, '..', 'release-notes'),
  templateFile: path.join(__dirname, '..', 'release-notes', 'template.md'),
  publicDir: path.join(__dirname, '..', 'public')
};

// リリースノート生成クラス
class ReleaseNotesGenerator {
  constructor() {
    this.versionManager = new VersionManager();
    this.comparator = new VersionComparator();
  }

  async init() {
    await this.versionManager.load();
    await this.comparator.init();
    await this.ensureDir(CONFIG.releaseNotesDir);
  }

  // ディレクトリの作成
  async ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dir}:`, error);
    }
  }

  // 特定バージョンのリリースノートを生成
  async generateReleaseNotes(version, options = {}) {
    const versionData = this.versionManager.getVersion(version);
    if (!versionData) {
      throw new Error(`Version ${version} not found`);
    }

    // 前のバージョンを見つける
    const versions = this.versionManager.getAllVersions();
    const currentIndex = versions.indexOf(version);
    const previousVersion = currentIndex > 0 ? versions[currentIndex - 1] : null;

    let changes = { changes: [], categorizedChanges: {} };
    if (previousVersion) {
      changes = await this.comparator.compareVersions(previousVersion, version);
    }

    const releaseNotes = {
      version,
      versionData,
      previousVersion,
      changes: changes.changes,
      categorizedChanges: changes.categorizedChanges,
      summary: this.generateVersionSummary(versionData, changes),
      generatedAt: new Date().toISOString(),
      options
    };

    // テンプレートを使用してMarkdownを生成
    const markdown = await this.generateMarkdown(releaseNotes);

    // ファイルに保存
    if (options.save !== false) {
      await this.saveReleaseNotes(version, markdown);
    }

    return { releaseNotes, markdown };
  }

  // バージョンサマリーを生成
  generateVersionSummary(versionData, changes) {
    const date = new Date(versionData.timestamp).toLocaleDateString('ja-JP');
    const totalChanges = changes.changes ? changes.changes.length : 0;
    
    const categorySummary = {};
    if (changes.categorizedChanges) {
      Object.entries(changes.categorizedChanges).forEach(([type, category]) => {
        categorySummary[type] = {
          label: category.label,
          count: category.changes.length
        };
      });
    }

    return {
      date,
      totalChanges,
      branch: versionData.branch || 'unknown',
      gitHash: versionData.gitHash || 'unknown',
      categorySummary
    };
  }

  // Markdownテンプレートを読み込み
  async loadTemplate() {
    try {
      return await fs.readFile(CONFIG.templateFile, 'utf-8');
    } catch (error) {
      // デフォルトテンプレートを返す
      return this.getDefaultTemplate();
    }
  }

  // デフォルトテンプレートを取得
  getDefaultTemplate() {
    return `# {{version}}

**リリース日**: {{date}}
**ブランチ**: {{branch}}
**コミット**: {{gitHash}}

## 概要

{{description}}

{{#if hasChanges}}
## 変更内容

{{#each categorizedChanges}}
### {{this.label}}

{{#each this.changes}}
- {{this.shortMessage}} (\`{{this.hash}}\`)
{{/each}}

{{/each}}
{{else}}
このバージョンには変更がありません。
{{/if}}

## 統計

- **総変更数**: {{totalChanges}}
{{#each categorySummary}}
- **{{this.label}}**: {{this.count}}件
{{/each}}

---

*生成日時: {{generatedAt}}*
`;
  }

  // Markdownを生成
  async generateMarkdown(releaseNotes) {
    const { version, versionData, changes, categorizedChanges, summary } = releaseNotes;
    
    // シンプルなテンプレート置換（Handlebarsの簡易版）
    let markdown = `# ${version}\n\n`;
    markdown += `**リリース日**: ${summary.date}\n`;
    markdown += `**ブランチ**: ${summary.branch}\n`;
    markdown += `**コミット**: \`${summary.gitHash.substring(0, 7)}\`\n\n`;
    
    markdown += `## 概要\n\n`;
    markdown += `${versionData.description || 'このバージョンの説明はありません。'}\n\n`;

    if (summary.totalChanges > 0) {
      markdown += `## 変更内容\n\n`;
      
      Object.entries(categorizedChanges).forEach(([type, category]) => {
        markdown += `### ${category.label}\n\n`;
        
        category.changes.forEach(change => {
          markdown += `- ${change.shortMessage} (\`${change.hash.substring(0, 7)}\`)\n`;
        });
        
        markdown += `\n`;
      });
    } else {
      markdown += `## 変更内容\n\nこのバージョンには変更がありません。\n\n`;
    }

    markdown += `## 統計\n\n`;
    markdown += `- **総変更数**: ${summary.totalChanges}\n`;
    
    Object.entries(summary.categorySummary).forEach(([type, category]) => {
      markdown += `- **${category.label}**: ${category.count}件\n`;
    });

    markdown += `\n---\n\n`;
    markdown += `*生成日時: ${new Date(releaseNotes.generatedAt).toLocaleString('ja-JP')}*\n`;

    return markdown;
  }

  // リリースノートを保存
  async saveReleaseNotes(version, markdown) {
    const filename = `v${version}.md`;
    const filepath = path.join(CONFIG.releaseNotesDir, filename);
    
    await fs.writeFile(filepath, markdown);
    console.log(`✅ Release notes saved to ${filepath}`);

    // パブリックディレクトリにもコピー
    const publicPath = path.join(CONFIG.publicDir, 'release-notes');
    await this.ensureDir(publicPath);
    const publicFilepath = path.join(publicPath, filename);
    await fs.writeFile(publicFilepath, markdown);
    console.log(`✅ Release notes copied to ${publicFilepath}`);
  }

  // 全バージョンのリリースノートを生成
  async generateAllReleaseNotes(options = {}) {
    const versions = this.versionManager.getAllVersions();
    
    if (versions.length === 0) {
      console.log('生成するバージョンがありません');
      return;
    }

    console.log(`📝 Generating release notes for ${versions.length} versions...`);
    
    const results = [];
    for (const version of versions) {
      try {
        console.log(`Generating release notes for v${version}...`);
        const result = await this.generateReleaseNotes(version, options);
        results.push({ version, success: true, result });
      } catch (error) {
        console.error(`❌ Failed to generate release notes for v${version}:`, error.message);
        results.push({ version, success: false, error: error.message });
      }
    }

    // サマリーを生成
    await this.generateIndexFile(results);

    return results;
  }

  // インデックスファイルを生成
  async generateIndexFile(results) {
    let indexMarkdown = `# リリースノート\n\n`;
    indexMarkdown += `このページには全バージョンのリリースノートが含まれています。\n\n`;
    
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length > 0) {
      indexMarkdown += `## バージョン一覧\n\n`;
      
      // 新しいバージョンから順に並べる
      successfulResults.reverse().forEach(({ version, result }) => {
        const versionData = this.versionManager.getVersion(version);
        const date = new Date(versionData.timestamp).toLocaleDateString('ja-JP');
        
        indexMarkdown += `- [v${version}](v${version}.md) - ${date}\n`;
        if (versionData.description) {
          indexMarkdown += `  ${versionData.description}\n`;
        }
      });
    }

    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      indexMarkdown += `\n## 生成エラー\n\n`;
      failedResults.forEach(({ version, error }) => {
        indexMarkdown += `- v${version}: ${error}\n`;
      });
    }

    indexMarkdown += `\n---\n\n`;
    indexMarkdown += `*最終更新: ${new Date().toLocaleString('ja-JP')}*\n`;

    // ファイルに保存
    const indexPath = path.join(CONFIG.releaseNotesDir, 'index.md');
    await fs.writeFile(indexPath, indexMarkdown);
    console.log(`✅ Release notes index saved to ${indexPath}`);

    // パブリックディレクトリにもコピー
    const publicIndexPath = path.join(CONFIG.publicDir, 'release-notes', 'index.md');
    await fs.writeFile(publicIndexPath, indexMarkdown);
    console.log(`✅ Release notes index copied to ${publicIndexPath}`);
  }

  // 最新バージョンのリリースノートを生成
  async generateLatestReleaseNotes(options = {}) {
    const versions = this.versionManager.getAllVersions();
    
    if (versions.length === 0) {
      throw new Error('生成するバージョンがありません');
    }

    const latestVersion = versions[versions.length - 1];
    return await this.generateReleaseNotes(latestVersion, options);
  }
}

// CLIとして実行された場合
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const generator = new ReleaseNotesGenerator();

  async function main() {
    await generator.init();

    switch (command) {
      case 'generate':
        if (args.length < 2) {
          console.error('Usage: node release-notes.js generate <version>');
          process.exit(1);
        }
        const version = args[1];
        try {
          const { markdown } = await generator.generateReleaseNotes(version);
          console.log(`\n📝 Generated release notes for v${version}`);
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
          process.exit(1);
        }
        break;

      case 'all':
        try {
          const results = await generator.generateAllReleaseNotes();
          const successful = results.filter(r => r.success).length;
          const failed = results.filter(r => !r.success).length;
          console.log(`\n📝 Generated ${successful} release notes (${failed} failed)`);
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
          process.exit(1);
        }
        break;

      case 'latest':
        try {
          const { releaseNotes, markdown } = await generator.generateLatestReleaseNotes();
          console.log(`\n📝 Generated release notes for latest version v${releaseNotes.version}`);
        } catch (error) {
          console.error(`❌ Error: ${error.message}`);
          process.exit(1);
        }
        break;

      default:
        console.log('Usage: node release-notes.js <command> [args]');
        console.log('Commands:');
        console.log('  generate <version>  - Generate release notes for specific version');
        console.log('  all                 - Generate release notes for all versions');
        console.log('  latest              - Generate release notes for latest version');
        break;
    }
  }

  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

module.exports = { ReleaseNotesGenerator };