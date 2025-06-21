#!/usr/bin/env node

/**
 * Single File Processor
 * Processes individual markdown files for parallel build
 */

const fs = require('fs').promises;
const path = require('path');

// Simple markdown to HTML conversion
async function processMarkdownFile(inputPath, outputDir) {
  try {
    // Read the markdown file
    const content = await fs.readFile(inputPath, 'utf-8');
    
    // Extract filename without extension
    const basename = path.basename(inputPath, '.md');
    const outputPath = path.join(outputDir, `${basename}.html`);
    
    // Simple processing (in real implementation, this would use proper markdown parser)
    let html = content;
    
    // Remove private content
    html = html.replace(/<!-- private -->[\s\S]*?<!-- \/private -->/g, '');
    html = html.replace(/<!-- PRIVATE.*?-->/g, '');
    html = html.replace(/## 講師向け[\s\S]*?(?=##|$)/g, '');
    
    // Basic markdown to HTML conversion
    html = html.replace(/^# (.*)/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.*)/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.*)/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Wrap in basic HTML structure
    const finalHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${basename}</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 4px; }
    </style>
</head>
<body>
${html}
</body>
</html>`;
    
    // Write the output file
    await fs.writeFile(outputPath, finalHtml, 'utf-8');
    
    return true;
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error.message);
    return false;
  }
}

// Main execution
async function main() {
  const [inputFile, outputDir] = process.argv.slice(2);
  
  if (!inputFile || !outputDir) {
    console.error('Usage: node process-single-file.js <input-file> <output-dir>');
    process.exit(1);
  }
  
  const success = await processMarkdownFile(inputFile, outputDir);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}