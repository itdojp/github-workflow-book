#!/usr/bin/env node

/**
 * Optimized Parallel Build Script
 * High-performance build system for large-scale book projects
 */

const fs = require('fs').promises;
const path = require('path');
const ParallelProcessor = require('./parallel-processor');
const BuildProfiler = require('./build-profiler');
const StreamingProcessor = require('./streaming-processor');

// Load existing configuration system
let CONFIG;

async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    // Default configuration with performance optimizations
    return {
      srcDir: path.join(__dirname, '..', 'src'),
      publicDir: path.join(__dirname, '..', 'public'),
      chaptersDir: 'chapters',
      assetsDir: 'assets',
      
      // Performance settings
      parallel: {
        enabled: true,
        maxWorkers: Math.min(require('os').cpus().length, 8),
        chunkSize: 64 * 1024, // 64KB
        largeFileThreshold: 1024 * 1024 // 1MB
      },
      
      // Profiling settings
      profiling: {
        enabled: true,
        outputFile: '.build-profile.json',
        memorySnapshots: true
      },
      
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
    
    parallel: {
      enabled: true,
      maxWorkers: Math.min(require('os').cpus().length, 8),
      chunkSize: 64 * 1024,
      largeFileThreshold: 1024 * 1024
    },
    
    profiling: {
      enabled: true,
      outputFile: '.build-profile.json',
      memorySnapshots: true
    },
    
    contentSections: [
      {
        name: 'introduction',
        title: 'はじめに',
        directory: 'introduction',
        enabled: true,
        order: 1,
        numbering: false
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
        name: 'tutorials',
        title: 'チュートリアル',
        directory: 'tutorials',
        enabled: true,
        order: 3,
        numbering: true
      },
      {
        name: 'appendices',
        title: '付録',
        directory: 'appendices',
        enabled: true,
        order: 4,
        numbering: true
      },
      {
        name: 'afterword',
        title: 'あとがき',
        directory: 'afterword',
        enabled: true,
        order: 5,
        numbering: false
      }
    ],
    
    tableOfContents: {
      enabled: true,
      title: '目次',
      outputFile: 'table-of-contents.md',
      maxDepth: 3,
      includeNumbers: true
    },
    
    publicFiles: [
      'README.md',
      'setup-guide.md'
    ],
    
    excludePatterns: [
      /draft\.md$/,
      /notes\.md$/,
      /solutions\.md$/,
      /instructor\.md$/,
      /private\.md$/,
      /private-to-public-deployment-guide\.md$/,
      /\.tmp$/
    ]
  };
}

