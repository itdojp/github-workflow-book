#!/usr/bin/env node

/**
 * ハードコーディングされたURL除去スクリプト
 * テンプレートファイル内のハードコーディングされたURLをプレースホルダーに置換
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

// ハードコーディングされたURLパターンと置換ルール
const URL_PATTERNS = [
  // GitHub specific URLs
  {
    pattern: /https:\/\/github\.com\/yourusername\/your-book-private\.git/g,
    replacement: 'https://github.com/{{GITHUB_USERNAME}}/{{PRIVATE_REPO_NAME}}.git'
  },
  {
    pattern: /https:\/\/github\.com\/yourusername\/your-book-public\.git/g,
    replacement: 'https://github.com/{{GITHUB_USERNAME}}/{{PUBLIC_REPO_NAME}}.git'
  },
  {
    pattern: /https:\/\/github\.com\/username\/your-book-private\.git/g,
    replacement: 'https://github.com/{{GITHUB_USERNAME}}/{{PRIVATE_REPO_NAME}}.git'
  },
  {
    pattern: /https:\/\/github\.com\/username\/your-book-public\.git/g,
    replacement: 'https://github.com/{{GITHUB_USERNAME}}/{{PUBLIC_REPO_NAME}}.git'
  },
  {
    pattern: /https:\/\/github\.com\/YOUR_USERNAME\/YOUR_REPO\.git/g,
    replacement: 'https://github.com/{{GITHUB_USERNAME}}/{{REPO_NAME}}.git'
  },
  
  // GitHub Pages URLs
  {
    pattern: /https:\/\/yourusername\.github\.io\/your-book-public\//g,
    replacement: 'https://{{GITHUB_USERNAME}}.github.io/{{PUBLIC_REPO_NAME}}/'
  },
  {
    pattern: /https:\/\/username\.github\.io\/your-book-public\//g,
    replacement: 'https://{{GITHUB_USERNAME}}.github.io/{{PUBLIC_REPO_NAME}}/'
  },
  {
    pattern: /https:\/\/USERNAME\.github\.io\/REPOSITORY_NAME\//g,
    replacement: 'https://{{GITHUB_USERNAME}}.github.io/{{PUBLIC_REPO_NAME}}/'
  },
  
  // Generic repository references
  {
    pattern: /git\+https:\/\/github\.com\/YOUR_USERNAME\/YOUR_REPO\.git/g,
    replacement: 'git+https://github.com/{{GITHUB_USERNAME}}/{{REPO_NAME}}.git'
  },
  {
    pattern: /git@github\.com:username\/theoretical-cs-textbook-public\.git/g,
    replacement: 'git@github.com:{{GITHUB_USERNAME}}/{{PUBLIC_REPO_NAME}}.git'
  },
  
  // Baseurl and domain references
  {
    pattern: /baseurl: "\/your-book-public"/g,
    replacement: 'baseurl: "/{{PUBLIC_REPO_NAME}}"'
  },
  {
    pattern: /url: "https:\/\/yourusername\.github\.io"/g,
    replacement: 'url: "https://{{GITHUB_USERNAME}}.github.io"'
  },
  
  // Clone command examples
  {
    pattern: /git clone https:\/\/github\.com\/yourusername\/your-book-private\.git/g,
    replacement: 'git clone https://github.com/{{GITHUB_USERNAME}}/{{PRIVATE_REPO_NAME}}.git'
  },
  {
    pattern: /cd your-book-private/g,
    replacement: 'cd {{PRIVATE_REPO_NAME}}'
  },
  
  // Repository names in text
  {
    pattern: /your-book-private/g,
    replacement: '{{PRIVATE_REPO_NAME}}'
  },
  {
    pattern: /your-book-public/g,
    replacement: '{{PUBLIC_REPO_NAME}}'
  },
  {
    pattern: /my-book-private/g,
    replacement: '{{PRIVATE_REPO_NAME}}'
  },
  {
    pattern: /my-book-public/g,
    replacement: '{{PUBLIC_REPO_NAME}}'
  },
  
  // Author and title placeholders
  {
    pattern: /Your Book Title/g,
    replacement: '{{BOOK_TITLE}}'
  },
  {
    pattern: /Your book description/g,
    replacement: '{{BOOK_DESCRIPTION}}'
  },
  {
    pattern: /Author Name/g,
    replacement: '{{AUTHOR_NAME}}'
  },
  {
    pattern: /your\.email@example\.com/g,
    replacement: '{{AUTHOR_EMAIL}}'
  },
  {
    pattern: /yourusername/g,
    replacement: '{{GITHUB_USERNAME}}'
  },
  {
    pattern: /YOUR_USERNAME/g,
    replacement: '{{GITHUB_USERNAME}}'
  },
  
  // Specific legacy references
  {
    pattern: /theoretical-cs-textbook-public/g,
    replacement: '{{PUBLIC_REPO_NAME}}'
  },
  {
    pattern: /theoretical-computer-science-textbook-public/g,
    replacement: '{{PUBLIC_REPO_NAME}}'
  }
];

// 除外するファイルパターン
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/public/**',
  '**/.git/**',
  '**/scripts/remove-hardcoded-urls.js' // 自分自身を除外
];

