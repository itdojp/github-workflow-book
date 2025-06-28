/**
 * Worker Thread for parallel file processing
 * Handles markdown file processing for large-scale builds
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Error handling for worker
process.on('uncaughtException', (error) => {
  parentPort.postMessage({
    type: 'error',
    error: {
      message: error.message,
      stack: error.stack
    }
  });
});

// Clean content function (copied from main build script)
function cleanContent(content) {
  // プライベートセクションの削除
  content = content.replace(/<!--\s*private\s*-->([\s\S]*?)<!--\s*\/private\s*-->/gi, '');
  content = content.replace(/<!--\s*draft\s*-->([\s\S]*?)<!--\s*\/draft\s*-->/gi, '');
  
  // 解答セクションのサンプル化
  content = content.replace(
    /(##\s*解答|##\s*Solutions?)([\s\S]*?)(?=##|\z)/gi,
    (match, heading, solutionContent) => {
      const lines = solutionContent.trim().split('\n');
      const sampleLines = lines.slice(0, 3);
      return `${heading}\n\n${sampleLines.join('\n')}\n\n<!-- 完全版は講師向け資料をご参照ください -->\n\n`;
    }
  );
  
  // 講師向けセクションの削除
  content = content.replace(/##\s*講師向け[\s\S]*?(?=##|$)/g, '');
  content = content.replace(/##\s*Instructor[\s\S]*?(?=##|$)/g, '');
  
  return content;
}

// Extract headings function
function extractHeadings(content, filePath, sectionName, maxDepth = 3) {
  const headings = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      
      if (level <= maxDepth) {
        headings.push({
          level,
          title,
          filePath,
          sectionName,
          anchor: generateAnchor(title)
        });
      }
    }
  }
  
  return headings;
}

// Generate anchor function
function generateAnchor(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

// Check if file should be excluded
function shouldExclude(filePath, excludePatterns) {
  const fileName = path.basename(filePath);
  if (excludePatterns && Array.isArray(excludePatterns)) {
    for (const pattern of excludePatterns) {
      if (pattern && pattern.source) {
        // Recreate RegExp from source if needed
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(fileName)) {
          return true;
        }
      } else if (pattern && typeof pattern.test === 'function') {
        if (pattern.test(fileName)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Ensure directory exists
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

// Main processing function
async function processFile(task) {
  const { srcPath, destPath, sectionName, excludePatterns, collectHeadings, maxDepth } = task;
  
  try {
    // Check if file should be excluded
    if (shouldExclude(srcPath, excludePatterns)) {
      return {
        type: 'skipped',
        srcPath,
        reason: 'excluded'
      };
    }
    
    // Ensure destination directory exists
    await ensureDir(path.dirname(destPath));
    
    // Read and process file content
    const content = await fs.readFile(srcPath, 'utf-8');
    const cleanedContent = cleanContent(content);
    
    // Extract headings if requested
    let headings = [];
    if (collectHeadings) {
      headings = extractHeadings(cleanedContent, destPath, sectionName, maxDepth);
    }
    
    // Write processed content
    await fs.writeFile(destPath, cleanedContent, 'utf-8');
    
    return {
      type: 'success',
      srcPath,
      destPath,
      headings,
      size: cleanedContent.length
    };
    
  } catch (error) {
    return {
      type: 'error',
      srcPath,
      destPath,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

// Worker main logic
async function main() {
  const task = workerData;
  
  try {
    const result = await processFile(task);
    parentPort.postMessage(result);
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
}

// Start processing
main();