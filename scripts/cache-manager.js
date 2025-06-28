#!/usr/bin/env node

/**
 * キャッシュ管理ツール
 * ローカル開発とCI/CD環境でのキャッシュを最適化
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// カラー出力
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// キャッシュ設定
const CACHE_CONFIG = {
  version: '1.0.0',
  directories: {
    npm: ['node_modules', '.npm'],
    build: ['public', '.build-meta.json', '.build-profile.json'],
    markdown: ['.markdown-cache', '.textlint-cache'],
    temp: ['.cache', 'temp']
  },
  ttl: {
    npm: 7 * 24 * 60 * 60 * 1000,      // 7 days
    build: 24 * 60 * 60 * 1000,        // 1 day
    markdown: 3 * 24 * 60 * 60 * 1000  // 3 days
  }
};

// ユーティリティ関数
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}\n`);
}

// ディレクトリサイズを取得
async function getDirectorySize(dirPath) {
  try {
    const output = execSync(`du -sh "${dirPath}" 2>/dev/null || echo "0"`, { encoding: 'utf8' });
    return output.split('\t')[0].trim();
  } catch {
    return '0';
  }
}

// キャッシュキーを生成
async function generateCacheKey(patterns) {
  const files = [];
  
  for (const pattern of patterns) {
    try {
      const output = execSync(`find ${pattern} -type f 2>/dev/null | head -1000`, { encoding: 'utf8' });
      files.push(...output.split('\n').filter(Boolean));
    } catch {
      // Pattern didn't match any files
    }
  }
  
  // ファイル内容のハッシュを計算
  const hashes = await Promise.all(
    files.slice(0, 100).map(async (file) => {
      try {
        const content = await fs.readFile(file);
        return crypto.createHash('md5').update(content).digest('hex');
      } catch {
        return '';
      }
    })
  );
  
  return crypto.createHash('md5').update(hashes.join('')).digest('hex').slice(0, 16);
}

// キャッシュ状態を分析
async function analyzeCache() {
  logSection('キャッシュ分析');
  
  const analysis = {
    sizes: {},
    exists: {},
    total: 0
  };
  
  // 各キャッシュディレクトリを確認
  for (const [type, dirs] of Object.entries(CACHE_CONFIG.directories)) {
    let typeSize = 0;
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
        const size = await getDirectorySize(dir);
        analysis.sizes[dir] = size;
        analysis.exists[dir] = true;
        
        log(`✅ ${dir}: ${size}`, 'green');
      } catch {
        analysis.exists[dir] = false;
        log(`❌ ${dir}: not found`, 'gray');
      }
    }
  }
  
  // キャッシュマニフェストを確認
  try {
    const manifest = await fs.readFile('.cache-manifest.json', 'utf-8');
    const manifestData = JSON.parse(manifest);
    log('\n📋 前回のビルド情報:', 'cyan');
    log(`  ビルド時間: ${manifestData.buildTime}秒`);
    log(`  NPMキャッシュ: ${manifestData.cacheHit.npm ? 'HIT' : 'MISS'}`);
    log(`  ビルドキャッシュ: ${manifestData.cacheHit.build ? 'HIT' : 'MISS'}`);
  } catch {
    log('\n📋 キャッシュマニフェストなし', 'gray');
  }
  
  return analysis;
}

// キャッシュをクリア
async function clearCache(types = ['all']) {
  logSection('キャッシュクリア');
  
  const targetDirs = [];
  
  if (types.includes('all')) {
    // すべてのキャッシュをクリア
    for (const dirs of Object.values(CACHE_CONFIG.directories)) {
      targetDirs.push(...dirs);
    }
  } else {
    // 指定されたタイプのみクリア
    for (const type of types) {
      if (CACHE_CONFIG.directories[type]) {
        targetDirs.push(...CACHE_CONFIG.directories[type]);
      }
    }
  }
  
  for (const dir of targetDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      log(`🗑️  ${dir} を削除しました`, 'yellow');
    } catch (error) {
      log(`⚠️  ${dir} の削除に失敗: ${error.message}`, 'red');
    }
  }
  
  // キャッシュマニフェストも削除
  try {
    await fs.unlink('.cache-manifest.json');
    log('🗑️  キャッシュマニフェストを削除しました', 'yellow');
  } catch {
    // ファイルが存在しない場合は無視
  }
}

// キャッシュを最適化
async function optimizeCache() {
  logSection('キャッシュ最適化');
  
  // 1. 一時ファイルを削除
  log('🧹 一時ファイルをクリーンアップ中...', 'cyan');
  
  const tempPatterns = [
    'public/**/*.map',
    '.cache/**/*.tmp',
    'temp/**/*',
    '**/.DS_Store'
  ];
  
  for (const pattern of tempPatterns) {
    try {
      execSync(`find . -path "${pattern}" -type f -delete 2>/dev/null`, { stdio: 'ignore' });
    } catch {
      // エラーは無視
    }
  }
  
  // 2. 古いキャッシュファイルを削除
  log('🕐 古いキャッシュファイルを確認中...', 'cyan');
  
  const cacheAge = {
    '.build-meta.json': 7,  // 7日
    '.build-profile*.json': 3  // 3日
  };
  
  for (const [pattern, days] of Object.entries(cacheAge)) {
    try {
      execSync(`find . -name "${pattern}" -mtime +${days} -delete 2>/dev/null`, { stdio: 'ignore' });
    } catch {
      // エラーは無視
    }
  }
  
  // 3. キャッシュサイズを報告
  const analysis = await analyzeCache();
  
  log('\n✅ キャッシュ最適化が完了しました', 'green');
}

