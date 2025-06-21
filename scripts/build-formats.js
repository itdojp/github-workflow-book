#!/usr/bin/env node

/**
 * 複数フォーマット一括ビルドスクリプト
 * Web, PDF, EPUBの全フォーマットをビルド
 */

const fs = require('fs').promises;
const path = require('path');
const { build: buildWeb } = require('./build.js');
const { buildPDF } = require('./build-pdf.js');
const { buildEPUB } = require('./build-epub.js');

// 設定ファイルの読み込み
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.warn('book-config.json not found, using default configuration');
    return {};
  }
}

// 利用可能フォーマットの定義
const FORMATS = {
  web: {
    name: 'Web (HTML)',
    description: 'GitHub Pages用のWebサイト',
    builder: buildWeb,
    outputDir: 'public',
    extensions: ['.html', '.css', '.js']
  },
  pdf: {
    name: 'PDF',
    description: '印刷用PDFファイル',
    builder: buildPDF,
    outputDir: 'output',
    extensions: ['.pdf']
  },
  epub: {
    name: 'EPUB',
    description: '電子書籍フォーマット',
    builder: buildEPUB,
    outputDir: 'output',
    extensions: ['.epub']
  }
};

// フォーマット情報の表示
function displayFormats() {
  console.log('📚 利用可能な出力フォーマット:\n');
  
  Object.entries(FORMATS).forEach(([key, format]) => {
    console.log(`  ${key.padEnd(8)} - ${format.name}`);
    console.log(`  ${' '.repeat(10)} ${format.description}`);
    console.log('');
  });
}

// 使用方法の表示
function displayUsage() {
  console.log('使用方法:');
  console.log('  node scripts/build-formats.js [フォーマット...]');
  console.log('');
  console.log('例:');
  console.log('  node scripts/build-formats.js web        # Webのみビルド');
  console.log('  node scripts/build-formats.js pdf epub   # PDFとEPUBをビルド');
  console.log('  node scripts/build-formats.js all        # 全フォーマットをビルド');
  console.log('  node scripts/build-formats.js --list     # 利用可能フォーマットを表示');
  console.log('');
}

// 出力ディレクトリの準備
async function prepareOutputDirectories() {
  const outputDirs = [
    path.join(__dirname, '..', 'public'),
    path.join(__dirname, '..', 'output'),
    path.join(__dirname, '..', 'temp')
  ];
  
  for (const dir of outputDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dir}:`, error);
    }
  }
}

// ビルド統計の収集
async function collectBuildStats(formats, results) {
  const stats = {
    formats: formats.length,
    successful: 0,
    failed: 0,
    totalSize: 0,
    files: []
  };
  
  for (const [format, result] of Object.entries(results)) {
    if (result.success) {
      stats.successful++;
      
      // ファイルサイズの計算
      try {
        const outputDir = path.join(__dirname, '..', FORMATS[format].outputDir);
        const files = await getFilesRecursively(outputDir);
        
        for (const file of files) {
          const fileStat = await fs.stat(file);
          stats.totalSize += fileStat.size;
          stats.files.push({
            format,
            path: file,
            size: fileStat.size
          });
        }
      } catch (error) {
        console.warn(`Could not calculate size for ${format}:`, error.message);
      }
    } else {
      stats.failed++;
    }
  }
  
  return stats;
}

// ディレクトリ内のファイルを再帰的に取得
async function getFilesRecursively(dir) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getFilesRecursively(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // ディレクトリが存在しない場合は無視
  }
  
  return files;
}

// 結果レポートの生成
async function generateReport(formats, results, stats) {
  const reportPath = path.join(__dirname, '..', 'output', 'build-report.md');
  
  let report = '# ビルドレポート\n\n';
  report += `**生成日時:** ${new Date().toLocaleString('ja-JP')}\n\n`;
  
  // 概要
  report += '## 概要\n\n';
  report += `- **ビルド対象フォーマット:** ${stats.formats}個\n`;
  report += `- **成功:** ${stats.successful}個\n`;
  report += `- **失敗:** ${stats.failed}個\n`;
  report += `- **総ファイルサイズ:** ${(stats.totalSize / (1024 * 1024)).toFixed(2)} MB\n\n`;
  
  // 各フォーマットの結果
  report += '## フォーマット別結果\n\n';
  
  for (const format of formats) {
    const result = results[format];
    const status = result.success ? '✅ 成功' : '❌ 失敗';
    
    report += `### ${FORMATS[format].name} ${status}\n\n`;
    
    if (result.success) {
      report += `- **出力ディレクトリ:** ${FORMATS[format].outputDir}\n`;
      if (result.duration) {
        report += `- **ビルド時間:** ${result.duration}ms\n`;
      }
      if (result.outputPath) {
        report += `- **出力ファイル:** ${result.outputPath}\n`;
      }
    } else {
      report += `- **エラー:** ${result.error}\n`;
    }
    
    report += '\n';
  }
  
  // ファイル一覧
  if (stats.files.length > 0) {
    report += '## 生成ファイル一覧\n\n';
    
    const filesByFormat = {};
    stats.files.forEach(file => {
      if (!filesByFormat[file.format]) {
        filesByFormat[file.format] = [];
      }
      filesByFormat[file.format].push(file);
    });
    
    Object.entries(filesByFormat).forEach(([format, files]) => {
      report += `### ${FORMATS[format].name}\n\n`;
      files.forEach(file => {
        const relativePath = path.relative(path.join(__dirname, '..'), file.path);
        const sizeKB = (file.size / 1024).toFixed(1);
        report += `- ${relativePath} (${sizeKB} KB)\n`;
      });
      report += '\n';
    });
  }
  
  await fs.writeFile(reportPath, report, 'utf-8');
  console.log(`📊 ビルドレポートを生成しました: ${reportPath}`);
}

