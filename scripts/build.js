#!/usr/bin/env node

/**
 * ビルドスクリプト
 * プライベートリポジトリから公開用コンテンツを生成
 * バージョン管理機能付き
 */

const fs = require('fs').promises;
const path = require('path');
const ImageOptimizer = require('./image-optimizer');
const { 
  BuildError, 
  RetryManager, 
  RollbackManager, 
  ERROR_CODES, 
  logger 
} = require('./utils/error-handler');

// Version Managerを読み込み（存在する場合）
let VersionManager;
try {
  VersionManager = require('./version-manager').VersionManager;
} catch (error) {
  // Version Manager がない場合は無視
  logger.debug('Version Manager not available');
}

let CONFIG = null;

// 設定ファイルの読み込み
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    logger.debug('設定ファイル読み込み開始', { configPath });
    const configContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    logger.info('設定ファイルを正常に読み込みました');
    
    // デフォルト設定とマージ
    return {
      contentSections: [
        { name: 'introduction', title: 'はじめに', directory: 'introduction', enabled: true, order: 1 },
        { name: 'chapters', title: '本章', directory: 'chapters', enabled: true, order: 2, numbering: true },
        { name: 'tutorials', title: 'チュートリアル', directory: 'tutorials', enabled: true, order: 3, numbering: true },
        { name: 'appendices', title: '付録', directory: 'appendices', enabled: true, order: 4, numbering: true, numberingPrefix: '付録' },
        { name: 'exercises', title: '練習問題', directory: 'exercises', enabled: true, order: 5 },
        { name: 'afterword', title: 'あとがき', directory: 'afterword', enabled: true, order: 6 }
      ],
      tableOfContents: {
        enabled: true,
        outputFile: 'table-of-contents.md',
        title: '目次',
        maxDepth: 3,
        includeNumbers: true,
        autoLink: true,
        autoNumberChapters: true,
        detectExistingNumbers: true
      },
      excludePatterns: [
        'draft.md',
        'notes.md',
        'solutions.md',
        'instructor.md',
        'private.md',
        'confidential.md',
        'secret.md',
        'private-to-public-deployment-guide.md',
        '*.tmp',
        '*.backup',
        '*.bak',
        '.private',
        '.confidential'
      ],
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
      publicFiles: [
        'index.md',
        'README.md',
        'setup-guide.md'
      ],
      versionManagement: {
        enabled: true,
        autoCreateTags: true,
        autoGenerateReleaseNotes: true,
        semanticVersioning: true,
        releaseNotesInPublic: true,
        versionInFooter: true
      },
      imageOptimization: {
        enabled: true,
        quality: 85,
        formats: ["webp", "original"],
        maxWidth: 1920,
        stripMetadata: true,
        lazyLoad: true
      },
      ...userConfig
    };
  } catch (error) {
    throw new BuildError(`設定ファイルの読み込みに失敗しました: ${error.message}`, ERROR_CODES.CONFIG_ERROR, error);
  }
}

