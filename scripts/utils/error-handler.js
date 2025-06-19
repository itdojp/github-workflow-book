/**
 * 統一エラーハンドリングシステム
 * Enhanced error handling for build scripts
 */

const fs = require('fs').promises;
const path = require('path');

// エラーコード定義
const ERROR_CODES = {
  // ファイルシステムエラー
  FILE_NOT_FOUND: 'E001',
  FILE_ACCESS_DENIED: 'E002',
  DIRECTORY_CREATE_FAILED: 'E003',
  FILE_COPY_FAILED: 'E004',
  FILE_READ_FAILED: 'E005',
  FILE_WRITE_FAILED: 'E006',
  
  // 設定エラー
  CONFIG_NOT_FOUND: 'E101',
  CONFIG_PARSE_ERROR: 'E102',
  CONFIG_VALIDATION_ERROR: 'E103',
  
  // ビルドエラー
  BUILD_INIT_FAILED: 'E201',
  BUILD_PROCESS_FAILED: 'E202',
  BUILD_CLEANUP_FAILED: 'E203',
  CONTENT_PROCESS_FAILED: 'E204',
  ASSETS_COPY_FAILED: 'E205',
  
  // デプロイエラー
  DEPLOY_INIT_FAILED: 'E301',
  DEPLOY_GIT_FAILED: 'E302',
  DEPLOY_PUSH_FAILED: 'E303',
  DEPLOY_AUTH_FAILED: 'E304',
  
  // 汎用エラー
  UNKNOWN_ERROR: 'E999'
};

// ログレベル定義
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// カスタムエラークラス
class BuildError extends Error {
  constructor(message, code = ERROR_CODES.UNKNOWN_ERROR, context = {}) {
    super(message);
    this.name = 'BuildError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
    
    // スタックトレースを維持
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BuildError);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// ロガークラス
class Logger {
  constructor(options = {}) {
    this.level = options.level || LOG_LEVELS.INFO;
    this.outputFile = options.outputFile;
    this.enableColors = options.enableColors !== false;
    this.errors = [];
  }
  
  // カラーコード
  get colors() {
    return {
      DEBUG: '\x1b[36m',  // シアン
      INFO: '\x1b[32m',   // 緑
      WARN: '\x1b[33m',   // 黄色
      ERROR: '\x1b[31m',  // 赤
      RESET: '\x1b[0m'    // リセット
    };
  }
  
  formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const prefix = this.enableColors ? 
      `${this.colors[level]}[${level}]${this.colors.RESET}` : 
      `[${level}]`;
    
    let formatted = `${timestamp} ${prefix} ${message}`;
    
    if (Object.keys(context).length > 0) {
      formatted += `\n  Context: ${JSON.stringify(context, null, 2)}`;
    }
    
    return formatted;
  }
  
