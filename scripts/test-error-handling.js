#!/usr/bin/env node

/**
 * エラーハンドリングシステムのテスト
 */

const { 
  BuildError, 
  RetryManager, 
  RollbackManager, 
  ERROR_CODES, 
  logger 
} = require('./utils/error-handler');

// テスト1: カスタムエラーのテスト
async function testCustomErrors() {
  console.log('\n=== カスタムエラーのテスト ===');
  
  try {
    throw new BuildError(
      'テスト用エラーメッセージ',
      ERROR_CODES.FILE_NOT_FOUND,
      { filePath: '/test/path' }
    );
  } catch (error) {
    logger.error('カスタムエラーが正常にキャッチされました', {
      code: error.code,
      context: error.context
    });
  }
}

// テスト2: リトライ機能のテスト
async function testRetryMechanism() {
  console.log('\n=== リトライ機能のテスト ===');
  
  let attempt = 0;
  
  try {
    const result = await RetryManager.retry(async () => {
      attempt++;
      logger.debug(`試行回数: ${attempt}`);
      
      if (attempt < 3) {
        throw new Error(`試行 ${attempt} 失敗`);
      }
      
      return `成功: 試行 ${attempt}`;
    }, {
      maxRetries: 3,
      delay: 100
    });
    
    logger.info('リトライが成功しました', { result });
  } catch (error) {
    logger.error('リトライが失敗しました', { error: error.message });
  }
}

// テスト3: ロールバック機能のテスト
async function testRollbackMechanism() {
  console.log('\n=== ロールバック機能のテスト ===');
  
  const rollback = new RollbackManager();
  
  // ロールバック操作を追加
  rollback.addOperation(
    async () => logger.info('テストロールバック操作1を実行'),
    'テスト操作1'
  );
  
  rollback.addOperation(
    async () => logger.info('テストロールバック操作2を実行'),
    'テスト操作2'
  );
  
  // ロールバック実行
  await rollback.execute();
}

// テスト4: ログレベルのテスト
async function testLogLevels() {
  console.log('\n=== ログレベルのテスト ===');
  
  logger.debug('デバッグメッセージ');
  logger.info('情報メッセージ');
  logger.warn('警告メッセージ');
  logger.error('エラーメッセージ');
}

// テスト5: エラーレポート生成のテスト
async function testErrorReport() {
  console.log('\n=== エラーレポート生成のテスト ===');
  
  // 意図的にエラーを生成
  logger.error('ファイルが見つかりません (ENOENT)', { file: '/test/file' });
  logger.error('権限が拒否されました (EACCES)', { file: '/test/file2' });
  
  // エラーレポート生成
  const report = logger.generateErrorReport();
  console.log('\n--- エラーレポート ---');
  console.log(report);
}

// メインテスト実行
async function runTests() {
  try {
    logger.info('🧪 エラーハンドリングシステムのテストを開始します...');
    
    await testCustomErrors();
    await testRetryMechanism();
    await testRollbackMechanism();
    await testLogLevels();
    await testErrorReport();
    
    logger.info('✅ すべてのテストが完了しました');
    
  } catch (error) {
    logger.error('テスト実行中にエラーが発生しました', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runTests();
}

module.exports = { runTests };