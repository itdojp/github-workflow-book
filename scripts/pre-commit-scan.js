#!/usr/bin/env node

/**
 * プリコミットスキャン
 * コミット前にプライベートコンテンツや機密情報をスキャン
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

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
    ]
  };
}

// プライベートコンテンツマーカーの検出
function detectPrivateMarkers(content, filePath) {
  const warnings = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // プライベートコンテンツマーカーをチェック
    for (const pattern of CONFIG.contentExcludePatterns) {
      if (line.includes(pattern)) {
        warnings.push({
          file: filePath,
          line: i + 1,
          content: line.trim(),
          type: 'private_marker',
          marker: pattern
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
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const pattern of CONFIG.sensitivePatterns || []) {
      const regex = new RegExp(pattern, 'gi'); // 'gi' for case-insensitive and global
      const matches = line.match(regex);
      
      if (matches) {
        warnings.push({
          file: filePath,
          line: i + 1,
          content: line.trim(),
          type: 'sensitive',
          pattern: pattern
        });
      }
    }
  }
  
  return warnings;
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

// ステージされたファイルの取得
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(file => file.endsWith('.md'));
  } catch (error) {
    console.error('Failed to get staged files:', error.message);
    return [];
  }
}

// メイン実行
async function main() {
  console.log('🔍 Scanning for private content and sensitive information...\n');
  
  global.CONFIG = await loadConfig();
  
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log('✅ No markdown files to scan');
    return;
  }
  
  let allWarnings = [];
  
  for (const file of stagedFiles) {
    if (await fs.access(file).then(() => true).catch(() => false)) {
      const warnings = await scanFile(file);
      allWarnings = allWarnings.concat(warnings);
    }
  }
  
  if (allWarnings.length === 0) {
    console.log('✅ No private content or sensitive information detected');
    return;
  }
  
  console.log('⚠️  WARNING: Private content or sensitive information detected:\n');
  
  const groupedWarnings = {};
  allWarnings.forEach(warning => {
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
    console.log('');
  });
  
  console.log('🛡️  These files contain private or sensitive content that should not be committed.');
  console.log('   Please review and remove sensitive information before committing.\n');
  
  // 警告のみで、コミットは阻止しない（設定可能にする）
  if (process.env.STRICT_PRECOMMIT === 'true') {
    console.log('❌ Commit blocked due to private content detection');
    process.exit(1);
  } else {
    console.log('⚠️  Commit allowed but please review the warnings above');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Pre-commit scan failed:', error);
    process.exit(1);
  });
}

module.exports = { detectPrivateMarkers, detectSensitiveContent, scanFile };