// メインビルド関数
async function build(options = {}) {
  const { version, skipVersionUpdate } = options;
  const rollback = new RollbackManager();
  
  console.log('🔨 Building public content from private repository...\n');
  
  if (version) {
    console.log(`📦 Building for version: ${version}`);
  }
  
  try {
    logger.info('🔨 公開用コンテンツのビルドを開始します...');
    
    // 設定の読み込み
    logger.info('📋 設定を読み込み中...');
    CONFIG = await loadConfig();
    logger.info('設定を正常に読み込みました');
    
    // バージョン管理の初期化（利用可能な場合）
    let versionManager;
    if (VersionManager && CONFIG.versionManagement && CONFIG.versionManagement.enabled) {
      versionManager = new VersionManager();
      
      if (version && !skipVersionUpdate) {
        console.log(`📋 Setting up build for version: ${version}`);
        await versionManager.setCurrentVersion(version);
      }
    }
    
    // プロジェクトルートディレクトリの確認
    const projectRoot = path.resolve(__dirname, '..');
    const srcDir = path.join(projectRoot, 'src');
    const publicDir = path.join(projectRoot, 'public');
    
    logger.debug('ディレクトリ情報', { 
      projectRoot, 
      srcDir, 
      publicDir 
    });
    
    // 公開ディレクトリの作成
    logger.info('📁 公開ディレクトリを準備中...');
    await fs.mkdir(publicDir, { recursive: true });
    rollback.addOperation(async () => {
      const exists = await fs.access(publicDir).then(() => true).catch(() => false);
      if (exists) {
        await fs.rmdir(publicDir, { recursive: true });
      }
    });
    
    logger.info('公開ディレクトリの準備が完了しました');
    
    // srcディレクトリの存在確認
    try {
      await fs.access(srcDir);
      logger.info('srcディレクトリが見つかりました');
    } catch (error) {
      throw new BuildError(
        'srcディレクトリが見つかりません。プロジェクトルートでスクリプトを実行してください。',
        ERROR_CODES.DIRECTORY_NOT_FOUND,
        error
      );
    }
    
    // コンテンツの処理
    const processedSections = await processContentSections(srcDir, publicDir, rollback);
    
    // 目次の生成
    if (CONFIG.tableOfContents && CONFIG.tableOfContents.enabled) {
      logger.info('📋 目次を生成中...');
      await generateTableOfContents(processedSections, publicDir);
      logger.info('目次の生成が完了しました');
    }
    
    // Jekyllファイルのコピー
    await copyJekyllFiles(projectRoot, publicDir, rollback);
    
    // 画像最適化の初期化
    let imageOptimizer = null;
    if (CONFIG.imageOptimization && CONFIG.imageOptimization.enabled) {
      imageOptimizer = new ImageOptimizer(CONFIG.imageOptimization);
      console.log('🎨 Image optimization enabled');
    }
    
    // アセットのコピー（画像最適化を含む）
    await copyAssets(projectRoot, publicDir, rollback, imageOptimizer);
    
    // 画像最適化レポートの出力
    if (imageOptimizer) {
      imageOptimizer.printReport();
    }
    
    // インデックスファイルの処理
    await processIndexFile(projectRoot, publicDir, rollback);
    
    // ルートファイルの処理（publicFilesで指定されたファイル）
    await processRootFiles(projectRoot, publicDir, rollback);
    
    // バージョン情報の更新（利用可能な場合）
    // TODO: Fix version manager integration
    // if (versionManager && !skipVersionUpdate) {
    //   logger.info('📝 バージョン情報を更新中...');
    //   await versionManager.updateBuildMetadata({
    //     timestamp: new Date().toISOString(),
    //     sectionsProcessed: processedSections.length,
    //     version: version || versionManager.currentVersion
    //   });
    //   logger.info('バージョン情報の更新が完了しました');
    // }
    
    logger.info('✅ ビルドが正常に完了しました！');
    console.log('\n✅ Build completed successfully!');
    console.log(`📁 Output directory: ${publicDir}`);
    
    if (processedSections.length > 0) {
      console.log(`📄 Processed ${processedSections.length} sections:`);
      processedSections.forEach(section => {
        console.log(`   - ${section.title} (${section.filesProcessed} files)`);
      });
    }
    
  } catch (error) {
    logger.error('ビルドエラーが発生しました', error);
    
    if (error instanceof BuildError) {
      console.error(`\n❌ Build Error [${error.code}]: ${error.message}`);
      if (error.details) {
        console.error('Details:', error.details);
      }
    } else {
      console.error('\n❌ Unexpected Error:', error.message);
    }
    
    console.log('\n🔄 Rolling back changes...');
    await rollback.execute();
    
    process.exit(1);
  }
}

