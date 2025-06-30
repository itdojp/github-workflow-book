#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function addNavigationToFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Check if navigation is already added
    if (content.includes('{% include navigation.html %}')) {
      console.log(`⏭️  Skipping ${filePath} - navigation already present`);
      return;
    }
    
    // Find the first heading line (starts with #)
    let firstHeadingIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#')) {
        firstHeadingIndex = i;
        break;
      }
    }
    
    if (firstHeadingIndex === -1) {
      console.log(`⚠️  Warning: No heading found in ${filePath}`);
      return;
    }
    
    // Insert navigation after the heading
    const navigationInclude = '\n{% include navigation.html %}\n';
    lines.splice(firstHeadingIndex + 1, 0, '', '{% include navigation.html %}');
    
    // Add navigation at the end
    lines.push('', '{% include navigation.html %}');
    
    // Write back the modified content
    const modifiedContent = lines.join('\n');
    await fs.writeFile(filePath, modifiedContent, 'utf-8');
    
    console.log(`✅ Added navigation to ${filePath}`);
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

async function findMarkdownFiles(baseDir) {
  const files = [];
  
  const directories = [
    'chapters',
    'appendices'
  ];
  
  for (const dir of directories) {
    const dirPath = path.join(baseDir, dir);
    try {
      const subdirs = await fs.readdir(dirPath);
      for (const subdir of subdirs) {
        const indexPath = path.join(dirPath, subdir, 'index.md');
        try {
          await fs.access(indexPath);
          files.push(indexPath);
        } catch {
          // index.md doesn't exist in this subdirectory, skip
        }
      }
    } catch {
      console.log(`Directory ${dirPath} not found, skipping`);
    }
  }
  
  return files;
}

async function main() {
  const baseDir = path.join(process.cwd(), 'docs');
  
  console.log('🔍 Finding markdown files...');
  const files = await findMarkdownFiles(baseDir);
  
  console.log(`📁 Found ${files.length} files to process`);
  
  for (const file of files) {
    await addNavigationToFile(file);
  }
  
  console.log('✅ Navigation addition complete!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { addNavigationToFile, findMarkdownFiles };