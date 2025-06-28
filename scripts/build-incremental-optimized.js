#!/usr/bin/env node

/**
 * Optimized Incremental Build Script
 * High-performance incremental build with parallel processing and profiling
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const BuildProfiler = require('./build-profiler');
const StreamingProcessor = require('./streaming-processor');

// Configuration
const CONFIG = {
  srcDir: path.join(__dirname, '..', 'src'),
  publicDir: path.join(__dirname, '..', 'public'),
  chaptersDir: 'chapters',
  assetsDir: 'assets',
  metaFile: path.join(__dirname, '..', '.build-meta.json'),
  
  // Performance settings
  parallel: {
    enabled: true,
    maxWorkers: Math.min(require('os').cpus().length, 8),
    chunkSize: 64 * 1024,
    largeFileThreshold: 1024 * 1024
  },
  
  // Profiling settings
  profiling: {
    enabled: true,
    outputFile: '.build-profile-incremental.json'
  },
  
  // Content sections
  contentSections: [
    'introduction',
    'chapters', 
    'appendices',
    'afterword'
  ],
  
  // Exclude patterns
  excludePatterns: [
    /draft\.md$/,
    /notes\.md$/,
    /solutions\.md$/,
    /instructor\.md$/,
    /private\.md$/,
    /private-to-public-deployment-guide\.md$/,
    /\.tmp$/
  ],
  
  // Root files
  rootFiles: [
    'README.md',
    'index.md'
  ]
};

// Build metadata management with performance optimizations
class OptimizedBuildMeta {
  constructor() {
    this.data = {};
    this.changes = new Set();
    this.deletions = new Set();
  }

  async load() {
    try {
      const content = await fs.readFile(CONFIG.metaFile, 'utf-8');
      this.data = JSON.parse(content);
    } catch (error) {
      this.data = {};
    }
  }

  async save() {
    await fs.writeFile(CONFIG.metaFile, JSON.stringify(this.data, null, 2));
  }

  async hasChanged(filePath, content) {
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const prevHash = this.data[filePath];
    
    if (prevHash !== hash) {
      this.data[filePath] = hash;
      this.changes.add(filePath);
      return true;
    }
    
    return false;
  }

  async hasFileChanged(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return await this.hasChanged(filePath, content);
    } catch (error) {
      return false;
    }
  }

  markDeleted(filePath) {
    delete this.data[filePath];
    this.deletions.add(filePath);
  }

  getChangedFiles() {
    return Array.from(this.changes);
  }

  getDeletedFiles() {
    return Array.from(this.deletions);
  }

  getStats() {
    return {
      totalFiles: Object.keys(this.data).length,
      changedFiles: this.changes.size,
      deletedFiles: this.deletions.size
    };
  }
}

// Utility functions
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

async function shouldExclude(filePath) {
  const fileName = path.basename(filePath);
  for (const pattern of CONFIG.excludePatterns) {
    if (pattern.test(fileName)) {
      return true;
    }
  }
  return false;
}

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

async function processFile(srcPath, destPath, meta, profiler) {
  const startTime = Date.now();
  
  try {
    const content = await fs.readFile(srcPath, 'utf-8');
    const cleanedContent = cleanContent(content);
    
    if (await meta.hasChanged(srcPath, cleanedContent)) {
      await ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, cleanedContent, 'utf-8');
      
      profiler.recordFileProcessing(srcPath, startTime, Date.now(), cleanedContent.length);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Failed to process ${srcPath}:`, error.message);
    profiler.recordErrorFile();
    return false;
  }
}

// Build list of files that need processing
async function buildIncrementalFileList(meta, profiler) {
  const fileList = [];
  const filesToCheck = [];
  
  // Collect all potential files
  for (const section of CONFIG.contentSections) {
    const sectionPath = path.join(CONFIG.srcDir, section);
    
    try {
      const items = await fs.readdir(sectionPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const itemSrcDir = path.join(sectionPath, item.name);
          const itemDestDir = path.join(CONFIG.publicDir, section, item.name);
          
          const files = await fs.readdir(itemSrcDir);
          for (const file of files) {
            if (file.endsWith('.md') && !await shouldExclude(file)) {
              filesToCheck.push({
                srcPath: path.join(itemSrcDir, file),
                destPath: path.join(itemDestDir, file),
                sectionName: section
              });
            }
          }
        } else if (item.isFile() && item.name.endsWith('.md') && !await shouldExclude(item.name)) {
          filesToCheck.push({
            srcPath: path.join(sectionPath, item.name),
            destPath: path.join(CONFIG.publicDir, section, item.name),
            sectionName: section
          });
        }
      }
    } catch (error) {
      // Section directory doesn't exist
    }
  }
  
  // Check which files need processing
  profiler.startPhase('change_detection', 'Detecting file changes');
  
  if (CONFIG.parallel.enabled && filesToCheck.length > 10) {
    // Parallel change detection for large projects
    const batchSize = CONFIG.parallel.maxWorkers;
    const batches = [];
    
    for (let i = 0; i < filesToCheck.length; i += batchSize) {
      batches.push(filesToCheck.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (file) => {
        if (await meta.hasFileChanged(file.srcPath)) {
          return file;
        }
        return null;
      });
      
      const results = await Promise.all(batchPromises);
      fileList.push(...results.filter(Boolean));
    }
  } else {
    // Sequential change detection
    for (const file of filesToCheck) {
      if (await meta.hasFileChanged(file.srcPath)) {
        fileList.push(file);
      }
    }
  }
  
  profiler.endPhase();
  return fileList;
}

async function processContentSectionIncremental(meta, sectionName, profiler) {
  let processedCount = 0;
  const sectionPath = path.join(CONFIG.srcDir, sectionName);
  
  try {
    const items = await fs.readdir(sectionPath, { withFileTypes: true });
    const processingTasks = [];
    
    for (const item of items) {
      if (item.isDirectory()) {
        const itemSrcDir = path.join(sectionPath, item.name);
        const itemDestDir = path.join(CONFIG.publicDir, sectionName, item.name);
        
        const files = await fs.readdir(itemSrcDir);
        for (const file of files) {
          if (file.endsWith('.md') && !await shouldExclude(file)) {
            const srcPath = path.join(itemSrcDir, file);
            const destPath = path.join(itemDestDir, file);
            
            processingTasks.push({ srcPath, destPath });
          }
        }
      } else if (item.isFile() && item.name.endsWith('.md') && !await shouldExclude(item.name)) {
        const srcPath = path.join(sectionPath, item.name);
        const destPath = path.join(CONFIG.publicDir, sectionName, item.name);
        
        processingTasks.push({ srcPath, destPath });
      }
    }
    
    // Process tasks in parallel batches
    if (CONFIG.parallel.enabled && processingTasks.length > 2) {
      const batchSize = CONFIG.parallel.maxWorkers;
      
      for (let i = 0; i < processingTasks.length; i += batchSize) {
        const batch = processingTasks.slice(i, i + batchSize);
        const batchPromises = batch.map(async (task) => {
          if (await processFile(task.srcPath, task.destPath, meta, profiler)) {
            console.log(`✅ Processed: ${task.srcPath}`);
            return 1;
          } else {
            console.log(`⏭️  Skipped (unchanged): ${task.srcPath}`);
            return 0;
          }
        });
        
        const results = await Promise.all(batchPromises);
        processedCount += results.reduce((sum, count) => sum + count, 0);
      }
    } else {
      // Sequential processing
      for (const task of processingTasks) {
        if (await processFile(task.srcPath, task.destPath, meta, profiler)) {
          console.log(`✅ Processed: ${task.srcPath}`);
          processedCount++;
        } else {
          console.log(`⏭️  Skipped (unchanged): ${task.srcPath}`);
        }
      }
    }
    
  } catch (error) {
    console.warn(`Section not found: ${sectionPath}`);
  }
  
  return processedCount;
}

async function processRootFilesIncremental(meta, profiler) {
  let processedCount = 0;
  const projectRoot = path.join(__dirname, '..');
  
  const processingTasks = CONFIG.rootFiles.map(file => ({
    srcPath: path.join(projectRoot, file),
    destPath: path.join(CONFIG.publicDir, file)
  }));
  
  if (CONFIG.parallel.enabled && processingTasks.length > 1) {
    // Parallel processing
    const promises = processingTasks.map(async (task) => {
      try {
        if (task.srcPath.endsWith('chapter-solutions.md')) {
          // Special handling for solutions file
          let content = await fs.readFile(task.srcPath, 'utf-8');
          const sampleContent = content.substring(0, 1000) + '\n\n<!-- 完全版は講師向け資料をご参照ください -->';
          
          if (await meta.hasChanged(task.srcPath, sampleContent)) {
            await fs.writeFile(task.destPath, sampleContent, 'utf-8');
            console.log(`✅ Processed (sample): ${path.basename(task.srcPath)}`);
            return 1;
          }
        } else {
          if (await processFile(task.srcPath, task.destPath, meta, profiler)) {
            console.log(`✅ Processed: ${path.basename(task.srcPath)}`);
            return 1;
          }
        }
        console.log(`⏭️  Skipped (unchanged): ${path.basename(task.srcPath)}`);
        return 0;
      } catch (error) {
        console.warn(`⚠️  Failed to process ${path.basename(task.srcPath)}:`, error.message);
        profiler.recordErrorFile();
        return 0;
      }
    });
    
    const results = await Promise.all(promises);
    processedCount = results.reduce((sum, count) => sum + count, 0);
  } else {
    // Sequential processing
    for (const task of processingTasks) {
      try {
        if (await processFile(task.srcPath, task.destPath, meta, profiler)) {
          console.log(`✅ Processed: ${path.basename(task.srcPath)}`);
          processedCount++;
        } else {
          console.log(`⏭️  Skipped (unchanged): ${path.basename(task.srcPath)}`);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to process ${path.basename(task.srcPath)}:`, error.message);
        profiler.recordErrorFile();
      }
    }
  }
  
  return processedCount;
}

async function copyJekyllConfigIncremental(meta, profiler) {
  let processedCount = 0;
  const projectRoot = path.join(__dirname, '..');
  
  // _config.yml
  try {
    const srcPath = path.join(projectRoot, '_config.yml');
    const destPath = path.join(CONFIG.publicDir, '_config.yml');
    const content = await fs.readFile(srcPath, 'utf-8');
    
    if (await meta.hasChanged(srcPath, content)) {
      await fs.copyFile(srcPath, destPath);
      console.log(`✅ Copied: _config.yml`);
      processedCount++;
    }
  } catch (error) {
    // Jekyll config is optional
  }
  
  // _layouts
  const layoutsSrc = path.join(projectRoot, '_layouts');
  const layoutsDest = path.join(CONFIG.publicDir, '_layouts');
  
  try {
    await ensureDir(layoutsDest);
    const files = await fs.readdir(layoutsSrc);
    
    const layoutTasks = files.map(async (file) => {
      const srcPath = path.join(layoutsSrc, file);
      const destPath = path.join(layoutsDest, file);
      const content = await fs.readFile(srcPath, 'utf-8');
      
      if (await meta.hasChanged(srcPath, content)) {
        await fs.copyFile(srcPath, destPath);
        console.log(`✅ Copied: _layouts/${file}`);
        return 1;
      }
      return 0;
    });
    
    const results = await Promise.all(layoutTasks);
    processedCount += results.reduce((sum, count) => sum + count, 0);
    
  } catch (error) {
    // Layouts are optional
  }
  
  return processedCount;
}

async function cleanDeletedFiles(meta, profiler) {
  let deletedCount = 0;
  const existingFiles = Object.keys(meta.data);
  
  for (const filePath of existingFiles) {
    try {
      await fs.access(filePath);
    } catch (error) {
      // File no longer exists, remove from output
      const publicPath = filePath.replace(CONFIG.srcDir, CONFIG.publicDir);
      try {
        await fs.unlink(publicPath);
        console.log(`🗑️  Deleted: ${publicPath}`);
        deletedCount++;
      } catch (deleteError) {
        // File might already be deleted
      }
      
      meta.markDeleted(filePath);
    }
  }
  
  return deletedCount;
}

// Main optimized incremental build function
async function buildIncrementalOptimized() {
  console.log('🚀 Starting optimized incremental build...\n');
  
  // Initialize profiler
  const profiler = new BuildProfiler();
  profiler.start();
  
  const meta = new OptimizedBuildMeta();
  await meta.load();
  
  try {
    // Setup directories
    profiler.startPhase('directory_setup', 'Setting up directories');
    await ensureDir(CONFIG.publicDir);
    for (const section of CONFIG.contentSections) {
      await ensureDir(path.join(CONFIG.publicDir, section));
    }
    await ensureDir(path.join(CONFIG.publicDir, CONFIG.assetsDir));
    profiler.endPhase();
    
    let totalProcessed = 0;
    
    // Clean deleted files
    profiler.startPhase('cleanup', 'Cleaning deleted files');
    console.log('Checking for deleted files...');
    const deletedCount = await cleanDeletedFiles(meta, profiler);
    profiler.endPhase();
    
    // Process content sections
    profiler.startPhase('content_processing', 'Processing content sections');
    console.log('\nProcessing content sections...');
    for (const section of CONFIG.contentSections) {
      console.log(`Processing ${section}...`);
      totalProcessed += await processContentSectionIncremental(meta, section, profiler);
    }
    profiler.endPhase();
    
    // Process root files
    profiler.startPhase('root_files', 'Processing root files');
    console.log('\nProcessing root files...');
    totalProcessed += await processRootFilesIncremental(meta, profiler);
    profiler.endPhase();
    
    // Jekyll configuration
    profiler.startPhase('jekyll_config', 'Processing Jekyll configuration');
    console.log('\nProcessing Jekyll configuration...');
    totalProcessed += await copyJekyllConfigIncremental(meta, profiler);
    profiler.endPhase();
    
    // Save metadata
    profiler.startPhase('metadata_save', 'Saving build metadata');
    await meta.save();
    profiler.endPhase();
    
    // Finalize
    profiler.end();
    
    // Results summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Optimized incremental build completed!');
    
    const stats = meta.getStats();
    console.log(`📊 Summary:`);
    console.log(`   - Files processed: ${totalProcessed}`);
    console.log(`   - Files deleted: ${deletedCount}`);
    console.log(`   - Files skipped: ${stats.totalFiles - totalProcessed}`);
    console.log(`📁 Output directory: ${CONFIG.publicDir}`);
    
    // Performance summary
    if (CONFIG.profiling.enabled) {
      profiler.printSummary();
      
      if (CONFIG.profiling.outputFile) {
        const profilePath = path.join(__dirname, '..', CONFIG.profiling.outputFile);
        await profiler.saveReport(profilePath);
      }
    }
    
  } catch (error) {
    profiler.end();
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the optimized incremental build
if (require.main === module) {
  buildIncrementalOptimized();
}

module.exports = { buildIncrementalOptimized, OptimizedBuildMeta };