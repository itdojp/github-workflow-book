#!/usr/bin/env node

/**
 * プライベートコンテンツ セーフガードシステム
 * 機密情報の誤公開を防ぐための多層防御システム
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// 危険なパターンの定義
const SENSITIVE_PATTERNS = {
  // API キーとトークン
  apiKeys: [
    /[A-Za-z0-9]{20,}/g,  // 長い英数字列（API キー候補）
    /ghp_[A-Za-z0-9]{36}/g,  // GitHub Personal Access Token
    /sk-[A-Za-z0-9]{48}/g,   // OpenAI API Key
    /AKIA[A-Z0-9]{16}/g,     // AWS Access Key
    /ya29\.[A-Za-z0-9_-]+/g  // Google OAuth Token
  ],
  
  // 個人情報
  personalInfo: [
    /\b\d{3}-\d{4}-\d{4}\b/g,  // 電話番号
    /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g,  // クレジットカード番号
    /\b\d{3}-\d{2}-\d{4}\b/g,  // 社会保障番号（US）
  ],
  
  // IP アドレスとURL
  ipAddresses: [
    /\b(?:10|127|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,  // プライベートIP
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g  // 任意のIP
  ],
  
  // データベース接続文字列
  dbConnections: [
    /mongodb:\/\/[^\/\s]+/g,
    /postgres:\/\/[^\/\s]+/g,
    /mysql:\/\/[^\/\s]+/g,
    /redis:\/\/[^\/\s]+/g
  ],
  
  // パスワードとハッシュ
  passwords: [
    /password[=:\s]+[^\s,;)}\]]+/gi,
    /secret[=:\s]+[^\s,;)}\]]+/gi,
    /token[=:\s]+[^\s,;)}\]]+/gi,
    /\$2[aby]\$\d+\$[A-Za-z0-9./]{53}/g  // bcrypt hash
  ]
};

// プライベートコンテンツパターン
const PRIVATE_CONTENT_PATTERNS = [
  // コメントパターン
  /<!--\s*TODO:[\s\S]*?-->/g,
  /<!--\s*FIXME:[\s\S]*?-->/g,
  /<!--\s*PRIVATE:[\s\S]*?-->/g,
  /<!--\s*SECRET:[\s\S]*?-->/g,
  /<!--\s*CONFIDENTIAL:[\s\S]*?-->/g,
  /<!--\s*INSTRUCTOR:[\s\S]*?-->/g,
  /<!--\s*INTERNAL:[\s\S]*?-->/g,
  /<!--\s*DO NOT PUBLISH:[\s\S]*?-->/g,
  /<!--\s*非公開:[\s\S]*?-->/g,
  /<!--\s*秘匿:[\s\S]*?-->/g,
  
  // セクションパターン
  /##\s*講師向け[\s\S]*?(?=##|$)/g,
  /##\s*Instructor[\s\S]*?(?=##|$)/g,
  /##\s*Private[\s\S]*?(?=##|$)/g,
  /##\s*Internal[\s\S]*?(?=##|$)/g,
  /##\s*非公開[\s\S]*?(?=##|$)/g,
  
  // コードブロック内のプライベートマーカー
  /```[\s\S]*?(?:password|secret|token|private)[\s\S]*?```/gi,
  
  // テスト用データ
  /test.*password/gi,
  /dummy.*token/gi,
  /sample.*key/gi
];

// 除外するファイル名パターン
const EXCLUDED_FILE_PATTERNS = [
  /\.draft\.md$/,
  /\.private\.md$/,
  /\.internal\.md$/,
  /\.secret\.md$/,
  /\.confidential\.md$/,
  /\.notes\.md$/,
  /\.todo\.md$/,
  /\.instructor\.md$/,
  /\.solutions\.md$/,
  /\.tmp$/,
  /\.temp$/,
  /\.backup$/,
  /\.bak$/,
  /_private\./,
  /_secret\./,
  /_internal\./
];

// カラー出力
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function log(level, message, details = '') {
  const color = colors[level] || colors.reset;
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}${details ? ` ${details}` : ''}`);
}

// ファイル内容の分析
class ContentAnalyzer {
  constructor() {
    this.violations = [];
    this.warnings = [];
    this.statistics = {
      filesScanned: 0,
      violationsFound: 0,
      warningsIssued: 0,
      sensitiveDataDetected: 0
    };
  }

  // センシティブなデータの検出
  detectSensitiveData(content, filePath) {
    const detections = [];
    
    // Common example/test domains and values to exclude
    const examplePatterns = [
      '@example.com', '@test.com', '@localhost', '@demo.com',
      '@foo.bar', '@example.org', '@example.net',
      'alice@', 'bob@', 'user@', 'test@', 'demo@'
    ];
    
    for (const [category, patterns] of Object.entries(SENSITIVE_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            // API キーらしき文字列の場合、より厳密にチェック
            if (category === 'apiKeys' && !this.isLikelyApiKey(match)) {
              continue;
            }
            
            // Skip example/test emails
            if (category === 'personalInfo' || match.includes('@')) {
              const isExample = examplePatterns.some(example => 
                match.toLowerCase().includes(example.toLowerCase())
              );
              if (isExample) continue;
            }
            
            // Skip localhost IPs
            if (category === 'ipAddresses' && (
              match === '127.0.0.1' || 
              match === '0.0.0.0' || 
              match.startsWith('127.') ||
              match === 'localhost'
            )) {
              continue;
            }
            
            // Skip false positive password patterns in commit messages or documentation
            if (category === 'passwords') {
              const context = content.substring(
                Math.max(0, content.indexOf(match) - 50),
                Math.min(content.length, content.indexOf(match) + match.length + 50)
              );
              // Skip if it's just the word "password" in documentation context
              if (match.toLowerCase().includes('password validation') ||
                  match.toLowerCase().includes('password strength') ||
                  match.toLowerCase().includes('password reset') ||
                  context.includes('git commit') ||
                  context.includes('コミットメッセージ')) {
                continue;
              }
            }
            
            detections.push({
              type: 'SENSITIVE_DATA',
              category,
              match: this.maskSensitiveValue(match),
              line: this.findLineNumber(content, match),
              severity: 'HIGH'
            });
          }
        }
      }
    }
    
    return detections;
  }

  // プライベートコンテンツの検出
  detectPrivateContent(content, filePath) {
    const detections = [];
    
    for (const pattern of PRIVATE_CONTENT_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          detections.push({
            type: 'PRIVATE_CONTENT',
            match: match.substring(0, 100) + (match.length > 100 ? '...' : ''),
            line: this.findLineNumber(content, match),
            severity: 'MEDIUM'
          });
        }
      }
    }
    
    return detections;
  }

  // ファイル名の検証
  validateFileName(filePath) {
    const fileName = path.basename(filePath);
    const violations = [];
    
    for (const pattern of EXCLUDED_FILE_PATTERNS) {
      if (pattern.test(fileName)) {
        violations.push({
          type: 'EXCLUDED_FILE',
          fileName,
          pattern: pattern.source,
          severity: 'HIGH'
        });
      }
    }
    
    return violations;
  }

  // APIキーらしい文字列かどうかの判定
  isLikelyApiKey(str) {
    // 短すぎる場合は除外
    if (str.length < 20) return false;
    
    // 特定のプレフィックスを持つ場合は API キー
    const keyPrefixes = ['sk-', 'ghp_', 'AKIA', 'ya29.'];
    for (const prefix of keyPrefixes) {
      if (str.startsWith(prefix)) return true;
    }
    
    // ランダムな英数字列の特徴を持つかチェック
    const hasUpperCase = /[A-Z]/.test(str);
    const hasLowerCase = /[a-z]/.test(str);
    const hasNumbers = /[0-9]/.test(str);
    const isAlphaNumeric = /^[A-Za-z0-9]+$/.test(str);
    
    return isAlphaNumeric && hasUpperCase && hasLowerCase && hasNumbers;
  }

  // センシティブな値をマスク
  maskSensitiveValue(value) {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    const middle = '*'.repeat(Math.max(0, value.length - 8));
    
    return `${start}${middle}${end}`;
  }

  // 行番号を見つける
  findLineNumber(content, searchString) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchString.substring(0, 50))) {
        return i + 1;
      }
    }
    return null;
  }

  // ファイルを分析
  async analyzeFile(filePath) {
    try {
      this.statistics.filesScanned++;
      
      // ファイル名の検証
      const fileNameViolations = this.validateFileName(filePath);
      if (fileNameViolations.length > 0) {
        this.violations.push({
          filePath,
          violations: fileNameViolations
        });
        return { shouldExclude: true, reason: 'EXCLUDED_FILE_NAME' };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      
      // センシティブデータの検出
      const sensitiveData = this.detectSensitiveData(content, filePath);
      if (sensitiveData.length > 0) {
        this.violations.push({
          filePath,
          violations: sensitiveData
        });
        this.statistics.sensitiveDataDetected += sensitiveData.length;
      }

      // プライベートコンテンツの検出
      const privateContent = this.detectPrivateContent(content, filePath);
      if (privateContent.length > 0) {
        this.warnings.push({
          filePath,
          warnings: privateContent
        });
        this.statistics.warningsIssued += privateContent.length;
      }

      const totalIssues = sensitiveData.length + privateContent.length;
      this.statistics.violationsFound += totalIssues;

      return {
        shouldExclude: fileNameViolations.length > 0 || sensitiveData.length > 0,
        reason: sensitiveData.length > 0 ? 'SENSITIVE_DATA' : 
                privateContent.length > 0 ? 'PRIVATE_CONTENT' : null,
        issues: totalIssues
      };

    } catch (error) {
      log('red', `❌ Error analyzing ${filePath}: ${error.message}`);
      return { shouldExclude: false, reason: null, issues: 0 };
    }
  }

  // レポート生成
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      statistics: this.statistics,
      violations: this.violations,
      warnings: this.warnings
    };

    return report;
  }

  // レポートの表示
  displayReport() {
    console.log('\n' + '='.repeat(60));
    log('cyan', '🛡️  PRIVATE CONTENT SAFEGUARD REPORT', colors.bright);
    console.log('='.repeat(60));

    // 統計情報
    log('blue', `📊 Statistics:`);
    console.log(`   Files scanned: ${this.statistics.filesScanned}`);
    console.log(`   Violations found: ${this.statistics.violationsFound}`);
    console.log(`   Warnings issued: ${this.statistics.warningsIssued}`);
    console.log(`   Sensitive data detected: ${this.statistics.sensitiveDataDetected}`);

    // 重大な違反
    if (this.violations.length > 0) {
      log('red', '\n🚨 CRITICAL VIOLATIONS (WILL BE EXCLUDED):');
      for (const violation of this.violations) {
        log('red', `   📁 ${violation.filePath}`);
        for (const v of violation.violations) {
          log('yellow', `      ⚠️  ${v.type}: ${v.match || v.fileName} (Line: ${v.line || 'N/A'})`);
        }
      }
    }

    // 警告
    if (this.warnings.length > 0) {
      log('yellow', '\n⚠️  WARNINGS (CONTENT WILL BE CLEANED):');
      for (const warning of this.warnings) {
        log('yellow', `   📁 ${warning.filePath}`);
        for (const w of warning.warnings) {
          log('yellow', `      💡 ${w.type}: ${w.match.substring(0, 50)}... (Line: ${w.line || 'N/A'})`);
        }
      }
    }

    // 結果サマリー
    if (this.violations.length === 0 && this.warnings.length === 0) {
      log('green', '\n✅ No security issues detected. Content is safe for publication.');
    } else {
      log('yellow', `\n📋 Summary: ${this.violations.length} files will be excluded, ${this.warnings.length} files will be cleaned.`);
    }

    console.log('='.repeat(60) + '\n');
  }

  // レポートをファイルに保存
  async saveReport(outputPath) {
    const report = this.generateReport();
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    log('green', `📄 Report saved to: ${outputPath}`);
  }
}

// クリーンアップされたコンテンツを生成
function cleanContent(content) {
  let cleanedContent = content;
  
  // プライベートコンテンツパターンを除去
  for (const pattern of PRIVATE_CONTENT_PATTERNS) {
    cleanedContent = cleanedContent.replace(pattern, '');
  }
  
  // 連続する空行を整理
  cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return cleanedContent.trim();
}

// メイン実行関数
async function runSafeguardCheck(sourceDir, options = {}) {
  const analyzer = new ContentAnalyzer();
  const results = {
    cleanFiles: [],
    excludedFiles: [],
    cleanedFiles: []
  };

  log('blue', '🛡️  Starting private content safeguard check...');
  log('blue', `📂 Source directory: ${sourceDir}`);

  // ファイル一覧取得
  const glob = require('glob');
  const files = glob.sync('**/*.md', {
    cwd: sourceDir,
    ignore: ['node_modules/**', 'public/**', '.git/**']
  });

  log('blue', `📋 Found ${files.length} markdown files to analyze`);

  // 各ファイルを分析
  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const analysis = await analyzer.analyzeFile(filePath);

    if (analysis.shouldExclude) {
      results.excludedFiles.push({
        path: file,
        reason: analysis.reason
      });
      log('red', `❌ Excluded: ${file} (${analysis.reason})`);
    } else if (analysis.issues > 0) {
      results.cleanedFiles.push({
        path: file,
        issues: analysis.issues
      });
      log('yellow', `🧹 Will clean: ${file} (${analysis.issues} issues)`);
    } else {
      results.cleanFiles.push(file);
      log('green', `✅ Clean: ${file}`);
    }
  }

  // レポート表示
  analyzer.displayReport();

  // レポート保存
  if (options.saveReport) {
    const reportPath = path.join(sourceDir, '.safeguard-report.json');
    await analyzer.saveReport(reportPath);
  }

  return {
    analyzer,
    results,
    hasViolations: analyzer.violations.length > 0,
    hasWarnings: analyzer.warnings.length > 0
  };
}

// コマンドライン実行時
if (require.main === module) {
  const sourceDir = process.argv[2] || '.';
  const saveReport = process.argv.includes('--save-report');
  
  runSafeguardCheck(sourceDir, { saveReport })
    .then(({ hasViolations, hasWarnings }) => {
      if (hasViolations) {
        log('red', '❌ Safeguard check failed: Critical violations detected');
        process.exit(1);
      } else if (hasWarnings) {
        log('yellow', '⚠️  Safeguard check completed with warnings');
        process.exit(0);
      } else {
        log('green', '✅ Safeguard check passed: No issues detected');
        process.exit(0);
      }
    })
    .catch(error => {
      log('red', `❌ Safeguard check error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  ContentAnalyzer,
  runSafeguardCheck,
  cleanContent,
  SENSITIVE_PATTERNS,
  PRIVATE_CONTENT_PATTERNS,
  EXCLUDED_FILE_PATTERNS
};