// カラー出力
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(level, message) {
  const color = colors[level] || colors.reset;
  console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
}

// ファイルの内容を置換
async function processFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    let changed = false;
    let changeCount = 0;
    
    // 各パターンを適用
    for (const { pattern, replacement } of URL_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        content = content.replace(pattern, replacement);
        changed = true;
        changeCount += matches.length;
      }
    }
    
    if (changed) {
      await fs.writeFile(filePath, content, 'utf-8');
      log('green', `✅ ${filePath}: ${changeCount} replacements made`);
      return changeCount;
    }
    
    return 0;
  } catch (error) {
    log('red', `❌ Error processing ${filePath}: ${error.message}`);
    return 0;
  }
}

// ファイルを検索してフィルタリング
function getTargetFiles() {
  return new Promise((resolve, reject) => {
    glob('**/*', { 
      ignore: EXCLUDE_PATTERNS,
      nodir: true 
    }, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      
      // テキストファイルのみをフィルタリング
      const textFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.md', '.yml', '.yaml', '.json', '.js', '.sh', '.txt'].includes(ext);
      });
      
      resolve(textFiles);
    });
  });
}

// メイン処理
async function main() {
  console.log('🔧 Removing hardcoded URLs from template files...\n');
  
  try {
    const files = await getTargetFiles();
    log('blue', `Found ${files.length} files to process`);
    
    let totalReplacements = 0;
    let processedFiles = 0;
    
    for (const file of files) {
      const replacements = await processFile(file);
      if (replacements > 0) {
        totalReplacements += replacements;
        processedFiles++;
      }
    }
    
    console.log('\n📊 Summary:');
    log('green', `✅ Processed ${processedFiles} files`);
    log('green', `✅ Made ${totalReplacements} total replacements`);
    
    if (totalReplacements > 0) {
      console.log('\n📝 Template placeholders used:');
      console.log('  {{GITHUB_USERNAME}}     - GitHub username');
      console.log('  {{PRIVATE_REPO_NAME}}   - Private repository name');
      console.log('  {{PUBLIC_REPO_NAME}}    - Public repository name');
      console.log('  {{REPO_NAME}}          - Generic repository name');
      console.log('  {{BOOK_TITLE}}         - Book title');
      console.log('  {{BOOK_DESCRIPTION}}   - Book description');
      console.log('  {{AUTHOR_NAME}}        - Author name');
      console.log('  {{AUTHOR_EMAIL}}       - Author email');
      
      console.log('\n💡 Next steps:');
      console.log('1. Update init-template.js to replace placeholders with actual values');
      console.log('2. Test the template initialization process');
      console.log('3. Verify all URLs are correctly templated');
    } else {
      log('yellow', '⚠️  No hardcoded URLs found to replace');
    }
    
  } catch (error) {
    log('red', `❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  log('red', `❌ Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log('red', `❌ Unhandled rejection: ${error.message}`);
  process.exit(1);
});

// 実行
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, URL_PATTERNS };