#!/usr/bin/env node

/**
 * コンテンツスキャナー
 * プロジェクト全体をスキャンしてプライベートコンテンツや機密情報を検出
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

// 設定の読み込み
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.warn('book-config.json not found, using default configuration');
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    contentExcludePatterns: [
      '<!-- TODO:',
      '<!-- FIXME:',
      '<!-- PRIVATE:',
      '<!-- SECRET:',
      '<!-- DRAFT:',
      '<!-- CONFIDENTIAL:',
      '<!-- INSTRUCTOR:',
      '<!-- INTERNAL:',
      '<!-- SENSITIVE:'
    ],
    sensitivePatterns: [
      "(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\\s*[=:]\\s*['\"][a-zA-Z0-9_-]{8,}['\"]",
      "(password|passwd)\\s*[=:]\\s*['\"][^'\"\\s]{8,}['\"]",
      "github[_-]?token\\s*[=:]\\s*['\"]ghp_[a-zA-Z0-9]{36}['\"]",
      "aws[_-]?access[_-]?key[_-]?id\\s*[=:]\\s*['\"]AKIA[0-9A-Z]{16}['\"]",
      "-----BEGIN [A-Z ]+PRIVATE KEY-----",
      "(email|mail)\\s*[=:]\\s*['\"][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}['\"]"
    ],
    excludePatterns: [
      "draft.md",
      "notes.md",
      "solutions.md",
      "instructor.md",
      "private.md",
      "confidential.md",
      "secret.md",
      "private-to-public-deployment-guide.md",
      "*.tmp",
      "*.backup",
      "*.bak"
    ]
  };
}

// プライベートコンテンツマーカーの検出
function detectPrivateMarkers(content, filePath) {
  const warnings = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const pattern of CONFIG.contentExcludePatterns) {
      if (line.includes(pattern)) {
        warnings.push({
          file: filePath,
          line: i + 1,
          content: line.trim(),
          type: 'private_marker',
          marker: pattern,
          severity: getMarkerSeverity(pattern)
        });
      }
    }
  }
  
  return warnings;
}

// 機密情報の検出
function detectSensitiveContent(content, filePath) {
  const warnings = [];
  const lines = content.split('\n');
  
  // Common example/test domains to exclude
  const exampleDomains = [
    '@example.com',
    '@test.com',
    '@localhost',
    '@demo.com',
    '@foo.bar',
    '@example.org',
    '@example.net'
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const pattern of CONFIG.sensitivePatterns || []) {
      const regex = new RegExp(pattern, 'gi');
      const matches = line.match(regex);
      
      if (matches) {
        // Filter out example emails
        const filteredMatches = matches.filter(match => {
          if (pattern.includes('email') || pattern.includes('mail')) {
            return !exampleDomains.some(domain => match.toLowerCase().includes(domain));
          }
          return true;
        });
        
        if (filteredMatches.length > 0) {
          warnings.push({
            file: filePath,
            line: i + 1,
            content: line.trim(),
            type: 'sensitive',
            pattern: pattern,
            severity: getSensitiveSeverity(pattern)
          });
        }
      }
    }
  }
  
  return warnings;
}

// 除外ファイルパターンのチェック
function shouldExcludeFile(filePath, fileName) {
  for (const pattern of CONFIG.excludePatterns) {
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(fileName) || regex.test(filePath)) {
        return true;
      }
    } else if (fileName === pattern || filePath.endsWith(pattern)) {
      return true;
    }
  }
  return false;
}

// 重要度の判定
function getMarkerSeverity(marker) {
  if (marker.includes('SECRET') || marker.includes('CONFIDENTIAL')) return 'high';
  if (marker.includes('PRIVATE') || marker.includes('SENSITIVE')) return 'medium';
  return 'low';
}

function getSensitiveSeverity(pattern) {
  if (pattern.includes('password') || pattern.includes('secret') || pattern.includes('key')) return 'high';
  if (pattern.includes('token') || pattern.includes('PRIVATE KEY')) return 'high';
  if (pattern.includes('email')) return 'low';
  return 'medium';
}

// ファイルのスキャン
async function scanFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const privateWarnings = detectPrivateMarkers(content, filePath);
    const sensitiveWarnings = detectSensitiveContent(content, filePath);
    
    return [...privateWarnings, ...sensitiveWarnings];
  } catch (error) {
    console.error(`Failed to scan ${filePath}:`, error.message);
    return [];
  }
}

// メイン実行
async function main() {
  const args = process.argv.slice(2);
  const targetDir = args.find(arg => !arg.startsWith('--')) || '.';
  const outputFormat = args.includes('--json') ? 'json' : 'console';
  const showAll = args.includes('--all');
  const severityFilter = args.includes('--high-only') ? 'high' : null;
  
  console.log('🔍 Comprehensive content security scan...\n');
  
  global.CONFIG = await loadConfig();
  
  // ファイルの収集
  const patterns = [
    path.join(targetDir, '**/*.md'),
    path.join(targetDir, '**/*.txt'),
    path.join(targetDir, '**/*.json'),
    path.join(targetDir, '**/*.js'),
    path.join(targetDir, '**/*.sh')
  ];
  
  let allFiles = [];
  for (const pattern of patterns) {
    const files = glob.sync(pattern, { 
      ignore: ['**/node_modules/**', '**/public/**', '**/.git/**'] 
    });
    allFiles = allFiles.concat(files);
  }
  
  // 重複除去
  allFiles = [...new Set(allFiles)];
  
  let allWarnings = [];
  let excludedFiles = [];
  
  for (const file of allFiles) {
    const fileName = path.basename(file);
    const relativePath = path.relative(process.cwd(), file);
    
    if (shouldExcludeFile(relativePath, fileName)) {
      excludedFiles.push(relativePath);
      if (showAll) {
        console.log(`⏭️  Excluded: ${relativePath}`);
      }
      continue;
    }
    
    const warnings = await scanFile(file);
    if (warnings.length > 0) {
      allWarnings = allWarnings.concat(warnings);
    }
  }
  
  // 重要度フィルタリング
  if (severityFilter) {
    allWarnings = allWarnings.filter(w => w.severity === severityFilter);
  }
  
  // 結果の出力
  if (outputFormat === 'json') {
    console.log(JSON.stringify({
      summary: {
        totalFiles: allFiles.length,
        excludedFiles: excludedFiles.length,
        warningsFound: allWarnings.length
      },
      warnings: allWarnings,
      excludedFiles: showAll ? excludedFiles : []
    }, null, 2));
    return;
  }
  
  // コンソール出力
  console.log(`📊 Scan Results:`);
  console.log(`   Files scanned: ${allFiles.length}`);
  console.log(`   Files excluded: ${excludedFiles.length}`);
  console.log(`   Warnings found: ${allWarnings.length}\n`);
  
  if (allWarnings.length === 0) {
    console.log('✅ No security issues detected');
    return;
  }
  
  // 重要度別グループ化
  const groupedBySeverity = {
    high: allWarnings.filter(w => w.severity === 'high'),
    medium: allWarnings.filter(w => w.severity === 'medium'),
    low: allWarnings.filter(w => w.severity === 'low')
  };
  
  // 高重要度の警告
  if (groupedBySeverity.high.length > 0) {
    console.log('🚨 HIGH SEVERITY ISSUES:');
    outputWarnings(groupedBySeverity.high);
    console.log('');
  }
  
  // 中重要度の警告
  if (groupedBySeverity.medium.length > 0) {
    console.log('⚠️  MEDIUM SEVERITY ISSUES:');
    outputWarnings(groupedBySeverity.medium);
    console.log('');
  }
  
  // 低重要度の警告
  if (groupedBySeverity.low.length > 0 && !severityFilter) {
    console.log('ℹ️  LOW SEVERITY ISSUES:');
    outputWarnings(groupedBySeverity.low);
    console.log('');
  }
  
  // 推奨事項
  console.log('🛡️  RECOMMENDATIONS:');
  if (groupedBySeverity.high.length > 0) {
    console.log('   • Review and remove high severity items before deployment');
  }
  if (groupedBySeverity.medium.length > 0) {
    console.log('   • Consider reviewing medium severity items');
  }
  console.log('   • Use the pre-commit hook: npm run pre-commit');
  console.log('   • Run deployment with security checks: npm run deploy');
  
  process.exit(groupedBySeverity.high.length > 0 ? 1 : 0);
}

function outputWarnings(warnings) {
  const groupedWarnings = {};
  warnings.forEach(warning => {
    if (!groupedWarnings[warning.file]) {
      groupedWarnings[warning.file] = [];
    }
    groupedWarnings[warning.file].push(warning);
  });
  
  Object.keys(groupedWarnings).forEach(file => {
    console.log(`📄 ${file}:`);
    groupedWarnings[file].forEach(warning => {
      const icon = warning.type === 'private_marker' ? '🔒' : '🔑';
      console.log(`  ${icon} Line ${warning.line}: ${warning.content}`);
      if (warning.marker) {
        console.log(`      Marker: ${warning.marker}`);
      }
    });
  });
}

if (require.main === module) {
  main().catch(error => {
    console.error('Content scan failed:', error);
    process.exit(1);
  });
}

module.exports = {
  detectPrivateMarkers,
  detectSensitiveContent,
  scanFile,
  shouldExcludeFile
};