// Utility functions
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory ${dir}:`, error);
  }
}

async function shouldExclude(filePath) {
  const fileName = path.basename(filePath);
  if (CONFIG.excludePatterns) {
    for (const pattern of CONFIG.excludePatterns) {
      if (pattern && typeof pattern.test === 'function' && pattern.test(fileName)) {
        return true;
      }
    }
  }
  return false;
}

async function copyFile(src, dest) {
  try {
    await fs.copyFile(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
  } catch (error) {
    console.error(`Failed to copy ${src}:`, error);
  }
}

// Build a list of all markdown files to process
async function buildFileList() {
  const fileList = [];
  
  // Process content sections
  const enabledSections = CONFIG.contentSections.filter(section => section.enabled);
  
  for (const section of enabledSections) {
    const sectionPath = path.join(CONFIG.srcDir, section.directory);
    
    try {
      const items = await fs.readdir(sectionPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const itemSrcDir = path.join(sectionPath, item.name);
          const itemDestDir = path.join(CONFIG.publicDir, section.directory, item.name);
          
          const files = await fs.readdir(itemSrcDir);
          for (const file of files) {
            if (file.endsWith('.md') && !await shouldExclude(file)) {
              fileList.push({
                srcPath: path.join(itemSrcDir, file),
                destPath: path.join(itemDestDir, file),
                sectionName: section.name,
                excludePatterns: CONFIG.excludePatterns.map(p => ({ source: p.source, flags: p.flags })),
                collectHeadings: true,
                maxDepth: CONFIG.tableOfContents.maxDepth
              });
            }
          }
        } else if (item.isFile() && item.name.endsWith('.md') && !await shouldExclude(item.name)) {
          fileList.push({
            srcPath: path.join(sectionPath, item.name),
            destPath: path.join(CONFIG.publicDir, section.directory, item.name),
            sectionName: section.name,
            excludePatterns: CONFIG.excludePatterns.map(p => ({ source: p.source, flags: p.flags })),
            collectHeadings: true,
            maxDepth: CONFIG.tableOfContents.maxDepth
          });
        }
      }
    } catch (error) {
      console.warn(`Section directory not found: ${sectionPath}`);
    }
  }
  
  return fileList;
}

// Generate table of contents from headings
function generateTableOfContents(allHeadings) {
  if (!CONFIG.tableOfContents.enabled) {
    return '';
  }
  
  let toc = `# ${CONFIG.tableOfContents.title}\n\n`;
  
  // Group headings by section
  const enabledSections = CONFIG.contentSections
    .filter(section => section.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  const headingsBySection = {};
  
  for (const heading of allHeadings) {
    if (!headingsBySection[heading.sectionName]) {
      headingsBySection[heading.sectionName] = [];
    }
    headingsBySection[heading.sectionName].push(heading);
  }
  
  let chapterNumber = 0;
  let appendixNumber = 0;
  let tutorialNumber = 0;
  
  for (const section of enabledSections) {
    if (!headingsBySection[section.name]) continue;
    
    const headings = headingsBySection[section.name];
    
    for (const heading of headings) {
      const indent = '  '.repeat(Math.max(0, heading.level - 1));
      const relativePath = path.relative(CONFIG.publicDir, heading.filePath).replace(/\\/g, '/');
      
      if (section.numbering && heading.level === 1) {
        if (section.name === 'chapters') {
          chapterNumber++;
          if (CONFIG.tableOfContents.includeNumbers) {
            toc += `${indent}- [第${chapterNumber}章: ${heading.title}](${relativePath}#${heading.anchor})\n`;
          } else {
            toc += `${indent}- [${heading.title}](${relativePath}#${heading.anchor})\n`;
          }
        } else if (section.name === 'tutorials') {
          tutorialNumber++;
          const hasExistingNumber = heading.title.match(/チュートリアル\d+/);
          if (hasExistingNumber) {
            toc += `${indent}- [${heading.title}](${relativePath}#${heading.anchor})\n`;
          } else {
            toc += `${indent}- [チュートリアル${tutorialNumber}: ${heading.title}](${relativePath}#${heading.anchor})\n`;
          }
        } else if (section.name === 'appendices') {
          appendixNumber++;
          const hasExistingNumber = heading.title.match(/付録[A-Z\d]+/);
          if (hasExistingNumber) {
            toc += `${indent}- [${heading.title}](${relativePath}#${heading.anchor})\n`;
          } else {
            const appendixLetter = String.fromCharCode(65 + appendixNumber - 1); // A, B, C...
            toc += `${indent}- [付録${appendixLetter}: ${heading.title}](${relativePath}#${heading.anchor})\n`;
          }
        } else {
          toc += `${indent}- [${heading.title}](${relativePath}#${heading.anchor})\n`;
        }
      } else {
        toc += `${indent}- [${heading.title}](${relativePath}#${heading.anchor})\n`;
      }
    }
  }
  
  return toc;
}

// Copy assets with parallel processing
async function copyAssetsParallel(srcDir, destDir, profiler) {
  profiler.startPhase('copy_assets', `Copying assets from ${srcDir}`);
  
  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    const copyTasks = [];
    
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      
      if (entry.isDirectory()) {
        copyTasks.push(ensureDir(destPath).then(() => copyAssetsParallel(srcPath, destPath, profiler)));
      } else if (entry.isFile()) {
        if (!await shouldExclude(srcPath)) {
          copyTasks.push(copyFile(srcPath, destPath));
        }
      }
    }
    
    await Promise.all(copyTasks);
    profiler.endPhase();
  } catch (error) {
    console.error(`Failed to copy assets from ${srcDir}:`, error);
    profiler.endPhase();
  }
}