// その他の関数は元のファイルから引き継ぎ
async function processContentSections(srcDir, publicDir, rollback) {
  const processedSections = [];
  const enabledSections = CONFIG.contentSections.filter(section => section.enabled);
  
  // セクションを順序でソート
  enabledSections.sort((a, b) => (a.order || 0) - (b.order || 0));
  
  for (const section of enabledSections) {
    logger.info(`📂 処理中: ${section.title}`);
    
    const sectionSrcDir = path.join(srcDir, section.directory);
    const sectionPublicDir = path.join(publicDir, section.directory);
    
    try {
      await fs.access(sectionSrcDir);
      const filesProcessed = await processSection(sectionSrcDir, sectionPublicDir, section, rollback);
      
      processedSections.push({
        name: section.name,
        title: section.title,
        directory: section.directory,
        filesProcessed
      });
      
      logger.info(`✅ ${section.title}の処理が完了しました (${filesProcessed}ファイル)`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn(`⚠️  ${section.title}のディレクトリが見つかりません: ${sectionSrcDir}`);
      } else {
        throw new BuildError(
          `${section.title}の処理中にエラーが発生しました: ${error.message}`,
          ERROR_CODES.PROCESSING_ERROR,
          error
        );
      }
    }
  }
  
  return processedSections;
}

async function processSection(srcDir, publicDir, section, rollback) {
  await fs.mkdir(publicDir, { recursive: true });
  rollback.addOperation(async () => {
    const exists = await fs.access(publicDir).then(() => true).catch(() => false);
    if (exists) {
      await fs.rmdir(publicDir, { recursive: true });
    }
  });
  
  let filesProcessed = 0;
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const publicPath = path.join(publicDir, entry.name);
    
    if (entry.isDirectory()) {
      filesProcessed += await processSection(srcPath, publicPath, section, rollback);
    } else if (entry.isFile()) {
      if (shouldIncludeFile(entry.name)) {
        if (entry.name.endsWith('.md')) {
          await processMarkdownFile(srcPath, publicPath, section, rollback);
        } else {
          await copyFile(srcPath, publicPath, rollback);
        }
        filesProcessed++;
      }
    }
  }
  
  return filesProcessed;
}

function shouldIncludeFile(filename) {
  // 除外パターンのチェック
  for (const pattern of CONFIG.excludePatterns) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(filename)) {
        return false;
      }
    } else if (filename === pattern) {
      return false;
    }
  }
  return true;
}

async function processMarkdownFile(srcPath, publicPath, section, rollback) {
  logger.debug(`Markdownファイルを処理中: ${srcPath}`);
  
  let content = await fs.readFile(srcPath, 'utf-8');
  
  // プライベートコンテンツの除外
  content = filterPrivateContent(content);
  
  // 機密情報のスキャン
  scanForSensitiveInfo(content, srcPath);
  
  await fs.writeFile(publicPath, content, 'utf-8');
  rollback.addOperation(async () => {
    const exists = await fs.access(publicPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.unlink(publicPath);
    }
  });
  
  logger.debug(`Markdownファイルの処理が完了: ${publicPath}`);
}

function filterPrivateContent(content) {
  let filteredContent = content;
  
  // プライベートコメントブロックの除去
  for (const pattern of CONFIG.contentExcludePatterns) {
    const regex = new RegExp(`${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?-->`, 'gs');
    filteredContent = filteredContent.replace(regex, '');
  }
  
  return filteredContent;
}

function scanForSensitiveInfo(content, filePath) {
  for (const pattern of CONFIG.sensitivePatterns) {
    const regex = new RegExp(pattern, 'gi');
    const matches = content.match(regex);
    
    if (matches) {
      logger.warn(`⚠️  機密情報の可能性がある内容が検出されました: ${filePath}`);
      logger.warn(`パターン: ${pattern}`);
      logger.warn(`マッチした内容: ${matches.join(', ')}`);
    }
  }
}

async function copyFile(srcPath, publicPath, rollback) {
  logger.debug(`ファイルをコピー中: ${srcPath} -> ${publicPath}`);
  
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await fs.copyFile(srcPath, publicPath);
  
  rollback.addOperation(async () => {
    const exists = await fs.access(publicPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.unlink(publicPath);
    }
  });
  
  logger.debug(`ファイルのコピーが完了: ${publicPath}`);
}

