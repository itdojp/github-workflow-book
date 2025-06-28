#!/usr/bin/env node

/**
 * Build adapter for github-workflow-book-private
 * Adapts the flat file structure to the template's expected src/ structure
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

async function createSrcStructure() {
  console.log('📁 Creating temporary src structure...');
  
  const srcDir = path.join(projectRoot, 'src');
  const chaptersDir = path.join(srcDir, 'chapters');
  const appendicesDir = path.join(srcDir, 'appendices');
  const introDir = path.join(srcDir, 'introduction');
  
  // Remove existing src if it exists
  await fs.remove(srcDir);
  
  // Create directories
  await fs.ensureDir(chaptersDir);
  await fs.ensureDir(appendicesDir);
  await fs.ensureDir(introDir);
  
  // Copy chapters
  const chapterFiles = await fs.readdir(projectRoot);
  for (const file of chapterFiles) {
    if (file.match(/^chapter-\d+.*\.md$/)) {
      const chapterNum = file.match(/chapter-(\d+)/)[1];
      const chapterDir = path.join(chaptersDir, `chapter${chapterNum}`);
      await fs.ensureDir(chapterDir);
      await fs.copy(
        path.join(projectRoot, file),
        path.join(chapterDir, 'index.md')
      );
    }
  }
  
  // Copy appendices
  for (const file of chapterFiles) {
    if (file.match(/^appendix-[a-z].*\.md$/)) {
      const appendixLetter = file.match(/appendix-([a-z])/)[1];
      const appendixDir = path.join(appendicesDir, `appendix-${appendixLetter}`);
      await fs.ensureDir(appendixDir);
      await fs.copy(
        path.join(projectRoot, file),
        path.join(appendixDir, 'index.md')
      );
    }
  }
  
  // Copy introduction if exists
  if (await fs.pathExists(path.join(projectRoot, 'introduction.md'))) {
    await fs.copy(
      path.join(projectRoot, 'introduction.md'),
      path.join(introDir, 'index.md')
    );
  }
  
  // Copy README.md as introduction if introduction.md doesn't exist
  if (!await fs.pathExists(path.join(introDir, 'index.md')) && 
      await fs.pathExists(path.join(projectRoot, 'README.md'))) {
    await fs.copy(
      path.join(projectRoot, 'README.md'),
      path.join(introDir, 'index.md')
    );
  }
  
  console.log('✅ Temporary src structure created');
}

async function runOriginalBuild() {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('node', [path.join(__dirname, 'build.js')], {
      cwd: projectRoot,
      stdio: 'inherit'
    });
    
    buildProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });
    
    buildProcess.on('error', reject);
  });
}

async function cleanup() {
  console.log('🧹 Cleaning up temporary files...');
  const srcDir = path.join(projectRoot, 'src');
  await fs.remove(srcDir);
  console.log('✅ Cleanup completed');
}

async function main() {
  try {
    await createSrcStructure();
    await runOriginalBuild();
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}