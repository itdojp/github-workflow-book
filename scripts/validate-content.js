#!/usr/bin/env node

/**
 * コンテンツ検証スクリプト
 * 書籍コンテンツの品質保証のための自動テスト・検証ツール
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

// 設定
const CONFIG = {
  srcDir: path.join(__dirname, '..', 'src'),
  assetsDir: path.join(__dirname, '..', 'assets'),
  reportDir: path.join(__dirname, '..', 'validation-reports'),
  
  // 除外パターン
  excludePatterns: [
    /draft\.md$/,
    /notes\.md$/,
    /solutions\.md$/,
    /instructor\.md$/,
    /private\.md$/,
    /\.tmp$/
  ],
  
  // 必須メタデータフィールド
  requiredMetadata: ['title'],
  
  // 文字数制限
  limits: {
    titleMaxLength: 100,
    sectionMaxLength: 10000
  },
  
  // 禁止ワード
  forbiddenWords: [
    'TODO',
    'FIXME',
    'XXX'
  ]
};

// 検証結果を格納するクラス
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.stats = {
      filesChecked: 0,
      linksChecked: 0,
      imagesChecked: 0
    };
  }

  addError(type, file, line, message, suggestion = null) {
    this.errors.push({
      type,
      file,
      line,
      message,
      suggestion,
      severity: 'error'
    });
  }

  addWarning(type, file, line, message, suggestion = null) {
    this.warnings.push({
      type,
      file,
      line,
      message,
      suggestion,
      severity: 'warning'
    });
  }

  addInfo(type, file, line, message) {
    this.info.push({
      type,
      file,
      line,
      message,
      severity: 'info'
    });
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  getTotal() {
    return this.errors.length + this.warnings.length;
  }
}

// ユーティリティ関数
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory ${dir}:`, error);
  }
}

async function shouldExclude(filePath) {
  const fileName = path.basename(filePath);
  for (const pattern of CONFIG.excludePatterns) {
    if (pattern.test(fileName)) {
      return true;
    }
  }
  return false;
}

// メタデータ解析
function parseMetadata(content) {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    return {};
  }
  
  try {
    const metadata = {};
    const lines = frontMatterMatch[1].split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        metadata[match[1].trim()] = match[2].trim();
      }
    }
    return metadata;
  } catch (error) {
    return {};
  }
}

// リンクチェック
async function checkLinks(content, filePath, result) {
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  let lineNumber = 1;
  
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineNumber = i + 1;
    
    let linkMatch;
    const lineLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    
    while ((linkMatch = lineLinkRegex.exec(line)) !== null) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      result.stats.linksChecked++;
      
      // 内部リンクチェック
      if (linkUrl.startsWith('./') || linkUrl.startsWith('../') || linkUrl.startsWith('/')) {
        await checkInternalLink(linkUrl, filePath, lineNumber, result);
      }
      
      // 外部リンクチェック（基本的な形式チェック）
      if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
        checkExternalLinkFormat(linkUrl, filePath, lineNumber, result);
      }
      
      // メールリンクチェック
      if (linkUrl.startsWith('mailto:')) {
        checkEmailLink(linkUrl, filePath, lineNumber, result);
      }
      
      // 空のリンクテキストチェック
      if (!linkText.trim()) {
        result.addWarning(
          'link',
          filePath,
          lineNumber,
          'リンクテキストが空です',
          'リンクテキストを追加してください'
        );
      }
    }
  }
}

async function checkInternalLink(linkUrl, filePath, lineNumber, result) {
  try {
    // ファイルパスの解決
    const currentDir = path.dirname(filePath);
    let targetPath;
    
    if (linkUrl.startsWith('/')) {
      targetPath = path.join(CONFIG.srcDir, linkUrl.slice(1));
    } else {
      targetPath = path.resolve(currentDir, linkUrl);
    }
    
    // アンカーリンクの処理
    let actualPath = targetPath;
    if (targetPath.includes('#')) {
      actualPath = targetPath.split('#')[0];
    }
    
    // ファイルの存在チェック
    try {
      await fs.access(actualPath);
    } catch (error) {
      result.addError(
        'link',
        filePath,
        lineNumber,
        `内部リンクが見つかりません: ${linkUrl}`,
        'リンク先のファイルパスを確認してください'
      );
    }
  } catch (error) {
    result.addError(
      'link',
      filePath,
      lineNumber,
      `内部リンクの解析に失敗しました: ${linkUrl}`,
      'リンクの形式を確認してください'
    );
  }
}

function checkExternalLinkFormat(linkUrl, filePath, lineNumber, result) {
  try {
    new URL(linkUrl);
  } catch (error) {
    result.addError(
      'link',
      filePath,
      lineNumber,
      `外部リンクの形式が不正です: ${linkUrl}`,
      '正しいURL形式で記述してください'
    );
  }
}

function checkEmailLink(linkUrl, filePath, lineNumber, result) {
  const email = linkUrl.replace('mailto:', '');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    result.addError(
      'link',
      filePath,
      lineNumber,
      `メールアドレスの形式が不正です: ${email}`,
      '正しいメールアドレス形式で記述してください'
    );
  }
}

// 画像参照の検証
async function checkImages(content, filePath, result) {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  let lineNumber = 1;
  
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineNumber = i + 1;
    
    let imageMatch;
    const lineImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    
    while ((imageMatch = lineImageRegex.exec(line)) !== null) {
      const altText = imageMatch[1];
      const imageSrc = imageMatch[2];
      result.stats.imagesChecked++;
      
      // 相対パスの画像チェック
      if (!imageSrc.startsWith('http://') && !imageSrc.startsWith('https://')) {
        await checkImageFile(imageSrc, filePath, lineNumber, result);
      }
      
      // alt属性チェック
      if (!altText.trim()) {
        result.addWarning(
          'image',
          filePath,
          lineNumber,
          '画像のalt属性が空です',
          'アクセシビリティのためalt属性を追加してください'
        );
      }
    }
  }
}

async function checkImageFile(imageSrc, filePath, lineNumber, result) {
  try {
    const currentDir = path.dirname(filePath);
    let imagePath;
    
    if (imageSrc.startsWith('/')) {
      imagePath = path.join(CONFIG.assetsDir, imageSrc.slice(1));
    } else {
      imagePath = path.resolve(currentDir, imageSrc);
    }
    
    // ファイルの存在チェック
    try {
      await fs.access(imagePath);
    } catch (error) {
      result.addError(
        'image',
        filePath,
        lineNumber,
        `画像ファイルが見つかりません: ${imageSrc}`,
        '画像ファイルのパスを確認してください'
      );
    }
  } catch (error) {
    result.addError(
      'image',
      filePath,
      lineNumber,
      `画像パスの解析に失敗しました: ${imageSrc}`,
      '画像パスの形式を確認してください'
    );
  }
}

// メタデータ検証
function checkMetadata(content, filePath, result) {
  const metadata = parseMetadata(content);
  
  // 必須フィールドチェック
  for (const field of CONFIG.requiredMetadata) {
    if (!metadata[field]) {
      result.addWarning(
        'metadata',
        filePath,
        1,
        `必須メタデータフィールドが不足しています: ${field}`,
        `フロントマターに${field}を追加してください`
      );
    }
  }
  
  // タイトル長さチェック
  if (metadata.title && metadata.title.length > CONFIG.limits.titleMaxLength) {
    result.addWarning(
      'metadata',
      filePath,
      1,
      `タイトルが長すぎます (${metadata.title.length}文字)`,
      `タイトルを${CONFIG.limits.titleMaxLength}文字以内にしてください`
    );
  }
}

// 禁止ワードチェック
function checkForbiddenWords(content, filePath, result) {
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    for (const word of CONFIG.forbiddenWords) {
      if (line.includes(word)) {
        result.addWarning(
          'content',
          filePath,
          lineNumber,
          `禁止ワードが検出されました: ${word}`,
          '本番環境では禁止ワードを削除してください'
        );
      }
    }
  }
}

// 文字数制限チェック
function checkContentLength(content, filePath, result) {
  // フロントマターを除いたコンテンツの長さをチェック
  const contentWithoutFrontMatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
  
  if (contentWithoutFrontMatter.length > CONFIG.limits.sectionMaxLength) {
    result.addWarning(
      'content',
      filePath,
      1,
      `コンテンツが長すぎます (${contentWithoutFrontMatter.length}文字)`,
      `セクションを分割することを検討してください`
    );
  }
}

// 単一ファイルの検証
async function validateFile(filePath, result) {
  try {
    if (await shouldExclude(filePath)) {
      return;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    result.stats.filesChecked++;
    
    // 各種チェック実行
    await checkLinks(content, filePath, result);
    await checkImages(content, filePath, result);
    checkMetadata(content, filePath, result);
    checkForbiddenWords(content, filePath, result);
    checkContentLength(content, filePath, result);
    
    result.addInfo(
      'validation',
      filePath,
      0,
      `ファイル検証完了`
    );
    
  } catch (error) {
    result.addError(
      'system',
      filePath,
      0,
      `ファイル読み込みエラー: ${error.message}`,
      'ファイルのパーミッションとエンコーディングを確認してください'
    );
  }
}

// HTMLレポート生成
async function generateHTMLReport(result) {
  await ensureDir(CONFIG.reportDir);
  
  const reportPath = path.join(CONFIG.reportDir, 'validation-report.html');
  const timestamp = new Date().toISOString();
  
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>コンテンツ検証レポート</title>
    <style>
        body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #333; }
        .timestamp { color: #666; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 32px; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #666; font-size: 14px; }
        .error .stat-number { color: #dc3545; }
        .warning .stat-number { color: #ffc107; }
        .success .stat-number { color: #28a745; }
        .issues { margin-top: 30px; }
        .issue-group { margin-bottom: 30px; }
        .issue-group h3 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .issue { margin: 15px 0; padding: 15px; border-left: 4px solid #ddd; background: #f8f9fa; }
        .issue.error { border-left-color: #dc3545; background: #f8d7da; }
        .issue.warning { border-left-color: #ffc107; background: #fff3cd; }
        .issue.info { border-left-color: #17a2b8; background: #d1ecf1; }
        .issue-header { font-weight: bold; margin-bottom: 8px; }
        .issue-file { color: #666; font-size: 14px; margin-bottom: 5px; }
        .issue-suggestion { margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.7); border-radius: 4px; font-style: italic; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .badge.error { background: #dc3545; color: white; }
        .badge.warning { background: #ffc107; color: #212529; }
        .badge.info { background: #17a2b8; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 コンテンツ検証レポート</h1>
            <div class="timestamp">生成日時: ${timestamp}</div>
        </div>
        
        <div class="summary">
            <div class="stat-card ${result.hasErrors() ? 'error' : 'success'}">
                <div class="stat-number">${result.errors.length}</div>
                <div class="stat-label">エラー</div>
            </div>
            <div class="stat-card ${result.warnings.length > 0 ? 'warning' : 'success'}">
                <div class="stat-number">${result.warnings.length}</div>
                <div class="stat-label">警告</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${result.stats.filesChecked}</div>
                <div class="stat-label">検証ファイル数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${result.stats.linksChecked}</div>
                <div class="stat-label">チェックしたリンク数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${result.stats.imagesChecked}</div>
                <div class="stat-label">チェックした画像数</div>
            </div>
        </div>
        
        <div class="issues">
            ${result.errors.length > 0 ? `
            <div class="issue-group">
                <h3>🚨 エラー (${result.errors.length}件)</h3>
                ${result.errors.map(issue => `
                <div class="issue error">
                    <div class="issue-header">
                        <span class="badge error">${issue.type}</span>
                        ${issue.message}
                    </div>
                    <div class="issue-file">📁 ${issue.file}${issue.line > 0 ? `:${issue.line}` : ''}</div>
                    ${issue.suggestion ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
                </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${result.warnings.length > 0 ? `
            <div class="issue-group">
                <h3>⚠️ 警告 (${result.warnings.length}件)</h3>
                ${result.warnings.map(issue => `
                <div class="issue warning">
                    <div class="issue-header">
                        <span class="badge warning">${issue.type}</span>
                        ${issue.message}
                    </div>
                    <div class="issue-file">📁 ${issue.file}${issue.line > 0 ? `:${issue.line}` : ''}</div>
                    ${issue.suggestion ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
                </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${result.errors.length === 0 && result.warnings.length === 0 ? `
            <div class="issue-group">
                <h3>✅ 検証結果</h3>
                <div class="issue info">
                    <div class="issue-header">
                        <span class="badge info">success</span>
                        すべての検証項目をパスしました！
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>
  `;
  
  await fs.writeFile(reportPath, html, 'utf-8');
  console.log(`📄 HTMLレポートを生成しました: ${reportPath}`);
}

// JSONレポート生成
async function generateJSONReport(result) {
  await ensureDir(CONFIG.reportDir);
  
  const reportPath = path.join(CONFIG.reportDir, 'validation-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    stats: result.stats,
    summary: {
      errors: result.errors.length,
      warnings: result.warnings.length,
      total: result.getTotal()
    },
    errors: result.errors,
    warnings: result.warnings,
    info: result.info
  };
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📄 JSONレポートを生成しました: ${reportPath}`);
}

// メイン実行関数
async function main() {
  console.log('🔍 コンテンツ検証を開始します...\n');
  
  const result = new ValidationResult();
  const generateReport = process.argv.includes('--report');
  
  try {
    // Markdownファイルを検索
    const pattern = path.join(CONFIG.srcDir, '**/*.md').replace(/\\/g, '/');
    const files = glob.sync(pattern);
    
    console.log(`📁 ${files.length}個のMarkdownファイルを検出しました`);
    
    // 各ファイルを検証
    for (const file of files) {
      await validateFile(file, result);
    }
    
    console.log('\n📊 検証結果:');
    console.log(`   ファイル数: ${result.stats.filesChecked}`);
    console.log(`   リンク数: ${result.stats.linksChecked}`);
    console.log(`   画像数: ${result.stats.imagesChecked}`);
    console.log(`   エラー: ${result.errors.length}`);
    console.log(`   警告: ${result.warnings.length}`);
    
    // レポート生成
    if (generateReport) {
      await generateHTMLReport(result);
      await generateJSONReport(result);
    }
    
    // エラーがある場合は詳細表示
    if (result.hasErrors()) {
      console.log('\n🚨 エラーが発生しました:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.type}] ${error.file}:${error.line}`);
        console.log(`   ${error.message}`);
        if (error.suggestion) {
          console.log(`   💡 ${error.suggestion}`);
        }
        console.log('');
      });
    }
    
    // 警告がある場合は表示
    if (result.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      result.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.type}] ${warning.file}:${warning.line}`);
        console.log(`   ${warning.message}`);
        if (warning.suggestion) {
          console.log(`   💡 ${warning.suggestion}`);
        }
        console.log('');
      });
    }
    
    // 成功時
    if (!result.hasErrors() && result.warnings.length === 0) {
      console.log('\n✅ すべての検証項目をパスしました！');
    }
    
    // 終了コード
    process.exit(result.hasErrors() ? 1 : 0);
    
  } catch (error) {
    console.error('❌ 検証中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = {
  validateFile,
  ValidationResult,
  CONFIG
};