// 個別フォーマットのビルド
async function buildFormat(format) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🔨 Building ${FORMATS[format].name}...`);
    
    const result = await FORMATS[format].builder();
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      duration,
      outputPath: result
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      duration,
      error: error.message
    };
  }
}

// メイン実行関数
async function buildFormats(requestedFormats) {
  console.log('📚 複数フォーマットビルドを開始します...\n');
  
  try {
    // 出力ディレクトリの準備
    await prepareOutputDirectories();
    
    // 設定の読み込み
    const config = await loadConfig();
    console.log('📋 設定を読み込みました');
    
    // フォーマットの検証
    const validFormats = requestedFormats.filter(format => {
      if (!FORMATS[format]) {
        console.warn(`⚠️  未知のフォーマット: ${format}`);
        return false;
      }
      return true;
    });
    
    if (validFormats.length === 0) {
      console.error('❌ 有効なフォーマットが指定されていません');
      return;
    }
    
    console.log(`📝 ビルド対象: ${validFormats.map(f => FORMATS[f].name).join(', ')}\n`);
    
    // 各フォーマットのビルド実行
    const results = {};
    
    for (const format of validFormats) {
      const result = await buildFormat(format);
      results[format] = result;
      
      if (result.success) {
        console.log(`✅ ${FORMATS[format].name} ビルド完了 (${result.duration}ms)`);
      } else {
        console.error(`❌ ${FORMATS[format].name} ビルド失敗: ${result.error}`);
      }
    }
    
    // 統計の収集
    const stats = await collectBuildStats(validFormats, results);
    
    // レポートの生成
    await generateReport(validFormats, results, stats);
    
    // 結果サマリー
    console.log('\n📋 ビルド結果サマリー:');
    console.log(`   成功: ${stats.successful}/${stats.formats}`);
    console.log(`   失敗: ${stats.failed}/${stats.formats}`);
    console.log(`   総サイズ: ${(stats.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    
    if (stats.failed > 0) {
      console.log('\n⚠️  一部のフォーマットでビルドが失敗しました。詳細はログを確認してください。');
      process.exit(1);
    } else {
      console.log('\n🎉 全フォーマットのビルドが成功しました！');
    }
    
  } catch (error) {
    console.error('\n❌ ビルドプロセスでエラーが発生しました:', error);
    process.exit(1);
  }
}

// 引数解析と実行
function main() {
  const args = process.argv.slice(2);
  
  // ヘルプやリスト表示
  if (args.includes('--help') || args.includes('-h')) {
    displayUsage();
    return;
  }
  
  if (args.includes('--list') || args.includes('-l')) {
    displayFormats();
    return;
  }
  
  // フォーマットの決定
  let requestedFormats = args.filter(arg => !arg.startsWith('--'));
  
  if (requestedFormats.length === 0 || requestedFormats.includes('all')) {
    requestedFormats = Object.keys(FORMATS);
  }
  
  // ビルド実行
  buildFormats(requestedFormats);
}

// 実行
if (require.main === module) {
  main();
}

module.exports = { buildFormats, FORMATS };