#!/usr/bin/env node

/**
 * EPUB出力用ビルドスクリプト
 * 書籍をEPUB形式で出力するためのスクリプト
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// 設定ファイルの読み込み
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    return {
      srcDir: path.join(__dirname, '..', 'src'),
      outputDir: path.join(__dirname, '..', 'output'),
      tempDir: path.join(__dirname, '..', 'temp'),
      assetsDir: path.join(__dirname, '..', 'assets'),
      ...userConfig,
      epub: {
        engine: 'pandoc', // pandoc, epub-gen
        coverImage: null,
        includeTableOfContents: true,
        chapterLevel: 1,
        language: 'ja',
        publisher: '',
        rights: '',
        ...userConfig.epub
      }
    };
  } catch (error) {
    console.warn('book-config.json not found, using default configuration');
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    srcDir: path.join(__dirname, '..', 'src'),
    outputDir: path.join(__dirname, '..', 'output'),
    tempDir: path.join(__dirname, '..', 'temp'),
    assetsDir: path.join(__dirname, '..', 'assets'),
    
    book: {
      title: 'Sample Book',
      subtitle: 'Generated with Book Publishing Template',
      author: { name: 'Author Name', email: 'author@example.com' },
      description: 'Book description'
    },
    
    epub: {
      engine: 'pandoc',
      coverImage: null,
      includeTableOfContents: true,
      chapterLevel: 1,
      language: 'ja',
      publisher: '',
      rights: ''
    },
    
    contentSections: [
      { name: 'introduction', directory: 'introduction', enabled: true, order: 1 },
      { name: 'chapters', directory: 'chapters', enabled: true, order: 2 },
      { name: 'appendices', directory: 'appendices', enabled: true, order: 3 },
      { name: 'afterword', directory: 'afterword', enabled: true, order: 4 }
    ]
  };
}

// ユーティリティ関数
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory ${dir}:`, error);
  }
}

async function prepareEPUBContent(config) {
  console.log('📝 Preparing EPUB content...');
  
  const tempDir = config.tempDir;
  await ensureDir(tempDir);
  
  // メタデータファイルの作成
  await createMetadataFile(config);
  
  // チャプターファイルの準備
  const chapterFiles = await createChapterFiles(config);
  
  return {
    metadataFile: path.join(tempDir, 'metadata.yaml'),
    chapterFiles: chapterFiles,
    tempDir: tempDir
  };
}

async function createMetadataFile(config) {
  const metadataPath = path.join(config.tempDir, 'metadata.yaml');
  
  let metadata = '---\n';
  metadata += `title: "${config.book.title}"\n`;
  if (config.book.subtitle) {
    metadata += `subtitle: "${config.book.subtitle}"\n`;
  }
  metadata += `creator:\n`;
  metadata += `  - role: author\n`;
  metadata += `    text: "${config.book.author.name}"\n`;
  
  if (config.book.description) {
    metadata += `description: "${config.book.description}"\n`;
  }
  
  metadata += `language: ${config.epub.language}\n`;
  metadata += `date: "${new Date().toISOString().split('T')[0]}"\n`;
  
  if (config.epub.publisher) {
    metadata += `publisher: "${config.epub.publisher}"\n`;
  }
  
  if (config.epub.rights) {
    metadata += `rights: "${config.epub.rights}"\n`;
  }
  
  // カバー画像があれば追加
  if (config.epub.coverImage) {
    const coverPath = path.resolve(config.epub.coverImage);
    metadata += `cover-image: "${coverPath}"\n`;
  }
  
  metadata += 'toc: true\n';
  metadata += `epub-chapter-level: ${config.epub.chapterLevel}\n`;
  metadata += '---\n';
  
  await fs.writeFile(metadataPath, metadata, 'utf-8');
  console.log(`Metadata file created: ${metadataPath}`);
}

async function createChapterFiles(config) {
  const chapterFiles = [];
  
  // 有効なセクションを順序でソート
  const enabledSections = config.contentSections
    .filter(section => section.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  for (const section of enabledSections) {
    console.log(`Processing section: ${section.name}`);
    
    const sectionDir = path.join(config.srcDir, section.directory);
    
    try {
      const sectionFiles = await processSectionForEPUB(sectionDir, section, config);
      chapterFiles.push(...sectionFiles);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`Section ${section.name} directory not found, skipping...`);
      } else {
        console.error(`Error processing section ${section.name}:`, error);
      }
    }
  }
  
  return chapterFiles;
}

async function processSectionForEPUB(sectionDir, section, config) {
  const chapterFiles = [];
  const items = await fs.readdir(sectionDir, { withFileTypes: true });
  
  // セクションファイルを順序付けして処理
  const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name));
  
  for (const item of sortedItems) {
    if (item.isDirectory()) {
      const itemDir = path.join(sectionDir, item.name);
      const indexPath = path.join(itemDir, 'index.md');
      
      try {
        const content = await fs.readFile(indexPath, 'utf-8');
        const cleanedContent = cleanContentForEPUB(content);
        
        const chapterPath = path.join(config.tempDir, `${section.name}_${item.name}.md`);
        await fs.writeFile(chapterPath, cleanedContent, 'utf-8');
        chapterFiles.push(chapterPath);
        
      } catch (error) {
        console.warn(`Could not read ${indexPath}, skipping...`);
      }
    } else if (item.name.endsWith('.md') && item.name !== 'draft.md') {
      const filePath = path.join(sectionDir, item.name);
      const content = await fs.readFile(filePath, 'utf-8');
      const cleanedContent = cleanContentForEPUB(content);
      
      const chapterPath = path.join(config.tempDir, `${section.name}_${item.name}`);
      await fs.writeFile(chapterPath, cleanedContent, 'utf-8');
      chapterFiles.push(chapterPath);
    }
  }
  
  return chapterFiles;
}

function cleanContentForEPUB(content) {
  // HTMLコメントの削除
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  
  // Mermaid図をテキスト説明に変換
  content = content.replace(/```mermaid[\s\S]*?```/g, 
    '*[図表: この位置に図が表示されます]*');
  
  // 内部リンクの調整（EPUB内では章間リンクは難しいため、テキストに変換）
  content = content.replace(/\[([^\]]+)\]\(([^)]+\.md[^)]*)\)/g, '**$1**');
  
  // 相対パスの画像リンクを調整
  content = content.replace(/!\[([^\]]*)\]\((?!http)([^)]+)\)/g, (match, alt, src) => {
    // 画像パスがassets/で始まる場合は、そのまま使用
    if (src.startsWith('assets/')) {
      return `![${alt}](${src})`;
    } else {
      return `![${alt}](assets/${src})`;
    }
  });
  
  return content;
}

async function copyAssets(config) {
  const assetsDir = config.assetsDir;
  const tempAssetsDir = path.join(config.tempDir, 'assets');
  
  try {
    await fs.access(assetsDir);
    await ensureDir(tempAssetsDir);
    
    // assetsディレクトリの内容をコピー
    const copyCommand = process.platform === 'win32' 
      ? `xcopy "${assetsDir}" "${tempAssetsDir}" /E /I /Y`
      : `cp -r "${assetsDir}"/* "${tempAssetsDir}/"`;
    
    execSync(copyCommand, { stdio: 'inherit' });
    console.log('Assets copied to temp directory');
  } catch (error) {
    console.log('No assets directory found or failed to copy assets');
  }
}

async function generateEPUB(preparedContent, config) {
  console.log('📖 Generating EPUB...');
  
  const outputPath = path.join(config.outputDir, `${config.book.title.replace(/[^a-zA-Z0-9]/g, '_')}.epub`);
  await ensureDir(config.outputDir);
  
  try {
    if (config.epub.engine === 'pandoc') {
      await generateEPUBWithPandoc(preparedContent, outputPath, config);
    } else {
      throw new Error(`Unsupported EPUB engine: ${config.epub.engine}`);
    }
    
    console.log(`✅ EPUB generated successfully: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ EPUB generation failed:', error.message);
    throw error;
  }
}

async function generateEPUBWithPandoc(preparedContent, outputPath, config) {
  // assetsをコピー
  await copyAssets(config);
  
  const command = [
    'pandoc',
    `"${preparedContent.metadataFile}"`,
    ...preparedContent.chapterFiles.map(file => `"${file}"`),
    '-o', `"${outputPath}"`,
    '--epub-chapter-level=1',
    '--toc',
    '--toc-depth=3',
    '--epub-embed-font="assets/fonts/*.ttf"',
    '--epub-embed-font="assets/fonts/*.otf"',
    '--resource-path="' + preparedContent.tempDir + '"'
  ].join(' ');
  
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}

async function validateEPUB(epubPath) {
  console.log('🔍 Validating EPUB...');
  
  try {
    // epubcheckツールを使用してEPUBの検証
    execSync(`epubcheck "${epubPath}"`, { stdio: 'inherit' });
    console.log('✅ EPUB validation passed');
  } catch (error) {
    console.warn('⚠️  EPUB validation failed or epubcheck not found');
    console.warn('Install epubcheck for validation: https://github.com/w3c/epubcheck');
  }
}

async function cleanup(config) {
  console.log('🧹 Cleaning up temporary files...');
  try {
    await fs.rm(config.tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to cleanup temp directory:', error.message);
  }
}

// メイン実行関数
async function buildEPUB() {
  console.log('📚 Building EPUB version of the book...\n');
  
  try {
    const config = await loadConfig();
    console.log('📋 Configuration loaded');
    
    // 1. EPUBコンテンツの準備
    const preparedContent = await prepareEPUBContent(config);
    
    // 2. EPUB生成
    const epubPath = await generateEPUB(preparedContent, config);
    
    // 3. EPUB検証
    await validateEPUB(epubPath);
    
    // 4. クリーンアップ
    await cleanup(config);
    
    console.log('\n✅ EPUB build completed successfully!');
    console.log(`📁 Output file: ${epubPath}`);
    
    // ファイルサイズの表示
    const stats = await fs.stat(epubPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📏 File size: ${fileSizeInMB} MB`);
    
  } catch (error) {
    console.error('\n❌ EPUB build failed:', error);
    process.exit(1);
  }
}

// 依存関係チェック
async function checkDependencies() {
  const dependencies = [];
  
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    console.log('✅ Pandoc found');
  } catch (error) {
    dependencies.push('pandoc');
  }
  
  if (dependencies.length > 0) {
    console.error('❌ Missing dependencies:');
    dependencies.forEach(dep => console.error(`  - ${dep}`));
    console.error('\nPlease install the missing dependencies and try again.');
    console.error('Installation guide: https://pandoc.org/installing.html');
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  // 引数解析
  const args = process.argv.slice(2);
  const skipDepsCheck = args.includes('--skip-deps-check');
  
  if (!skipDepsCheck) {
    checkDependencies();
  }
  
  buildEPUB();
}

module.exports = { buildEPUB, loadConfig };