#!/usr/bin/env node

/**
 * ビルドメタデータ管理システム
 * ビルドメタデータの詳細分析、クリーンアップ、レポート生成
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const META_FILE = path.join(__dirname, '..', '.build-meta.json');
const CONFIG_FILE = path.join(__dirname, '..', 'book-config.json');

class MetaManager {
  constructor() {
    this.data = null;
    this.config = null;
  }

  async loadData() {
    try {
      const content = await fs.readFile(META_FILE, 'utf-8');
      this.data = JSON.parse(content);
    } catch (error) {
      console.log('📝 No metadata file found');
      this.data = {
        version: '2.0',
        lastBuild: null,
        files: {},
        stats: {
          totalBuilds: 0,
          totalFiles: 0,
          averageBuildTime: 0
        }
      };
    }
  }

  async loadConfig() {
    try {
      const content = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = JSON.parse(content);
    } catch (error) {
      console.warn('⚠️  No config file found, using defaults');
      this.config = { excludePatterns: [] };
    }
  }

  async status() {
    console.log('📊 Build Metadata Status\n');
    
    if (!this.data.lastBuild) {
      console.log('❌ No build data available');
      return;
    }

    const fileCount = Object.keys(this.data.files).length;
    const totalSize = Object.values(this.data.files).reduce((sum, file) => sum + (file.size || 0), 0);
    const averageFileSize = fileCount > 0 ? totalSize / fileCount : 0;

    console.log(`📅 Last Build: ${new Date(this.data.lastBuild).toLocaleString()}`);
    console.log(`🏗️  Total Builds: ${this.data.stats.totalBuilds}`);
    console.log(`📄 Tracked Files: ${fileCount}`);
    console.log(`💾 Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📏 Average File Size: ${(averageFileSize / 1024).toFixed(2)} KB`);
    console.log(`⏱️  Average Build Time: ${(this.data.stats.averageBuildTime / 1000).toFixed(2)}s`);

    // ファイル種別分析
    const fileTypes = {};
    const buildFrequency = {};
    
    for (const [filePath, fileInfo] of Object.entries(this.data.files)) {
      const ext = path.extname(filePath).toLowerCase() || 'no-ext';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      
      const buildCount = fileInfo.buildCount || 0;
      buildFrequency[buildCount] = (buildFrequency[buildCount] || 0) + 1;
    }

    console.log('\n📋 File Types:');
    Object.entries(fileTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([ext, count]) => {
        console.log(`   ${ext}: ${count} files`);
      });

    console.log('\n🔥 Build Frequency Distribution:');
    Object.entries(buildFrequency)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
      .slice(0, 5)
      .forEach(([builds, count]) => {
        console.log(`   ${builds} builds: ${count} files`);
      });
  }

  async analyze() {
    console.log('🔍 Detailed Analysis\n');

    const files = this.data.files;
    const fileStats = Object.entries(files).map(([path, info]) => ({
      path: path.replace(process.cwd() + '/', ''),
      ...info,
      buildCount: info.buildCount || 0
    }));

    // 最も頻繁にビルドされるファイル
    console.log('🔥 Most Frequently Built Files:');
    fileStats
      .sort((a, b) => b.buildCount - a.buildCount)
      .slice(0, 10)
      .forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.path} (${file.buildCount} builds)`);
      });

    // 最大ファイル
    console.log('\n📦 Largest Files:');
    fileStats
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 10)
      .forEach((file, index) => {
        const sizeMB = ((file.size || 0) / 1024 / 1024).toFixed(2);
        console.log(`   ${index + 1}. ${file.path} (${sizeMB} MB)`);
      });

    // 最近更新されたファイル
    console.log('\n🕒 Recently Modified Files:');
    fileStats
      .filter(file => file.lastModified)
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
      .slice(0, 10)
      .forEach((file, index) => {
        const date = new Date(file.lastModified).toLocaleString();
        console.log(`   ${index + 1}. ${file.path} (${date})`);
      });

    // ビルド効率分析
    console.log('\n⚡ Build Efficiency Analysis:');
    const totalFiles = fileStats.length;
    const activeFiles = fileStats.filter(f => f.buildCount > 1).length;
    const staleFiles = fileStats.filter(f => f.buildCount === 1).length;
    const efficiency = totalFiles > 0 ? (activeFiles / totalFiles * 100).toFixed(1) : 0;
    
    console.log(`   Active files (built >1): ${activeFiles}`);
    console.log(`   Stale files (built once): ${staleFiles}`);
    console.log(`   Build efficiency: ${efficiency}%`);
  }

  async cleanup(options = {}) {
    console.log('🧹 Cleaning up metadata...\n');

    let cleaned = 0;
    const filesToRemove = [];

    // 存在しないファイルをチェック
    for (const filePath in this.data.files) {
      try {
        await fs.access(filePath);
      } catch (error) {
        filesToRemove.push(filePath);
      }
    }

    if (filesToRemove.length > 0) {
      console.log('🗑️  Removing entries for deleted files:');
      filesToRemove.forEach(filePath => {
        const relativePath = filePath.replace(process.cwd() + '/', '');
        console.log(`   - ${relativePath}`);
        delete this.data.files[filePath];
        cleaned++;
      });
    }

    // 古いエントリの削除（オプション）
    if (options.maxAge) {
      const cutoffDate = new Date(Date.now() - options.maxAge * 24 * 60 * 60 * 1000);
      const oldFiles = [];

      for (const [filePath, fileInfo] of Object.entries(this.data.files)) {
        if (fileInfo.lastModified && new Date(fileInfo.lastModified) < cutoffDate) {
          oldFiles.push(filePath);
        }
      }

      if (oldFiles.length > 0) {
        console.log(`\n⏰ Removing entries older than ${options.maxAge} days:`);
        oldFiles.forEach(filePath => {
          const relativePath = filePath.replace(process.cwd() + '/', '');
          console.log(`   - ${relativePath}`);
          delete this.data.files[filePath];
          cleaned++;
        });
      }
    }

    if (cleaned > 0) {
      await this.save();
      console.log(`\n✅ Cleaned ${cleaned} entries`);
    } else {
      console.log('✨ Metadata is already clean');
    }
  }

  async reset() {
    console.log('🔄 Resetting metadata...');
    
    this.data = {
      version: '2.0',
      lastBuild: null,
      files: {},
      stats: {
        totalBuilds: 0,
        totalFiles: 0,
        averageBuildTime: 0
      }
    };

    await this.save();
    console.log('✅ Metadata reset complete');
  }

  async save() {
    await fs.writeFile(META_FILE, JSON.stringify(this.data, null, 2));
  }

  async export(format = 'json') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `build-metadata-${timestamp}.${format}`;

    if (format === 'json') {
      await fs.writeFile(filename, JSON.stringify(this.data, null, 2));
    } else if (format === 'csv') {
      const headers = 'Path,Size,BuildCount,LastModified\n';
      const rows = Object.entries(this.data.files)
        .map(([path, info]) => {
          const relativePath = path.replace(process.cwd() + '/', '');
          return `"${relativePath}",${info.size || 0},${info.buildCount || 0},"${info.lastModified || ''}"`;
        })
        .join('\n');
      
      await fs.writeFile(filename, headers + rows);
    }

    console.log(`📤 Exported metadata to ${filename}`);
    return filename;
  }

  async generateReport() {
    const timestamp = new Date().toISOString();
    const files = Object.entries(this.data.files);
    
    const report = {
      generatedAt: timestamp,
      summary: {
        totalFiles: files.length,
        totalBuilds: this.data.stats.totalBuilds,
        totalSize: files.reduce((sum, [, info]) => sum + (info.size || 0), 0),
        averageBuildTime: this.data.stats.averageBuildTime
      },
      topFiles: {
        mostBuilt: files
          .map(([path, info]) => ({ path: path.replace(process.cwd() + '/', ''), builds: info.buildCount || 0 }))
          .sort((a, b) => b.builds - a.builds)
          .slice(0, 10),
        largest: files
          .map(([path, info]) => ({ path: path.replace(process.cwd() + '/', ''), size: info.size || 0 }))
          .sort((a, b) => b.size - a.size)
          .slice(0, 10)
      },
      fileTypes: this.getFileTypeStats(),
      buildFrequency: this.getBuildFrequencyStats()
    };

    const filename = `build-report-${timestamp.replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    
    console.log(`📊 Generated detailed report: ${filename}`);
    return filename;
  }

  getFileTypeStats() {
    const stats = {};
    for (const filePath in this.data.files) {
      const ext = path.extname(filePath).toLowerCase() || 'no-ext';
      stats[ext] = (stats[ext] || 0) + 1;
    }
    return stats;
  }

  getBuildFrequencyStats() {
    const stats = {};
    for (const fileInfo of Object.values(this.data.files)) {
      const builds = fileInfo.buildCount || 0;
      stats[builds] = (stats[builds] || 0) + 1;
    }
    return stats;
  }
}

// CLI コマンド処理
async function main() {
  const command = process.argv[2];
  const manager = new MetaManager();
  
  await manager.loadData();
  await manager.loadConfig();

  switch (command) {
    case 'status':
      await manager.status();
      break;
      
    case 'analyze':
      await manager.analyze();
      break;
      
    case 'cleanup':
      const maxAge = process.argv[3] ? parseInt(process.argv[3]) : null;
      await manager.cleanup({ maxAge });
      break;
      
    case 'reset':
      await manager.reset();
      break;
      
    case 'export':
      const format = process.argv[3] || 'json';
      await manager.export(format);
      break;
      
    case 'report':
      await manager.generateReport();
      break;
      
    default:
      console.log(`📚 Build Metadata Manager

Usage: node meta-manager.js <command> [options]

Commands:
  status              Show metadata status and summary
  analyze             Detailed analysis of build patterns
  cleanup [days]      Remove deleted files and optionally old entries
  reset               Reset all metadata
  export [json|csv]   Export metadata to file
  report              Generate detailed analysis report

Examples:
  node meta-manager.js status
  node meta-manager.js analyze
  node meta-manager.js cleanup 30
  node meta-manager.js export csv`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MetaManager };