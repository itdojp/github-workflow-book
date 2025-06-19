#!/usr/bin/env node

/**
 * バージョン管理ユーティリティ
 * Version management utility for book publishing
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// 設定
const CONFIG = {
  versionFile: path.join(__dirname, '..', 'version-config.json'),
  packageFile: path.join(__dirname, '..', 'package.json'),
  releaseNotesDir: path.join(__dirname, '..', 'release-notes'),
  publicDir: path.join(__dirname, '..', 'public')
};

// バージョンメタデータクラス
class VersionManager {
  constructor() {
    this.versions = {};
    this.currentVersion = null;
  }

  // バージョン設定を読み込み
  async load() {
    try {
      const content = await fs.readFile(CONFIG.versionFile, 'utf-8');
      const data = JSON.parse(content);
      this.versions = data.versions || {};
      this.currentVersion = data.currentVersion || null;
    } catch (error) {
      // ファイルが存在しない場合は初期化
      this.versions = {};
      this.currentVersion = null;
    }
  }

  // バージョン設定を保存
  async save() {
    const data = {
      currentVersion: this.currentVersion,
      versions: this.versions,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(CONFIG.versionFile, JSON.stringify(data, null, 2));
  }

  // 新しいバージョンを作成
  async createVersion(version, description = '') {
    // セマンティックバージョニングの検証
    if (!this.isValidVersion(version)) {
      throw new Error(`Invalid version format: ${version}. Use semantic versioning (e.g., 1.0.0)`);
    }

    // 現在のGitハッシュを取得
    const gitHash = this.getCurrentGitHash();
    const timestamp = new Date().toISOString();

    this.versions[version] = {
      version,
      description,
      gitHash,
      timestamp,
      created: timestamp,
      branch: this.getCurrentBranch(),
      buildMetadata: {}
    };

    this.currentVersion = version;
    await this.save();

    console.log(`✅ Created version ${version}`);
    return this.versions[version];
  }

  // バージョンを取得
  getVersion(version) {
    return this.versions[version] || null;
  }

  // 全バージョンを取得
  getAllVersions() {
    return Object.keys(this.versions).sort((a, b) => {
      return this.compareVersions(a, b);
    });
  }

  // バージョンの比較
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    return 0;
  }

  // バージョン形式の検証
  isValidVersion(version) {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semverRegex.test(version);
  }

  // 現在のGitハッシュを取得
  getCurrentGitHash() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  // 現在のブランチを取得
  getCurrentBranch() {
    try {
      return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  // Gitタグを作成
  async createGitTag(version, message) {
    try {
      execSync(`git tag -a v${version} -m "${message}"`, { stdio: 'inherit' });
      console.log(`✅ Created Git tag v${version}`);
    } catch (error) {
      console.warn(`⚠️  Failed to create Git tag: ${error.message}`);
    }
  }

  // Gitタグをプッシュ
  async pushGitTags() {
    try {
      execSync('git push origin --tags', { stdio: 'inherit' });
      console.log(`✅ Pushed Git tags`);
    } catch (error) {
      console.warn(`⚠️  Failed to push Git tags: ${error.message}`);
    }
  }

  // package.jsonのバージョンを更新
  async updatePackageVersion(version) {
    try {
      const packageContent = await fs.readFile(CONFIG.packageFile, 'utf-8');
      const packageData = JSON.parse(packageContent);
      packageData.version = version;
      await fs.writeFile(CONFIG.packageFile, JSON.stringify(packageData, null, 2));
      console.log(`✅ Updated package.json version to ${version}`);
    } catch (error) {
      console.warn(`⚠️  Failed to update package.json: ${error.message}`);
    }
  }

  // バージョン間の変更を取得
  async getChangesBetweenVersions(fromVersion, toVersion) {
    const fromVersionData = this.getVersion(fromVersion);
    const toVersionData = this.getVersion(toVersion);

    if (!fromVersionData || !toVersionData) {
      throw new Error('One or both versions not found');
    }

    try {
      const changes = execSync(
        `git log --oneline ${fromVersionData.gitHash}..${toVersionData.gitHash}`,
        { encoding: 'utf-8' }
      );
      
      return {
        fromVersion,
        toVersion,
        changes: changes.trim().split('\n').filter(line => line.length > 0),
        fromDate: fromVersionData.timestamp,
        toDate: toVersionData.timestamp
      };
    } catch (error) {
      console.warn(`⚠️  Failed to get Git changes: ${error.message}`);
      return {
        fromVersion,
        toVersion,
        changes: [],
        fromDate: fromVersionData.timestamp,
        toDate: toVersionData.timestamp
      };
    }
  }
}

module.exports = { VersionManager, CONFIG };

// CLIとして実行された場合
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  const versionManager = new VersionManager();

  async function main() {
    await versionManager.load();

    switch (command) {
      case 'create':
        if (args.length < 1) {
          console.error('Usage: node version-manager.js create <version> [description]');
          process.exit(1);
        }
        await versionManager.createVersion(args[0], args[1] || '');
        break;

      case 'list':
        const versions = versionManager.getAllVersions();
        console.log('Available versions:');
        versions.forEach(v => {
          const data = versionManager.getVersion(v);
          const current = v === versionManager.currentVersion ? ' (current)' : '';
          console.log(`  ${v}${current} - ${data.description} (${data.timestamp})`);
        });
        break;

      case 'current':
        if (versionManager.currentVersion) {
          console.log(versionManager.currentVersion);
        } else {
          console.log('No current version set');
        }
        break;

      case 'info':
        if (args.length < 1) {
          console.error('Usage: node version-manager.js info <version>');
          process.exit(1);
        }
        const versionInfo = versionManager.getVersion(args[0]);
        if (versionInfo) {
          console.log(JSON.stringify(versionInfo, null, 2));
        } else {
          console.log(`Version ${args[0]} not found`);
        }
        break;

      default:
        console.log('Usage: node version-manager.js <command> [args]');
        console.log('Commands:');
        console.log('  create <version> [description] - Create a new version');
        console.log('  list                          - List all versions');
        console.log('  current                       - Show current version');
        console.log('  info <version>                - Show version information');
        break;
    }
  }

  main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}