async function generateTableOfContents(processedSections, publicDir) {
  const tocConfig = CONFIG.tableOfContents;
  let tocContent = `# ${tocConfig.title}\n\n`;
  
  for (const section of processedSections) {
    tocContent += `## ${section.title}\n\n`;
    
    const sectionDir = path.join(publicDir, section.directory);
    try {
      const entries = await fs.readdir(sectionDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md') {
          const title = entry.name.replace('.md', '');
          const link = `${section.directory}/${entry.name}`;
          tocContent += `- [${title}](${link})\n`;
        } else if (entry.isDirectory()) {
          const indexPath = path.join(sectionDir, entry.name, 'index.md');
          try {
            await fs.access(indexPath);
            const link = `${section.directory}/${entry.name}/`;
            tocContent += `- [${entry.name}](${link})\n`;
          } catch (error) {
            // index.mdがない場合はスキップ
          }
        }
      }
      
      tocContent += '\n';
    } catch (error) {
      logger.warn(`目次生成中にエラー: ${section.directory}`);
    }
  }
  
  const tocPath = path.join(publicDir, tocConfig.outputFile);
  await fs.writeFile(tocPath, tocContent, 'utf-8');
  
  logger.debug(`目次を生成しました: ${tocPath}`);
}

async function copyJekyllFiles(projectRoot, publicDir, rollback) {
  const jekyllFiles = ['_config.yml', '_layouts'];
  
  for (const file of jekyllFiles) {
    const srcPath = path.join(projectRoot, file);
    const publicPath = path.join(publicDir, file);
    
    try {
      const stat = await fs.stat(srcPath);
      
      if (stat.isDirectory()) {
        await copyDirectory(srcPath, publicPath, rollback);
      } else {
        await fs.mkdir(path.dirname(publicPath), { recursive: true });
        await fs.copyFile(srcPath, publicPath);
        
        rollback.addOperation(async () => {
          const exists = await fs.access(publicPath).then(() => true).catch(() => false);
          if (exists) {
            await fs.unlink(publicPath);
          }
        });
      }
      
      logger.debug(`Jekyllファイルをコピーしました: ${srcPath} -> ${publicPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`Jekyllファイルのコピーに失敗: ${srcPath}`);
      }
    }
  }
}

async function copyDirectory(srcDir, publicDir, rollback) {
  await fs.mkdir(publicDir, { recursive: true });
  rollback.addOperation(async () => {
    const exists = await fs.access(publicDir).then(() => true).catch(() => false);
    if (exists) {
      await fs.rmdir(publicDir, { recursive: true });
    }
  });
  
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const publicPath = path.join(publicDir, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, publicPath, rollback);
    } else {
      await fs.copyFile(srcPath, publicPath);
      rollback.addOperation(async () => {
        const exists = await fs.access(publicPath).then(() => true).catch(() => false);
        if (exists) {
          await fs.unlink(publicPath);
        }
      });
    }
  }
}

async function copyAssets(projectRoot, publicDir, rollback, optimizer = null) {
  const assetsDir = 'assets';
  
  // src/assetsのコピー
  const srcAssetsPath = path.join(projectRoot, 'src', assetsDir);
  try {
    await fs.access(srcAssetsPath);
    await copyAssetsDirectory(srcAssetsPath, path.join(publicDir, assetsDir), rollback, optimizer);
    logger.info('src/assetsディレクトリをコピーしました');
  } catch (error) {
    logger.debug('src/assetsディレクトリが見つかりません');
  }
  
  // ルートレベルのassetsのコピー
  const rootAssetsPath = path.join(projectRoot, assetsDir);
  try {
    await fs.access(rootAssetsPath);
    await copyAssetsDirectory(rootAssetsPath, path.join(publicDir, assetsDir), rollback, optimizer);
    logger.info('ルートassetsディレクトリをコピーしました');
  } catch (error) {
    logger.debug('ルートassetsディレクトリが見つかりません');
  }
}

async function copyAssetsDirectory(srcDir, destDir, rollback, optimizer = null) {
  await fs.mkdir(destDir, { recursive: true });
  rollback.addOperation(async () => {
    const exists = await fs.access(destDir).then(() => true).catch(() => false);
    if (exists) {
      await fs.rmdir(destDir, { recursive: true });
    }
  });
  
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    
    if (entry.isDirectory()) {
      await copyAssetsDirectory(srcPath, destPath, rollback, optimizer);
    } else if (entry.isFile()) {
      if (!shouldIncludeFile(entry.name)) {
        continue;
      }
      
      // 画像最適化が有効で、ImageOptimizerが渡されている場合は最適化を試行
      if (optimizer && optimizer.isImageFile(srcPath)) {
        const optimized = await optimizer.optimizeImage(srcPath, destPath);
        if (optimized) {
          logger.info(`✨ 画像を最適化しました: ${entry.name}`);
        } else {
          await fs.copyFile(srcPath, destPath);
          logger.debug(`📁 画像をコピーしました: ${entry.name}`);
        }
      } else {
        await fs.copyFile(srcPath, destPath);
        logger.debug(`📁 ファイルをコピーしました: ${entry.name}`);
      }
      
      rollback.addOperation(async () => {
        const exists = await fs.access(destPath).then(() => true).catch(() => false);
        if (exists) {
          await fs.unlink(destPath);
        }
      });
    }
  }
}

async function processIndexFile(projectRoot, publicDir, rollback) {
  const indexSrcPath = path.join(projectRoot, 'index.md');
  const indexPublicPath = path.join(publicDir, 'index.md');
  
  try {
    // プロジェクトルートのindex.mdが存在する場合はコピー
    await fs.access(indexSrcPath);
    let content = await fs.readFile(indexSrcPath, 'utf-8');
    content = filterPrivateContent(content);
    await fs.writeFile(indexPublicPath, content, 'utf-8');
    
    rollback.addOperation(async () => {
      const exists = await fs.access(indexPublicPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.unlink(indexPublicPath);
      }
    });
    
    logger.debug('index.mdをコピーしました');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // index.mdが存在しない場合はデフォルトを生成
      await generateFallbackIndex(indexPublicPath, rollback);
    } else {
      throw error;
    }
  }
}

async function generateFallbackIndex(indexPath, rollback) {
  const content = `# ${CONFIG.book?.title || 'Book Title'}

${CONFIG.book?.description || 'Book description'}

## Contents

- [Table of Contents](table-of-contents.md)

---

Generated by Book Publishing Template
`;
  
  await fs.writeFile(indexPath, content, 'utf-8');
  rollback.addOperation(async () => {
    const exists = await fs.access(indexPath).then(() => true).catch(() => false);
    if (exists) {
      await fs.unlink(indexPath);
    }
  });
  
  logger.info('フォールバックindex.mdを生成しました');
}

async function processRootFiles(projectRoot, publicDir, rollback) {
  logger.info('📄 ルートファイルを処理中...');
  
  if (!CONFIG.publicFiles || CONFIG.publicFiles.length === 0) {
    logger.debug('publicFilesが設定されていません');
    return;
  }
  
  for (const file of CONFIG.publicFiles) {
    if (file === 'index.md') {
      // index.mdは既に処理済み
      continue;
    }
    
    if (file === 'README.md') {
      // README.mdは特別処理
      await processBookReadme(projectRoot, publicDir, rollback);
      continue;
    }
    
    // その他のファイルは通常コピー
    const srcPath = path.join(projectRoot, file);
    const publicPath = path.join(publicDir, file);
    
    try {
      await fs.access(srcPath);
      let content = await fs.readFile(srcPath, 'utf-8');
      content = filterPrivateContent(content);
      await fs.writeFile(publicPath, content, 'utf-8');
      
      rollback.addOperation(async () => {
        const exists = await fs.access(publicPath).then(() => true).catch(() => false);
        if (exists) {
          await fs.unlink(publicPath);
        }
      });
      
      logger.debug(`ルートファイルを処理しました: ${file}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`ルートファイルの処理に失敗: ${file}`, error);
      }
    }
  }
}

