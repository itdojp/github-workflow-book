#!/usr/bin/env node

/**
 * PDF出力用ビルドスクリプト
 * 書籍をPDF形式で出力するためのスクリプト
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
      ...userConfig,
      pdf: {
        engine: 'pandoc', // pandoc, puppeteer, wkhtmltopdf
        paperSize: 'A4',
        margin: '2cm',
        fontSize: '11pt',
        fontFamily: 'DejaVu Sans',
        includeTableOfContents: true,
        includeCoverPage: true,
        ...userConfig.pdf
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
    
    book: {
      title: 'Sample Book',
      subtitle: 'Generated with Book Publishing Template',
      author: { name: 'Author Name' },
      description: 'Book description'
    },
    
    pdf: {
      engine: 'pandoc',
      paperSize: 'A4',
      margin: '2cm',
      fontSize: '11pt',
      fontFamily: 'DejaVu Sans',
      includeTableOfContents: true,
      includeCoverPage: true
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

async function combineMarkdownFiles(config) {
  console.log('📝 Combining markdown files...');
  
  const tempDir = config.tempDir;
  await ensureDir(tempDir);
  
  const combinedPath = path.join(tempDir, 'combined.md');
  let combinedContent = '';
  
  // メタデータの追加
  combinedContent += '---\n';
  combinedContent += `title: "${config.book.title}"\n`;
  if (config.book.subtitle) {
    combinedContent += `subtitle: "${config.book.subtitle}"\n`;
  }
  combinedContent += `author: "${config.book.author.name}"\n`;
  combinedContent += `date: "${new Date().toISOString().split('T')[0]}"\n`;
  combinedContent += 'documentclass: book\n';
  combinedContent += `geometry: margin=${config.pdf.margin}\n`;
  combinedContent += `fontsize: ${config.pdf.fontSize}\n`;
  combinedContent += `mainfont: "${config.pdf.fontFamily}"\n`;
  combinedContent += 'toc: true\n';
  combinedContent += 'toc-depth: 3\n';
  combinedContent += 'lot: false\n';
  combinedContent += 'lof: false\n';
  combinedContent += '---\n\n';
  
  // カバーページの追加
  if (config.pdf.includeCoverPage) {
    combinedContent += `\\newpage\n\n`;
    combinedContent += `# ${config.book.title}\n\n`;
    if (config.book.subtitle) {
      combinedContent += `## ${config.book.subtitle}\n\n`;
    }
    combinedContent += `**著者:** ${config.book.author.name}\n\n`;
    if (config.book.description) {
      combinedContent += `${config.book.description}\n\n`;
    }
    combinedContent += `**発行日:** ${new Date().toLocaleDateString('ja-JP')}\n\n`;
    combinedContent += `\\newpage\n\n`;
  }
  
  // 有効なセクションを順序でソート
  const enabledSections = config.contentSections
    .filter(section => section.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  for (const section of enabledSections) {
    console.log(`Processing section: ${section.name}`);
    
    const sectionDir = path.join(config.srcDir, section.directory);
    
    try {
      await processSection(sectionDir, section, combinedContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`Section ${section.name} directory not found, skipping...`);
      } else {
        console.error(`Error processing section ${section.name}:`, error);
      }
    }
  }
  
  // ファイルの書き込み
  await fs.writeFile(combinedPath, combinedContent, 'utf-8');
  console.log(`Combined markdown saved to: ${combinedPath}`);
  
  return combinedPath;
}

async function processSection(sectionDir, section, combinedContent) {
  const items = await fs.readdir(sectionDir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isDirectory()) {
      const itemDir = path.join(sectionDir, item.name);
      const indexPath = path.join(itemDir, 'index.md');
      
      try {
        const content = await fs.readFile(indexPath, 'utf-8');
        const cleanedContent = cleanContentForPDF(content);
        combinedContent += cleanedContent + '\n\n\\newpage\n\n';
      } catch (error) {
        console.warn(`Could not read ${indexPath}, skipping...`);
      }
    } else if (item.name.endsWith('.md') && item.name !== 'draft.md') {
      const filePath = path.join(sectionDir, item.name);
      const content = await fs.readFile(filePath, 'utf-8');
      const cleanedContent = cleanContentForPDF(content);
      combinedContent += cleanedContent + '\n\n\\newpage\n\n';
    }
  }
}

function cleanContentForPDF(content) {
  // HTMLコメントの削除
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  
  // Mermaid図を画像参照に変換（簡易版）
  content = content.replace(/```mermaid[\s\S]*?```/g, 
    '*[図表: この位置にMermaid図が表示されます]*');
  
  // コードブロックの調整
  content = content.replace(/```(\w+)?\n/g, '```{.$1}\n');
  
  // 内部リンクの調整
  content = content.replace(/\[([^\]]+)\]\(([^)]+\.md[^)]*)\)/g, '**$1**');
  
  return content;
}

async function generatePDF(combinedPath, config) {
  console.log('📄 Generating PDF...');
  
  const outputPath = path.join(config.outputDir, `${config.book.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  await ensureDir(config.outputDir);
  
  try {
    if (config.pdf.engine === 'pandoc') {
      await generatePDFWithPandoc(combinedPath, outputPath, config);
    } else if (config.pdf.engine === 'puppeteer') {
      await generatePDFWithPuppeteer(combinedPath, outputPath, config);
    } else {
      throw new Error(`Unsupported PDF engine: ${config.pdf.engine}`);
    }
    
    console.log(`✅ PDF generated successfully: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ PDF generation failed:', error.message);
    throw error;
  }
}

async function generatePDFWithPandoc(inputPath, outputPath, config) {
  const command = [
    'pandoc',
    `"${inputPath}"`,
    '-o', `"${outputPath}"`,
    '--pdf-engine=xelatex',
    '--toc',
    '--toc-depth=3',
    '--number-sections',
    `--variable=geometry:margin=${config.pdf.margin}`,
    `--variable=fontsize:${config.pdf.fontSize}`,
    `--variable=mainfont:"${config.pdf.fontFamily}"`,
    '--variable=CJKmainfont:"Noto Sans CJK JP"',
    '--highlight-style=github',
    '--listings'
  ].join(' ');
  
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
}

async function generatePDFWithPuppeteer(inputPath, outputPath, config) {
  // Puppeteerを使用したPDF生成（HTMLを経由）
  const puppeteer = require('puppeteer');
  const marked = require('marked');
  
  const markdownContent = await fs.readFile(inputPath, 'utf-8');
  const htmlContent = marked.parse(markdownContent);
  
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${config.book.title}</title>
        <style>
            body {
                font-family: "${config.pdf.fontFamily}", sans-serif;
                font-size: ${config.pdf.fontSize};
                line-height: 1.6;
                margin: ${config.pdf.margin};
                color: #333;
            }
            h1, h2, h3, h4, h5, h6 {
                color: #2c3e50;
                margin-top: 2em;
                margin-bottom: 1em;
            }
            code {
                background-color: #f8f9fa;
                padding: 2px 4px;
                border-radius: 3px;
                font-family: "Courier New", monospace;
            }
            pre {
                background-color: #f8f9fa;
                padding: 1em;
                border-radius: 5px;
                overflow-x: auto;
            }
            table {
                border-collapse: collapse;
                width: 100%;
                margin: 1em 0;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
            }
            @media print {
                .page-break {
                    page-break-before: always;
                }
            }
        </style>
    </head>
    <body>
        ${htmlContent}
    </body>
    </html>
  `;
  
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(fullHtml);
  
  await page.pdf({
    path: outputPath,
    format: config.pdf.paperSize,
    margin: {
      top: config.pdf.margin,
      right: config.pdf.margin,
      bottom: config.pdf.margin,
      left: config.pdf.margin
    },
    printBackground: true
  });
  
  await browser.close();
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
async function buildPDF() {
  console.log('📚 Building PDF version of the book...\n');
  
  try {
    const config = await loadConfig();
    console.log('📋 Configuration loaded');
    
    // 1. Markdownファイルの結合
    const combinedPath = await combineMarkdownFiles(config);
    
    // 2. PDF生成
    const pdfPath = await generatePDF(combinedPath, config);
    
    // 3. クリーンアップ
    await cleanup(config);
    
    console.log('\n✅ PDF build completed successfully!');
    console.log(`📁 Output file: ${pdfPath}`);
    
    // ファイルサイズの表示
    const stats = await fs.stat(pdfPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📏 File size: ${fileSizeInMB} MB`);
    
  } catch (error) {
    console.error('\n❌ PDF build failed:', error);
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
  
  try {
    execSync('xelatex --version', { stdio: 'ignore' });
    console.log('✅ XeLaTeX found');
  } catch (error) {
    dependencies.push('xelatex (TeX Live)');
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
  
  buildPDF();
}

module.exports = { buildPDF, loadConfig };