// Main optimized build function
async function buildOptimized() {
  console.log('🚀 Starting optimized parallel build...\n');
  
  // Initialize profiler
  const profiler = new BuildProfiler();
  profiler.start();
  
  try {
    // Load configuration
    profiler.startPhase('config_load', 'Loading configuration');
    CONFIG = await loadConfig();
    console.log('📋 Configuration loaded');
    profiler.endPhase();
    
    // Clean and prepare directories
    profiler.startPhase('directory_setup', 'Setting up directories');
    console.log('Cleaning public directory...');
    await fs.rm(CONFIG.publicDir, { recursive: true, force: true });
    await ensureDir(CONFIG.publicDir);
    
    const enabledSections = CONFIG.contentSections.filter(section => section.enabled);
    for (const section of enabledSections) {
      await ensureDir(path.join(CONFIG.publicDir, section.directory));
    }
    await ensureDir(path.join(CONFIG.publicDir, CONFIG.assetsDir));
    profiler.endPhase();
    
    // Build file list
    profiler.startPhase('file_discovery', 'Discovering files to process');
    const fileList = await buildFileList();
    console.log(`\nFound ${fileList.length} files to process`);
    profiler.metrics.totalFiles = fileList.length;
    profiler.endPhase();
    
    // Process files in parallel
    profiler.startPhase('file_processing', 'Processing markdown files');
    console.log('\nProcessing content sections...');
    
    let allHeadings = [];
    
    // Use streaming processor for reliable processing
    const streamingProcessor = new StreamingProcessor({
      chunkSize: CONFIG.parallel.chunkSize,
      largeFileThreshold: CONFIG.parallel.largeFileThreshold
    });
    
    console.log(`Processing ${fileList.length} files with streaming processor...`);
    
    if (CONFIG.parallel.enabled && fileList.length > 3) {
      // Process files in parallel batches
      const batchSize = CONFIG.parallel.maxWorkers;
      const batches = [];
      
      for (let i = 0; i < fileList.length; i += batchSize) {
        batches.push(fileList.slice(i, i + batchSize));
      }
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`\nProcessing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);
        
        const batchPromises = batch.map(async (file, index) => {
          const startTime = Date.now();
          const result = await streamingProcessor.processFile(
            file.srcPath,
            file.destPath,
            file.sectionName,
            file.collectHeadings,
            file.maxDepth
          );
          
          if (result.type === 'success') {
            profiler.recordFileProcessing(result.srcPath, startTime, Date.now(), result.size);
            if (result.headings) {
              allHeadings.push(...result.headings);
            }
            console.log(`  ✅ Processed: ${path.basename(file.srcPath)}`);
          } else if (result.type === 'skipped') {
            profiler.recordSkippedFile();
            console.log(`  ⏭️  Skipped: ${path.basename(file.srcPath)}`);
          } else {
            console.error(`  ❌ Failed: ${path.basename(file.srcPath)} - ${result.error.message}`);
            profiler.recordErrorFile();
          }
          
          return result;
        });
        
        await Promise.all(batchPromises);
      }
      
      console.log(`\n✅ Parallel batch processing completed`);
    } else {
      // Sequential processing for small numbers of files
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        process.stdout.write(`\r📊 Progress: ${i + 1}/${fileList.length} (${Math.round(((i + 1) / fileList.length) * 100)}%)`);
        
        const startTime = Date.now();
        const result = await streamingProcessor.processFile(
          file.srcPath,
          file.destPath,
          file.sectionName,
          file.collectHeadings,
          file.maxDepth
        );
        
        if (result.type === 'success') {
          profiler.recordFileProcessing(result.srcPath, startTime, Date.now(), result.size);
          if (result.headings) {
            allHeadings.push(...result.headings);
          }
        } else if (result.type === 'skipped') {
          profiler.recordSkippedFile();
        } else {
          console.error(`\n❌ Failed to process ${file.srcPath}:`, result.error.message);
          profiler.recordErrorFile();
        }
      }
      console.log(`\n✅ Sequential processing completed`);
    }
    
    profiler.endPhase();
    
    // Generate table of contents
    if (CONFIG.tableOfContents.enabled && allHeadings.length > 0) {
      profiler.startPhase('toc_generation', 'Generating table of contents');
      console.log('\nGenerating table of contents...');
      const tocContent = generateTableOfContents(allHeadings);
      const tocPath = path.join(CONFIG.publicDir, CONFIG.tableOfContents.outputFile);
      await fs.writeFile(tocPath, tocContent, 'utf-8');
      console.log(`Generated: ${tocPath}`);
      profiler.endPhase();
    }
    
    // Copy assets in parallel
    console.log('\nCopying assets...');
    
    const assetCopyTasks = [];
    
    // src/assets
    const srcAssetsPath = path.join(CONFIG.srcDir, CONFIG.assetsDir);
    assetCopyTasks.push(
      fs.access(srcAssetsPath)
        .then(() => copyAssetsParallel(srcAssetsPath, path.join(CONFIG.publicDir, CONFIG.assetsDir), profiler))
        .then(() => console.log('Copied src/assets directory'))
        .catch(() => console.log('No src/assets directory found'))
    );
    
    // Root assets
    const rootAssetsPath = path.join(__dirname, '..', CONFIG.assetsDir);
    assetCopyTasks.push(
      fs.access(rootAssetsPath)
        .then(() => copyAssetsParallel(rootAssetsPath, path.join(CONFIG.publicDir, CONFIG.assetsDir), profiler))
        .then(() => console.log('Copied root assets directory'))
        .catch(() => console.log('No root assets directory found'))
    );
    
    await Promise.all(assetCopyTasks);
    
    // Copy root files
    profiler.startPhase('root_files', 'Copying root files');
    console.log('\nCopying root files...');
    
    const rootFileTasks = CONFIG.publicFiles.map(async (file) => {
      const srcPath = path.join(__dirname, '..', file);
      const destPath = path.join(CONFIG.publicDir, file);
      
      try {
        await copyFile(srcPath, destPath);
      } catch (error) {
        console.warn(`Failed to copy ${file}:`, error.message);
      }
    });
    
    await Promise.all(rootFileTasks);
    profiler.endPhase();
    
    // Copy index and Jekyll configuration
    profiler.startPhase('jekyll_config', 'Copying Jekyll configuration');
    console.log('\nCopying configuration files...');
    
    const configTasks = [
      // index.md
      copyFile(
        path.join(__dirname, '..', 'index.md'),
        path.join(CONFIG.publicDir, 'index.md')
      ).catch(() => console.log('No index.md found')),
      
      // _config.yml
      copyFile(
        path.join(__dirname, '..', '_config.yml'),
        path.join(CONFIG.publicDir, '_config.yml')
      ).catch(() => console.log('No _config.yml found')),
    ];
    
    // _layouts directory
    const layoutsSrc = path.join(__dirname, '..', '_layouts');
    const layoutsDest = path.join(CONFIG.publicDir, '_layouts');
    configTasks.push(
      fs.access(layoutsSrc)
        .then(() => ensureDir(layoutsDest))
        .then(() => copyAssetsParallel(layoutsSrc, layoutsDest, profiler))
        .then(() => console.log('Copied _layouts directory'))
        .catch(() => console.log('No _layouts directory found'))
    );
    
    await Promise.all(configTasks);
    profiler.endPhase();
    
    // Finalize build
    profiler.end();
    
    console.log('\n✅ Optimized build completed successfully!');
    console.log(`📁 Output directory: ${CONFIG.publicDir}`);
    
    // Print performance summary
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

// Enhanced parallel build with GitHub Actions matrix support
async function buildWithMatrix() {
  const startTime = Date.now();
  console.log('🚀 Starting matrix-based parallel build...\n');
  
  try {
    // Detect if running in GitHub Actions
    const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
    const matrixChunk = process.env.MATRIX_CHUNK;
    
    if (isGitHubActions && matrixChunk !== undefined) {
      console.log(`📦 Processing matrix chunk: ${matrixChunk}`);
      
      // Read chunk file list from environment
      const chunkFiles = process.env.CHUNK_FILES ? 
        process.env.CHUNK_FILES.split('\n').filter(Boolean) : [];
      
      if (chunkFiles.length === 0) {
        console.warn('⚠️  No files in chunk, using standard parallel build');
        return buildOptimized();
      }
      
      // Load config
      CONFIG = await loadConfig();
      
      // Process only the files in this chunk
      const processor = new ParallelProcessor({
        maxWorkers: CONFIG.parallel.maxWorkers
      });
      
      const tasks = chunkFiles.map(file => ({
        type: 'markdown',
        inputPath: file,
        outputPath: file.replace(CONFIG.srcDir, CONFIG.publicDir).replace('.md', '.html')
      }));
      
      const results = await processor.processTasks(tasks);
      console.log(`✅ Chunk ${matrixChunk} completed: ${results.length} files processed`);
      
    } else {
      // Standard parallel build for local development
      return buildOptimized();
    }
    
  } catch (error) {
    console.error('❌ Matrix build failed:', error);
    throw error;
  }
}

// Run the optimized build
if (require.main === module) {
  buildOptimized();
}

module.exports = { buildOptimized, buildWithMatrix, loadConfig };