async function processBookReadme(projectRoot, publicDir, rollback) {
  const templatePath = path.join(projectRoot, 'templates', 'book-readme.md');
  const publicPath = path.join(publicDir, 'README.md');
  
  try {
    // テンプレートが存在する場合は使用
    await fs.access(templatePath);
    let content = await fs.readFile(templatePath, 'utf-8');
    
    // テンプレート変数を置換
    const replacements = {
      '{{BOOK_TITLE}}': CONFIG.book?.title || 'Book Title',
      '{{BOOK_DESCRIPTION}}': CONFIG.book?.description || 'Book description',
      '{{GITHUB_USERNAME}}': process.env.GITHUB_REPOSITORY?.split('/')[0] || CONFIG.book?.author?.github || 'username',
      '{{PUBLIC_REPO_NAME}}': process.env.GITHUB_REPOSITORY?.split('/')[1] || CONFIG.book?.repository?.public?.split('/').pop() || 'book-public',
      '{{PRIVATE_REPO_NAME}}': CONFIG.book?.repository?.private?.split('/').pop() || 'book-private',
      '{{AUTHOR_NAME}}': CONFIG.book?.author?.name || 'Author Name',
      '{{AUTHOR_EMAIL}}': CONFIG.book?.author?.email || 'author@example.com',
      '{{AUTHOR_WEBSITE}}': CONFIG.book?.author?.website || 'https://example.com',
      '{{AUTHOR_ORGANIZATION}}': CONFIG.book?.author?.organization || '',
      '{{CHAPTER_1_TITLE}}': '基礎',
      '{{CHAPTER_2_TITLE}}': '応用',
      '{{CHAPTER_3_TITLE}}': '実践',
      '{{LICENSE}}': CONFIG.book?.license || 'CC BY-NC-SA 4.0',
      '{{BOOK_SLUG}}': CONFIG.book?.repository?.zenn?.split('/').pop() || 'book-slug',
      '{{TOC_FILE}}': CONFIG.tableOfContents?.outputFile || 'table-of-contents.md',
      '{{BUILD_DATE}}': new Date().toISOString().split('T')[0]
    };
    
    for (const [key, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(key, 'g'), value);
    }
    
    await fs.writeFile(publicPath, content, 'utf-8');
    
    rollback.addOperation(async () => {
      const exists = await fs.access(publicPath).then(() => true).catch(() => false);
      if (exists) {
        await fs.unlink(publicPath);
      }
    });
    
    logger.info('📚 書籍用README.mdを生成しました');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // テンプレートが存在しない場合は、元のREADME.mdをコピー
      const srcPath = path.join(projectRoot, 'README.md');
      
      try {
        await fs.access(srcPath);
        let content = await fs.readFile(srcPath, 'utf-8');
        content = filterPrivateContent(content);
        await fs.writeFile(publicPath, content, 'utf-8');
        
        rollback.addOperation(async () => {
          const exists = await fs.access(publicPath).then(() => true).catch(() => false);
          if (exists) {
            await fs.unlink(publicPath);
          }
        });
        
        logger.info('元のREADME.mdをコピーしました（テンプレートが見つかりません）');
      } catch (copyError) {
        logger.warn('README.mdの処理に失敗しました', copyError);
      }
    } else {
      logger.warn('README.mdテンプレートの処理に失敗しました', error);
    }
  }
}

// コマンドライン引数の処理
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // --version=X.Y.Z の形式をパース
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--version=')) {
      options.version = arg.split('=')[1];
    } else if (arg === '--version' && i + 1 < args.length) {
      options.version = args[i + 1];
      i++; // 次の引数をスキップ
    } else if (arg === '--skip-version-update') {
      options.skipVersionUpdate = true;
    }
  }
  
  build(options).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { build };