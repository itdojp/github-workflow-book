#!/usr/bin/env node

/**
 * バージョン比較ツール
 * Version comparison tool for book publishing
 */

const fs = require('fs').promises;
const path = require('path');
const { VersionManager } = require('./version-manager');

// 設定
const CONFIG = {
  outputDir: path.join(__dirname, '..', 'version-comparisons'),
  publicDir: path.join(__dirname, '..', 'public')
};

// バージョン比較クラス
class VersionComparator {
  constructor() {
    this.versionManager = new VersionManager();
  }

  async init() {
    await this.versionManager.load();
    await this.ensureDir(CONFIG.outputDir);
  }

  // ディレクトリの作成
  async ensureDir(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dir}:`, error);
    }
  }

  // バージョン間の比較を実行
  async compareVersions(fromVersion, toVersion, options = {}) {
    const changes = await this.versionManager.getChangesBetweenVersions(fromVersion, toVersion);
    
    const comparison = {
      ...changes,
      generatedAt: new Date().toISOString(),
      options,
      summary: this.generateSummary(changes),
      categorizedChanges: this.categorizeChanges(changes.changes)
    };

    // 比較結果をファイルに保存
    if (options.save) {
      await this.saveComparison(comparison);
    }

    return comparison;
  }

  // 変更の要約を生成
  generateSummary(changes) {
    const totalChanges = changes.changes.length;
    const fromDate = new Date(changes.fromDate).toLocaleDateString('ja-JP');
    const toDate = new Date(changes.toDate).toLocaleDateString('ja-JP');

    return {
      totalChanges,
      period: `${fromDate} - ${toDate}`,
      versions: `${changes.fromVersion} → ${changes.toVersion}`
    };
  }

  // 変更を分類
  categorizeChanges(changes) {
    const categories = {
      feat: { label: '新機能', changes: [] },
      fix: { label: '修正', changes: [] },
      docs: { label: 'ドキュメント', changes: [] },
      style: { label: 'スタイル', changes: [] },
      refactor: { label: 'リファクタリング', changes: [] },
      chore: { label: 'その他', changes: [] },
      other: { label: 'その他', changes: [] }
    };

    changes.forEach(change => {
      const [hash, ...messageParts] = change.split(' ');
      const message = messageParts.join(' ');
      
      // コミットメッセージのタイプを判定
      const typeMatch = message.match(/^(feat|fix|docs|style|refactor|chore):/);
      const type = typeMatch ? typeMatch[1] : 'other';
      
      if (categories[type]) {
        categories[type].changes.push({
          hash: hash,
          message: message,
          shortMessage: this.extractShortMessage(message)
        });
      } else {
        categories.other.changes.push({
          hash: hash,
          message: message,
          shortMessage: this.extractShortMessage(message)
        });
      }
    });

    // 空のカテゴリを除去
    Object.keys(categories).forEach(key => {
      if (categories[key].changes.length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }

  // 短いメッセージを抽出
  extractShortMessage(message) {
    // タイプを除去して短いメッセージを作成
    const cleaned = message.replace(/^(feat|fix|docs|style|refactor|chore):\s*/, '');
    return cleaned.length > 50 ? cleaned.substring(0, 47) + '...' : cleaned;
  }

  // 比較結果を保存
  async saveComparison(comparison) {
    const filename = `comparison-${comparison.fromVersion}-${comparison.toVersion}.json`;
    const filepath = path.join(CONFIG.outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(comparison, null, 2));
    console.log(`✅ Comparison saved to ${filepath}`);

    // Markdownファイルも生成
    await this.generateMarkdownReport(comparison);
  }

  // Markdownレポートを生成
  async generateMarkdownReport(comparison) {
    const filename = `comparison-${comparison.fromVersion}-${comparison.toVersion}.md`;
    const filepath = path.join(CONFIG.outputDir, filename);

    const markdown = this.generateMarkdown(comparison);
    await fs.writeFile(filepath, markdown);
    console.log(`✅ Markdown report saved to ${filepath}`);
  }

  // Markdownを生成
  generateMarkdown(comparison) {
    const { fromVersion, toVersion, summary, categorizedChanges } = comparison;
    
    let markdown = `# バージョン比較レポート\n\n`;
    markdown += `**比較対象**: ${fromVersion} → ${toVersion}\n`;
    markdown += `**期間**: ${summary.period}\n`;
    markdown += `**総変更数**: ${summary.totalChanges}\n`;
    markdown += `**生成日時**: ${new Date(comparison.generatedAt).toLocaleString('ja-JP')}\n\n`;

    if (Object.keys(categorizedChanges).length === 0) {
      markdown += `## 変更なし\n\n指定されたバージョン間に変更はありません。\n`;
      return markdown;
    }