// キャッシュをウォーム（事前生成）
async function warmCache() {
  logSection('キャッシュウォーミング');
  
  log('🔥 キャッシュを事前生成中...', 'yellow');
  
  // 1. 依存関係をインストール（NPMキャッシュ）
  if (!await exists('node_modules')) {
    log('📦 依存関係をインストール中...', 'cyan');
    execSync('npm ci', { stdio: 'inherit' });
  }
  
  // 2. フルビルドを実行（ビルドキャッシュ）
  log('🔨 フルビルドを実行中...', 'cyan');
  execSync('npm run build', { stdio: 'inherit' });
  
  // 3. キャッシュマニフェストを作成
  const manifest = {
    timestamp: new Date().toISOString(),
    version: CACHE_CONFIG.version,
    warmed: true,
    keys: {
      npm: await generateCacheKey(['package-lock.json']),
      build: await generateCacheKey(['src/**/*.md', 'book-config.json'])
    }
  };
  
  await fs.writeFile('.cache-manifest.json', JSON.stringify(manifest, null, 2));
  
  log('\n✅ キャッシュウォーミングが完了しました', 'green');
}

// ファイル/ディレクトリの存在確認
async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

// GitHub Actions キャッシュキーを表示
async function showCacheKeys() {
  logSection('GitHub Actions キャッシュキー');
  
  const osType = process.platform === 'darwin' ? 'macOS' : 
                 process.platform === 'win32' ? 'Windows' : 'Linux';
  
  // NPMキャッシュキー
  const npmKey = `${osType}-npm-${await generateCacheKey(['package-lock.json'])}`;
  log('📦 NPM Cache Key:', 'cyan');
  log(`   ${npmKey}`);
  
  // ビルドキャッシュキー
  const buildKey = `${osType}-build-${await generateCacheKey(['src/**/*', 'book-config.json', 'scripts/build*.js'])}`;
  log('\n🔨 Build Cache Key:', 'cyan');
  log(`   ${buildKey}`);
  
  // 使用例
  log('\n📝 GitHub Actions での使用例:', 'yellow');
  log(`
  - name: Cache dependencies
    uses: actions/cache@v3
    with:
      path: |
        ~/.npm
        node_modules
      key: ${npmKey}
      restore-keys: |
        ${osType}-npm-
  `);
}

// CLIコマンドの処理
async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  try {
    switch (command) {
      case 'analyze':
      case 'status':
        await analyzeCache();
        break;
        
      case 'clear':
      case 'clean':
        await clearCache(args.length > 0 ? args : ['all']);
        break;
        
      case 'optimize':
        await optimizeCache();
        break;
        
      case 'warm':
      case 'warmup':
        await warmCache();
        break;
        
      case 'keys':
        await showCacheKeys();
        break;
        
      case 'help':
      default:
        console.log(`
${colors.bright}キャッシュ管理ツール${colors.reset}

使用方法:
  npm run cache:analyze     キャッシュ状態を分析
  npm run cache:clear       すべてのキャッシュをクリア
  npm run cache:clear npm   NPMキャッシュのみクリア
  npm run cache:clear build ビルドキャッシュのみクリア
  npm run cache:optimize    キャッシュを最適化
  npm run cache:warm        キャッシュを事前生成
  npm run cache:keys        GitHub Actions用のキーを表示

キャッシュタイプ:
  - npm:      Node.js依存関係
  - build:    ビルド成果物
  - markdown: Markdown処理キャッシュ
  - temp:     一時ファイル
        `);
        break;
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

module.exports = { CACHE_CONFIG, analyzeCache, clearCache, optimizeCache };