  async log(level, message, context = {}) {
    const levelValue = LOG_LEVELS[level];
    if (levelValue < this.level) return;
    
    const formatted = this.formatMessage(level, message, context);
    console.log(formatted);
    
    // ファイル出力
    if (this.outputFile) {
      try {
        await fs.appendFile(this.outputFile, formatted + '\n');
      } catch (error) {
        console.error('ログファイルへの書き込みに失敗:', error.message);
      }
    }
    
    // エラーの場合は記録
    if (level === 'ERROR') {
      this.errors.push({
        message,
        context,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  debug(message, context) { return this.log('DEBUG', message, context); }
  info(message, context) { return this.log('INFO', message, context); }
  warn(message, context) { return this.log('WARN', message, context); }
  error(message, context) { return this.log('ERROR', message, context); }
  
  // エラーレポート生成
  generateErrorReport() {
    if (this.errors.length === 0) {
      return 'エラーは発生していません。';
    }
    
    let report = `エラーレポート (${new Date().toISOString()})\n`;
    report += '='.repeat(50) + '\n\n';
    
    this.errors.forEach((error, index) => {
      report += `エラー ${index + 1}:\n`;
      report += `  メッセージ: ${error.message}\n`;
      report += `  時刻: ${error.timestamp}\n`;
      if (Object.keys(error.context).length > 0) {
        report += `  詳細: ${JSON.stringify(error.context, null, 2)}\n`;
      }
      report += '\n';
    });
    
    // 自動診断
    report += this.generateDiagnosis();
    
    return report;
  }
  
  // よくあるエラーの自動診断
  generateDiagnosis() {
    if (this.errors.length === 0) return '';
    
    let diagnosis = '自動診断:\n';
    diagnosis += '-'.repeat(20) + '\n';
    
    const errorMessages = this.errors.map(e => e.message.toLowerCase());
    
    // よくあるエラーパターンをチェック
    if (errorMessages.some(msg => msg.includes('enoent') || msg.includes('file not found'))) {
      diagnosis += '• ファイルが見つからないエラーが発生しています。\n';
      diagnosis += '  → ファイルパスとファイルの存在を確認してください。\n\n';
    }
    
    if (errorMessages.some(msg => msg.includes('eacces') || msg.includes('permission denied'))) {
      diagnosis += '• ファイルアクセス権限エラーが発生しています。\n';
      diagnosis += '  → ファイル権限を確認し、必要に応じて chmod で修正してください。\n\n';
    }
    
    if (errorMessages.some(msg => msg.includes('emfile') || msg.includes('too many open files'))) {
      diagnosis += '• ファイルハンドル不足エラーが発生しています。\n';
      diagnosis += '  → 大量のファイル処理時に発生する可能性があります。\n\n';
    }
    
    if (errorMessages.some(msg => msg.includes('out of memory') || msg.includes('heap'))) {
      diagnosis += '• メモリ不足エラーが発生しています。\n';
      diagnosis += '  → NODE_OPTIONS="--max-old-space-size=4096" を設定してみてください。\n\n';
    }
    
    return diagnosis;
  }
}

// リトライ機能
class RetryManager {
  static async retry(operation, options = {}) {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = 2,
      retryCondition = () => true
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !retryCondition(error)) {
          throw error;
        }
        
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        logger.warn(`リトライ ${attempt}/${maxRetries} - ${waitTime}ms後に再試行`, {
          error: error.message,
          attempt,
          waitTime
        });
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError;
  }
}

// ロールバック機能
class RollbackManager {
  constructor() {
    this.operations = [];
  }
  
  addOperation(rollbackFn, description) {
    this.operations.push({ rollbackFn, description });
  }
  
  async execute() {
    logger.info('ロールバック処理を開始...');
    
    for (const operation of this.operations.reverse()) {
      try {
        logger.debug(`ロールバック実行: ${operation.description}`);
        await operation.rollbackFn();
      } catch (error) {
        logger.error(`ロールバック失敗: ${operation.description}`, {
          error: error.message
        });
      }
    }
    
    logger.info('ロールバック処理完了');
  }
  
  clear() {
    this.operations = [];
  }
}

// グローバルロガーインスタンス
const logger = new Logger({
  level: process.env.DEBUG ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO,
  outputFile: process.env.LOG_FILE,
  enableColors: process.stdout.isTTY
});

// プロセス終了時のクリーンアップ
process.on('uncaughtException', async (error) => {
  logger.error('未処理の例外が発生しました', {
    error: error.message,
    stack: error.stack
  });
  
  console.log('\n' + logger.generateErrorReport());
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('未処理のPromise拒否が発生しました', {
    reason: reason?.message || reason,
    stack: reason?.stack
  });
  
  console.log('\n' + logger.generateErrorReport());
  process.exit(1);
});

module.exports = {
  BuildError,
  Logger,
  RetryManager,
  RollbackManager,
  ERROR_CODES,
  LOG_LEVELS,
  logger
};