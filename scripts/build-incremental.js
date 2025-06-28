#!/usr/bin/env node

/**
 * インクリメンタルビルドスクリプト
 * 変更されたファイルのみを公開用コンテンツとして生成
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { 
  BuildError, 
  RetryManager, 
  RollbackManager, 
  ERROR_CODES, 
  logger 
} = require('./utils/error-handler');

// 設定ファイルの読み込み
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    // デフォルト設定とマージ
    return {
      srcDir: path.join(__dirname, '..', 'src'),
      publicDir: path.join(__dirname, '..', 'public'),
      chaptersDir: 'chapters',
      assetsDir: 'assets',
      metaFile: path.join(__dirname, '..', '.build-meta.json'),
      ...userConfig
    };
  } catch (error) {
    console.warn('book-config.json not found, using default configuration');
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    srcDir: path.join(__dirname, '..', 'src'),
    publicDir: path.join(__dirname, '..', 'public'),
    chaptersDir: 'chapters',
    assetsDir: 'assets',
    metaFile: path.join(__dirname, '..', '.build-meta.json'),
    
    contentSections: [
      {
        name: 'introduction',
        title: 'はじめに',
        directory: 'introduction',
        enabled: true,
        order: 1
      },
      {
        name: 'chapters',
        title: '本章',
        directory: 'chapters',
        enabled: true,
        order: 2,
        numbering: true
      },
      {
        name: 'appendices',
        title: '付録',
        directory: 'appendices',
        enabled: true,
        order: 3,
        numbering: true,
        numberingPrefix: '付録'
      },
      {
        name: 'afterword',
        title: 'あとがき',
        directory: 'afterword',
        enabled: true,
        order: 4
      }
    ],
    
    tableOfContents: {
      enabled: true,
      outputFile: 'table-of-contents.md',
      title: '目次',
      maxDepth: 3,
      includeNumbers: true,
      autoLink: true
    },
    
    excludePatterns: [
      'draft.md',
      'notes.md',
      'solutions.md',
      'instructor.md',
      'private.md',
      '*.tmp'
    ],
    
    contentExcludePatterns: [
      '<!-- TODO:',
      '<!-- FIXME:',
      '<!-- PRIVATE:',
      '<!-- INSTRUCTOR:'
    ],
    
    publicFiles: [
      'index.md',
      'README.md',
      'setup-guide.md'
    ]
  };
}

// グローバル設定変数
let CONFIG;

// ビルドメタデータ管理（強化版）
class BuildMeta {
  constructor() {
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
    this.dependencies = {};
    this.startTime = Date.now();
  }

  async load() {
    try {
      logger.debug('ビルドメタデータ読み込み開始', { file: CONFIG.metaFile });
      const content = await fs.readFile(CONFIG.metaFile, 'utf-8');
      const meta = JSON.parse(content);
      
      // Support both old and new format
      if (meta.data) {
        this.data = meta.data;
        this.dependencies = meta.dependencies || {};
      } else {
        this.data = meta;
        this.dependencies = {};
      }
      
      logger.debug('ビルドメタデータを読み込みました', { entryCount: Object.keys(this.data.files || this.data).length });
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('ビルドメタデータファイルが存在しません。初回ビルドとして実行します');
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
        this.dependencies = {};
      } else if (error instanceof SyntaxError) {
        logger.warn('ビルドメタデータファイルが破損しています。初期化します', {
          file: CONFIG.metaFile,
          error: error.message
        });
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
        this.dependencies = {};
      } else {
        throw new BuildError(
          'ビルドメタデータの読み込みに失敗しました',
          ERROR_CODES.FILE_READ_FAILED,
          { file: CONFIG.metaFile, error: error.message }
        );
      }
    }
  }

  async save() {
    try {
      const meta = {
        data: this.data,
        dependencies: this.dependencies
      };
      
      await RetryManager.retry(async () => {
        await fs.writeFile(CONFIG.metaFile, JSON.stringify(meta, null, 2));
      }, {
        maxRetries: 3,
        retryCondition: (error) => error.code === 'EBUSY'
      });
      
      logger.debug('ビルドメタデータを保存しました', { 
        file: CONFIG.metaFile,
        entryCount: Object.keys(this.data.files || this.data).length
      });
    } catch (error) {
      throw new BuildError(
        'ビルドメタデータの保存に失敗しました',
        ERROR_CODES.FILE_WRITE_FAILED,
        { file: CONFIG.metaFile, error: error.message }
      );
    }
  }

  async hasChanged(filePath, content) {
    try {
      const hash = crypto.createHash('md5').update(content).digest('hex');
      const prevHash = this.data[filePath];
      
      if (prevHash !== hash) {
        this.data[filePath] = hash;
        logger.debug('ファイル変更を検出しました', { filePath, prevHash, newHash: hash });
        return true;
      }
      
      logger.debug('ファイルに変更はありません', { filePath });
      return false;
    } catch (error) {
      logger.warn('ファイルハッシュの計算に失敗しました', {
        filePath,
        error: error.message
      });
      // ハッシュ計算失敗時は変更ありとして処理
      return true;
    }
  }

  // 依存関係を設定
  setDependencies(filePath, deps) {
    this.dependencies[filePath] = deps;
  }

  // ファイルに依存するファイルを取得
  getDependents(filePath) {
    const dependents = [];
    for (const [file, deps] of Object.entries(this.dependencies)) {
      if (deps && deps.includes(filePath)) {
        dependents.push(file);
      }
    }
    return dependents;
  }

  // ファイルまたはその依存ファイルが変更されたかチェック
  hasFileOrDependencyChanged(filePath, changedFiles) {
    if (changedFiles.has(filePath)) {
      return true;
    }
    
    const deps = this.dependencies[filePath] || [];
    return deps.some(dep => changedFiles.has(dep));
  }

  markDeleted(filePath) {
    delete this.data[filePath];
    delete this.dependencies[filePath];
    logger.debug('ファイル削除をマークしました', { filePath });
  }
}

// ユーティリティ関数
async function ensureDir(dir) {
  try {
    await RetryManager.retry(async () => {
      await fs.mkdir(dir, { recursive: true });
    }, {
      maxRetries: 3,
      retryCondition: (error) => error.code === 'EMFILE' || error.code === 'EBUSY'
    });
    logger.debug('ディレクトリを作成しました', { dir });
  } catch (error) {
    throw new BuildError(
      `ディレクトリの作成に失敗しました: ${dir}`,
      ERROR_CODES.DIRECTORY_CREATE_FAILED,
      { dir, error: error.message }
    );
  }
}

async function shouldExclude(filePath) {
  const fileName = path.basename(filePath);
  
  for (const pattern of CONFIG.excludePatterns) {
    if (typeof pattern === 'string') {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\./g, '\\.');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(fileName)) {
          return true;
        }
      } else {
        if (fileName === pattern) {
          return true;
        }
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(fileName)) {
        return true;
      }
    }
  }
  
  return false;
}

function cleanContent(content) {
  // セーフガードシステムによるクリーニング（優先）
  content = safeguardCleanContent(content);
  
  // 従来の設定ベースクリーニング（追加保護）
  for (const pattern of CONFIG.contentExcludePatterns) {
    if (pattern.includes('TODO:')) {
      content = content.replace(/<!--\s*TODO:[\s\S]*?-->/g, '');
    } else if (pattern.includes('FIXME:')) {
      content = content.replace(/<!--\s*FIXME:[\s\S]*?-->/g, '');
    } else if (pattern.includes('PRIVATE:')) {
      content = content.replace(/<!--\s*PRIVATE:[\s\S]*?-->/g, '');
    } else if (pattern.includes('INSTRUCTOR:')) {
      content = content.replace(/<!--\s*INSTRUCTOR:[\s\S]*?-->/g, '');
    }
  }
  
  // 講師向けセクションの削除
  content = content.replace(/##\s*講師向け[\s\S]*?(?=##|$)/g, '');
  content = content.replace(/##\s*Instructor[\s\S]*?(?=##|$)/g, '');
  
  return content;
}

// Markdownファイルから依存関係を抽出
function extractDependencies(content, basePath) {
  const dependencies = [];
  
  // Markdownリンクをチェック: [text](./path/to/file.md)
  const linkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  let match;
  
  while ((match = linkPattern.exec(content)) !== null) {
    const linkPath = match[2];
    
    // 相対パスを絶対パスに変換
    if (linkPath.startsWith('./') || linkPath.startsWith('../')) {
      const resolvedPath = path.resolve(path.dirname(basePath), linkPath);
      dependencies.push(resolvedPath);
    }
  }
  
  // インクルードパターンもチェック: {% include path/to/file.md %}
  const includePattern = /\{%\s*include\s+([^\s%]+\.md)\s*%\}/g;
  
  while ((match = includePattern.exec(content)) !== null) {
    const includePath = match[1];
    const resolvedPath = path.resolve(path.dirname(basePath), includePath);
    dependencies.push(resolvedPath);
  }
  
  return dependencies;
}

// ファイル処理の統計情報
class ProcessingStats {
  constructor() {
    this.processed = 0;
    this.skipped = 0;
    this.failed = 0;
    this.deleted = 0;
    this.startTime = Date.now();
  }

  addProcessed() { this.processed++; }
  addSkipped() { this.skipped++; }
  addFailed() { this.failed++; }
  addDeleted() { this.deleted++; }

  getElapsedTime() {
    return ((Date.now() - this.startTime) / 1000).toFixed(2);
  }

  getSummary() {
    return {
      processed: this.processed,
      skipped: this.skipped,
      failed: this.failed,
      deleted: this.deleted,
      elapsed: this.getElapsedTime() + 's',
      total: this.processed + this.skipped
    };
  }
}

async function processFile(srcPath, destPath, meta, stats) {
  try {
    // 除外チェック
    if (await shouldExclude(srcPath)) {
      console.log(`⏭️  Excluded: ${srcPath}`);
      stats.addSkipped();
      return false;
    }

    let content = await fs.readFile(srcPath, 'utf-8');
    
    // 依存関係を抽出してメタデータに保存
    const dependencies = extractDependencies(content, srcPath);
    meta.setDependencies(srcPath, dependencies);
    
    // コンテンツが変更されているか確認
    if (!await meta.hasChanged(srcPath, content)) {
      const fileInfo = meta.getFileInfo(srcPath);
      console.log(`⏭️  Unchanged: ${srcPath} (built ${fileInfo.buildCount} times)`);
      stats.addSkipped();
      return false;
    }
    
    // コンテンツのクリーニング
    content = cleanContent(content);
    
    // ディレクトリの確認
    await ensureDir(path.dirname(destPath));
    
    // ファイルの書き込み
    await fs.writeFile(destPath, content, 'utf-8');
    console.log(`✅ Processed: ${srcPath} -> ${destPath}`);
    stats.addProcessed();
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${srcPath}:`, error.message);
    stats.addFailed();
    return false;
  }
}

async function processContentSection(meta, stats, section) {
  const sectionPath = path.join(CONFIG.srcDir, section.directory);
  
  try {
    const items = await fs.readdir(sectionPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        const itemSrcDir = path.join(sectionPath, item.name);
        const itemDestDir = path.join(CONFIG.publicDir, section.directory, item.name);
        
        const files = await fs.readdir(itemSrcDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const srcPath = path.join(itemSrcDir, file);
            const destPath = path.join(itemDestDir, file);
            await processFile(srcPath, destPath, meta, stats);
          }
        }
      } else if (item.isFile() && item.name.endsWith('.md')) {
        const srcPath = path.join(sectionPath, item.name);
        const destPath = path.join(CONFIG.publicDir, section.directory, item.name);
        await processFile(srcPath, destPath, meta, stats);
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⏭️  No ${section.name} directory found (optional)`);
    } else {
      console.error(`Failed to process ${section.name}:`, error);
    }
  }
}

async function processRootFiles(meta, stats) {
  const projectRoot = path.join(__dirname, '..');
  
  for (const file of CONFIG.publicFiles) {
    const srcPath = path.join(projectRoot, file);
    const destPath = path.join(CONFIG.publicDir, file);
    
    try {
      await processFile(srcPath, destPath, meta, stats);
    } catch (error) {
      console.warn(`⚠️  Failed to process ${file}:`, error.message);
    }
  }
}

async function copyAssets(srcDir, destDir, meta, stats) {
  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      
      if (entry.isDirectory()) {
        await ensureDir(destPath);
        await copyAssets(srcPath, destPath, meta, stats);
      } else if (entry.isFile()) {
        const content = await fs.readFile(srcPath);
        
        if (await meta.hasChanged(srcPath, content.toString('base64'))) {
          await fs.copyFile(srcPath, destPath);
          console.log(`✅ Copied: ${srcPath} -> ${destPath}`);
          stats.addProcessed();
        } else {
          stats.addSkipped();
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to copy assets from ${srcDir}:`, error);
    }
  }
}

async function copyJekyllConfig(meta, stats) {
  const projectRoot = path.join(__dirname, '..');
  
  // _config.yml
  try {
    const srcPath = path.join(projectRoot, '_config.yml');
    const destPath = path.join(CONFIG.publicDir, '_config.yml');
    const content = await fs.readFile(srcPath, 'utf-8');
    
    if (await meta.hasChanged(srcPath, content)) {
      await fs.copyFile(srcPath, destPath);
      console.log(`✅ Copied: _config.yml`);
      stats.addProcessed();
    } else {
      stats.addSkipped();
    }
  } catch (error) {
    // Jekyll設定ファイルは必須ではない
  }
  
  // _layouts
  const layoutsSrc = path.join(projectRoot, '_layouts');
  const layoutsDest = path.join(CONFIG.publicDir, '_layouts');
  
  try {
    await ensureDir(layoutsDest);
    const files = await fs.readdir(layoutsSrc);
    
    for (const file of files) {
      const srcPath = path.join(layoutsSrc, file);
      const destPath = path.join(layoutsDest, file);
      const content = await fs.readFile(srcPath, 'utf-8');
      
      if (await meta.hasChanged(srcPath, content)) {
        await fs.copyFile(srcPath, destPath);
        console.log(`✅ Copied: _layouts/${file}`);
        stats.addProcessed();
      } else {
        stats.addSkipped();
      }
    }
  } catch (error) {
    // レイアウトディレクトリは必須ではない
  }
}

async function cleanDeletedFiles(meta, stats) {
  const deletedFiles = [];
  
  for (const filePath in meta.data.files) {
    try {
      await fs.access(filePath);
    } catch (error) {
      // ファイルが存在しない場合
      const relativePath = filePath.replace(path.join(__dirname, '..') + path.sep, '');
      const publicPath = relativePath.replace(CONFIG.srcDir.replace(path.join(__dirname, '..'), '').substring(1), 'public');
      const destPath = path.join(__dirname, '..', publicPath);
      
      try {
        await fs.unlink(destPath);
        meta.markDeleted(filePath);
        deletedFiles.push(relativePath);
        console.log(`🗑️  Deleted: ${relativePath}`);
        stats.addDeleted();
      } catch (error) {
        // 削除に失敗しても続行
      }
    }
  }
  
  return deletedFiles;
}

// 目次の生成（インクリメンタル対応）
async function generateTableOfContents(meta, stats) {
  if (!CONFIG.tableOfContents.enabled) {
    return;
  }
  
  // 目次生成は軽量なので、常に実行
  console.log('\nGenerating table of contents...');
  
  // 簡易的な目次生成（フルビルドのロジックを簡略化）
  const tocPath = path.join(CONFIG.publicDir, CONFIG.tableOfContents.outputFile);
  const tocContent = `# ${CONFIG.tableOfContents.title}\n\n*目次は現在生成中です。フルビルドを実行してください。*\n`;
  
  await fs.writeFile(tocPath, tocContent, 'utf-8');
  console.log(`✅ Generated: ${tocPath} (simplified)`);
  stats.addProcessed();
}

// ファイル変更の検出（依存関係を考慮しない初期スキャン）
async function findChangedFiles(meta) {
  const changedFiles = new Set();
  const projectRoot = path.join(__dirname, '..');
  
  // すべてのコンテンツファイルをスキャン
  for (const section of CONFIG.contentSections) {
    const sectionPath = path.join(CONFIG.srcDir, section);
    
    try {
      const items = await fs.readdir(sectionPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const itemSrcDir = path.join(sectionPath, item.name);
          const files = await fs.readdir(itemSrcDir);
          
          for (const file of files) {
            if (file.endsWith('.md') && !await shouldExclude(file)) {
              const srcPath = path.join(itemSrcDir, file);
              await checkFileChanged(srcPath, meta, changedFiles);
            }
          }
        } else if (item.isFile() && item.name.endsWith('.md') && !await shouldExclude(item.name)) {
          const srcPath = path.join(sectionPath, item.name);
          await checkFileChanged(srcPath, meta, changedFiles);
        }
      }
    } catch (error) {
      // セクションが存在しない場合は無視
    }
  }
  
  // ルートファイルもチェック
  for (const file of CONFIG.rootFiles) {
    const srcPath = path.join(projectRoot, file);
    await checkFileChanged(srcPath, meta, changedFiles);
  }
  
  return changedFiles;
}

async function checkFileChanged(srcPath, meta, changedFiles) {
  try {
    const content = await fs.readFile(srcPath, 'utf-8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const prevHash = meta.data[srcPath];
    
    if (prevHash !== hash) {
      changedFiles.add(srcPath);
    }
  } catch (error) {
    // ファイル読み込みエラーは無視
  }
}

// 依存関係を考慮したコンテンツセクション処理
async function processContentSectionWithDependencies(meta, sectionName, changedFiles) {
  let processedCount = 0;
  const sectionPath = path.join(CONFIG.srcDir, sectionName);
  
  try {
    const items = await fs.readdir(sectionPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        const itemSrcDir = path.join(sectionPath, item.name);
        const itemDestDir = path.join(CONFIG.publicDir, sectionName, item.name);
        
        const files = await fs.readdir(itemSrcDir);
        for (const file of files) {
          if (file.endsWith('.md') && !await shouldExclude(file)) {
            const srcPath = path.join(itemSrcDir, file);
            const destPath = path.join(itemDestDir, file);
            
            // ファイル自体または依存関係が変更された場合のみ処理
            if (meta.hasFileOrDependencyChanged(srcPath, changedFiles) || changedFiles.has(srcPath)) {
              if (await processFile(srcPath, destPath, meta)) {
                processedCount++;
              }
            } else {
              // 依存関係の更新のみ（実際のファイル処理はスキップ）
              try {
                const content = await fs.readFile(srcPath, 'utf-8');
                const dependencies = extractDependencies(content, srcPath);
                meta.setDependencies(srcPath, dependencies);
                console.log(`⏭️  Skipped (unchanged): ${srcPath}`);
              } catch (error) {
                // エラーが発生した場合は通常の処理を実行
                if (await processFile(srcPath, destPath, meta)) {
                  processedCount++;
                }
              }
            }
          }
        }
      } else if (item.isFile() && item.name.endsWith('.md') && !await shouldExclude(item.name)) {
        const srcPath = path.join(sectionPath, item.name);
        const destPath = path.join(CONFIG.publicDir, sectionName, item.name);
        
        if (meta.hasFileOrDependencyChanged(srcPath, changedFiles) || changedFiles.has(srcPath)) {
          if (await processFile(srcPath, destPath, meta)) {
            processedCount++;
          }
        } else {
          try {
            const content = await fs.readFile(srcPath, 'utf-8');
            const dependencies = extractDependencies(content, srcPath);
            meta.setDependencies(srcPath, dependencies);
            console.log(`⏭️  Skipped (unchanged): ${srcPath}`);
          } catch (error) {
            if (await processFile(srcPath, destPath, meta)) {
              processedCount++;
            }
          }
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⏭️  No ${sectionName} directory found (optional)`);
    } else {
      console.error(`Failed to process ${sectionName}:`, error);
    }
  }
  
  return processedCount;
}

// 依存関係を考慮したルートファイル処理
async function processRootFilesWithDependencies(meta, changedFiles) {
  let processedCount = 0;
  const projectRoot = path.join(__dirname, '..');
  
  for (const file of CONFIG.rootFiles) {
    const srcPath = path.join(projectRoot, file);
    const destPath = path.join(CONFIG.publicDir, file);
    
    try {
      if (meta.hasFileOrDependencyChanged(srcPath, changedFiles) || changedFiles.has(srcPath)) {
        if (await processFile(srcPath, destPath, meta)) {
          processedCount++;
        }
      } else {
        try {
          const content = await fs.readFile(srcPath, 'utf-8');
          const dependencies = extractDependencies(content, srcPath);
          meta.setDependencies(srcPath, dependencies);
          console.log(`⏭️  Skipped (unchanged): ${file}`);
        } catch (error) {
          if (await processFile(srcPath, destPath, meta)) {
            processedCount++;
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to process ${file}:`, error.message);
    }
  }
  
  return processedCount;
}

// メインビルド関数
async function buildIncremental() {
  const rollback = new RollbackManager();
  
  try {
    logger.info('🔨 インクリメンタルビルドを開始します...');
    
    const meta = new BuildMeta();
    await meta.load();
    
    // publicディレクトリが存在しない場合は作成
    logger.info('📁 出力ディレクトリを準備中...');
    await ensureDir(CONFIG.publicDir);
    for (const section of CONFIG.contentSections) {
      await ensureDir(path.join(CONFIG.publicDir, section));
    }
    
    // Phase 1: Determine which files have changed
    console.log('Phase 1: Analyzing file changes and dependencies...');
    const changedFiles = await findChangedFiles(meta);
    
    let totalProcessed = 0;
    
    // 1. 削除されたファイルのクリーンアップ
    logger.info('🗑️  削除されたファイルをチェック中...');
    const deletedCount = await cleanDeletedFiles(meta);
    if (deletedCount > 0) {
      logger.info(`${deletedCount} 個のファイルを削除しました`);
    }
    
    // 2. コンテンツセクションの処理（順序を保持）
    logger.info('📄 コンテンツセクションを処理中...');
    for (const section of CONFIG.contentSections) {
      logger.info(`${section} セクションを処理中...`);
      try {
        const processed = await processContentSectionWithDependencies(meta, section, changedFiles);
        totalProcessed += processed;
        logger.info(`${section} セクションで ${processed} ファイルを処理しました`);
      } catch (error) {
        logger.error(`${section} セクションの処理中にエラーが発生しました`, {
          section,
          error: error.message
        });
        throw error;
      }
    }
    
    // 3. ルートファイルの処理
    logger.info('📋 ルートファイルを処理中...');
    const rootProcessed = await processRootFilesWithDependencies(meta, changedFiles);
    totalProcessed += rootProcessed;
    logger.info(`ルートファイル ${rootProcessed} 個を処理しました`);
    
    // 4. Jekyll設定のコピー
    logger.info('⚙️  Jekyll設定を処理中...');
    const jekyllProcessed = await copyJekyllConfig(meta);
    totalProcessed += jekyllProcessed;
    
    // 5. メタデータの保存
    logger.debug('メタデータを保存中...');
    await meta.save();
    
    // ロールバック操作をクリア（正常完了）
    rollback.clear();
    
    // 結果サマリー
    logger.info('='.repeat(50));
    logger.info('✅ インクリメンタルビルドが正常に完了しました！');
    logger.info('📊 ビルドサマリー:');
    logger.info(`   - 処理されたファイル: ${totalProcessed}`);
    logger.info(`   - 削除されたファイル: ${deletedCount}`);
    logger.info(`   - スキップされたファイル: ${Object.keys(meta.data).length - totalProcessed}`);
    if (changedFiles.size > 0) {
      logger.info(`   - 変更されたファイル: ${changedFiles.size}`);
    }
    logger.info(`📁 出力ディレクトリ: ${CONFIG.publicDir}`);
    
  } catch (error) {
    logger.error('❌ インクリメンタルビルドが失敗しました', {
      error: error.message,
      code: error.code,
      context: error.context
    });
    
    // ロールバック実行
    await rollback.execute();
    
    // エラーレポート生成
    const errorReport = logger.generateErrorReport();
    console.log('\n' + errorReport);
    
    throw new BuildError(
      'インクリメンタルビルドプロセスが失敗しました',
      ERROR_CODES.BUILD_PROCESS_FAILED,
      { originalError: error.message }
    );
  }
}

// 実行
if (require.main === module) {
  buildIncremental();
}

module.exports = { buildIncremental, CONFIG };