    markdown += `## 変更内容\n\n`;

    Object.entries(categorizedChanges).forEach(([type, category]) => {
      markdown += `### ${category.label}\n\n`;
      
      category.changes.forEach(change => {
        markdown += `- ${change.shortMessage} (\`${change.hash.substring(0, 7)}\`)\n`;
      });
      
      markdown += `\n`;
    });

    markdown += `---\n\n`;
    markdown += `*このレポートは自動生成されました*\n`;

    return markdown;
  }

  // 利用可能なバージョンを表示
  async listAvailableVersions() {
    const versions = this.versionManager.getAllVersions();
    
    console.log('利用可能なバージョン:');
    if (versions.length === 0) {
      console.log('  (バージョンが登録されていません)');
      return;
    }

    versions.forEach(version => {
      const versionData = this.versionManager.getVersion(version);
      const date = new Date(versionData.timestamp).toLocaleDateString('ja-JP');
      const current = version === this.versionManager.currentVersion ? ' (現在)' : '';
      console.log(`  ${version}${current} - ${versionData.description} (${date})`);
    });
  }

  // 最新の変更を表示
  async showLatestChanges(count = 5) {
    const versions = this.versionManager.getAllVersions();
    
    if (versions.length < 2) {
      console.log('比較するには最低2つのバージョンが必要です');
      return;
    }

    const latestVersion = versions[versions.length - 1];
    const previousVersion = versions[versions.length - 2];

    console.log(`最新の変更 (${previousVersion} → ${latestVersion}):`);
    
    const comparison = await this.compareVersions(previousVersion, latestVersion);
    
    if (comparison.changes.length === 0) {
      console.log('  変更なし');
      return;
    }

    const displayCount = Math.min(count, comparison.changes.length);
    comparison.changes.slice(0, displayCount).forEach(change => {
      const [hash, ...messageParts] = change.split(' ');
      const message = messageParts.join(' ');
      console.log(`  ${hash.substring(0, 7)} ${message}`);
    });

    if (comparison.changes.length > count) {
      console.log(`  ... and ${comparison.changes.length - count} more changes`);
    }
  }
}

// CLIとして実行された場合
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || (args.length === 1 && !['list', 'latest'].includes(args[0]))) {
    console.log('使用方法:');
    console.log('  node version-compare.js <from-version> <to-version> [options]');
    console.log('  node version-compare.js list');
    console.log('  node version-compare.js latest [count]');
    console.log('');
    console.log('オプション:');
    console.log('  --save    比較結果をファイルに保存');
    console.log('  --format  出力形式 (json|markdown|both) デフォルト: both');
    console.log('');
    console.log('例:');
    console.log('  node version-compare.js 1.0.0 1.1.0 --save');
    console.log('  node version-compare.js list');
    console.log('  node version-compare.js latest 10');
    process.exit(1);
  }

  const comparator = new VersionComparator();

  async function main() {
    await comparator.init();

    if (args[0] === 'list') {
      await comparator.listAvailableVersions();
      return;
    }

    if (args[0] === 'latest') {
      const count = args[1] ? parseInt(args[1]) : 5;
      await comparator.showLatestChanges(count);
      return;
    }

    const fromVersion = args[0];
    const toVersion = args[1];
    const shouldSave = args.includes('--save');

    try {
      const comparison = await comparator.compareVersions(fromVersion, toVersion, {
        save: shouldSave
      });

      // コンソールに結果を表示
      console.log(`\n📊 バージョン比較: ${fromVersion} → ${toVersion}`);
      console.log(`📅 期間: ${comparison.summary.period}`);
      console.log(`📝 総変更数: ${comparison.summary.totalChanges}`);

      if (comparison.summary.totalChanges > 0) {
        console.log('\n📋 変更カテゴリ:');
        Object.entries(comparison.categorizedChanges).forEach(([type, category]) => {
          console.log(`  ${category.label}: ${category.changes.length}件`);
        });

        console.log('\n🔄 最近の変更:');
        const displayCount = Math.min(5, comparison.changes.length);
        comparison.changes.slice(0, displayCount).forEach(change => {
          const [hash, ...messageParts] = change.split(' ');
          const message = messageParts.join(' ');
          console.log(`  ${hash.substring(0, 7)} ${message}`);
        });

        if (comparison.changes.length > 5) {
          console.log(`  ... and ${comparison.changes.length - 5} more changes`);
        }
      } else {
        console.log('\n✨ 変更なし');
      }

    } catch (error) {
      console.error('❌ 比較エラー:', error.message);
      process.exit(1);
    }
  }

  main().catch(error => {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  });
}

module.exports = { VersionComparator };