#!/usr/bin/env node

/**
 * Build with Custom Processors
 * Enhanced build script with custom processor support
 */

const fs = require('fs').promises;
const path = require('path');
const { ProcessorChain, ProcessorFactory } = require('./processor-system');
const { marked } = require('marked');

// Load configuration
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    return {
      srcDir: path.join(__dirname, '..', 'src'),
      publicDir: path.join(__dirname, '..', 'public'),
      chaptersDir: 'chapters',
      assetsDir: 'assets',
      
      // Processor configuration
      processors: {
        enabled: [],
        custom: [],
        options: {}
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
    
    processors: {
      enabled: ['metadata', 'include', 'variable'],
      custom: [],
      options: {
        include: {
          basePath: path.join(__dirname, '..', 'src'),
          recursive: true
        },
        variable: {
          variables: {
            year: new Date().getFullYear(),
            date: new Date().toLocaleDateString()
          }
        }
      }
    },
    
    contentSections: [
      {
        name: 'introduction',
        title: 'はじめに',
        directory: 'introduction',
        enabled: true,
        order: 1
      },
      {
        name: 'chapters',
        title: '本章',
        directory: 'chapters',
        enabled: true,
        order: 2
      },
      {
        name: 'appendices',
        title: '付録',
        directory: 'appendices',
        enabled: true,
        order: 3
      }
    ],
    
    excludePatterns: [
      /draft\.md$/,
      /notes\.md$/,
      /private\.md$/
    ]
  };
}

// Initialize processor chain
async function initializeProcessors(config) {
  const chain = new ProcessorChain();
  
  // Add error handler
  chain.addErrorHandler((error, processor, metadata) => {
    console.error(`Error in processor ${processor.name}:`, error.message);
    if (metadata.filePath) {
      console.error(`  File: ${metadata.filePath}`);
    }
  });
  
  // Load enabled built-in processors
  const enabledProcessors = config.processors.enabled || [];
  
  for (const processorName of enabledProcessors) {
    try {
      const options = config.processors.options[processorName] || {};
      const processor = ProcessorFactory.create(processorName, options);
      
      // Determine priority
      const priority = getPriority(processorName);
      
      chain.addProcessor(processor, priority);
      console.log(`✅ Loaded processor: ${processorName} (priority: ${priority})`);
    } catch (error) {
      console.error(`Failed to load processor '${processorName}':`, error.message);
    }
  }
  
  // Load custom processors
  const customProcessors = config.processors.custom || [];
  
  for (const customProcessor of customProcessors) {
    try {
      let ProcessorClass;
      
      if (typeof customProcessor === 'string') {
        // Load from file
        ProcessorClass = require(path.resolve(customProcessor));
      } else if (typeof customProcessor === 'object') {
        // Load with configuration
        ProcessorClass = require(path.resolve(customProcessor.path));
        const processor = new ProcessorClass(customProcessor.options || {});
        chain.addProcessor(processor, customProcessor.priority || 200);
        console.log(`✅ Loaded custom processor: ${processor.name}`);
        continue;
      }
      
      const processor = new ProcessorClass();
      chain.addProcessor(processor, 200);
      console.log(`✅ Loaded custom processor: ${processor.name}`);
    } catch (error) {
      console.error(`Failed to load custom processor:`, error.message);
    }
  }
  
  return chain;
}

// Get processor priority
function getPriority(processorName) {
  const priorities = {
    metadata: 10,      // First - extract metadata
    include: 20,       // Early - include files
    variable: 30,      // Early - replace variables
    diagram: 100,      // Middle - render diagrams
    table: 110,        // Middle - process tables
    codeBlock: 120,    // Middle - process code blocks
    link: 200          // Late - transform links
  };
  
  return priorities[processorName] || 100;
}

// Process file with processors
async function processFile(filePath, processors, config) {
  const content = await fs.readFile(filePath, 'utf-8');
  
  const metadata = {
    filePath,
    relativePath: path.relative(config.srcDir, filePath),
    filename: path.basename(filePath),
    directory: path.dirname(filePath)
  };
  
  // Process through processor chain
  const result = await processors.process(content, metadata);
  
  // Convert markdown to HTML (if needed)
  let finalContent = result.content;
  
  // Log processing results
  const duration = result.results.reduce((sum, r) => sum + (r.duration || 0), 0);
  console.log(`  Processed in ${duration}ms with ${result.results.length} processors`);
  
  return {
    content: finalContent,
    metadata,
    processingResults: result.results
  };
}

// Build with processors
async function buildWithProcessors() {
  console.log('🚀 Starting build with custom processors...\n');
  
  const startTime = Date.now();
  const config = await loadConfig();
  const processors = await initializeProcessors(config);
  
  console.log(`\n📋 Available processors: ${ProcessorFactory.getAvailable().join(', ')}\n`);
  
  // Clean and prepare public directory
  console.log('Cleaning public directory...');
  await fs.rm(config.publicDir, { recursive: true, force: true });
  await fs.mkdir(config.publicDir, { recursive: true });
  
  // Create directories
  const enabledSections = config.contentSections.filter(s => s.enabled);
  for (const section of enabledSections) {
    await fs.mkdir(path.join(config.publicDir, section.directory), { recursive: true });
  }
  await fs.mkdir(path.join(config.publicDir, config.assetsDir), { recursive: true });
  
  console.log('\nProcessing content...\n');
  
  let totalFiles = 0;
  let successCount = 0;
  let errorCount = 0;
  const processingStats = [];
  
  // Process content sections
  for (const section of enabledSections) {
    const sectionPath = path.join(config.srcDir, section.directory);
    
    try {
      console.log(`Processing ${section.name}...`);
      const items = await fs.readdir(sectionPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const itemSrcDir = path.join(sectionPath, item.name);
          const itemDestDir = path.join(config.publicDir, section.directory, item.name);
          await fs.mkdir(itemDestDir, { recursive: true });
          
          const files = await fs.readdir(itemSrcDir);
          
          for (const file of files) {
            if (file.endsWith('.md')) {
              const srcFile = path.join(itemSrcDir, file);
              const destFile = path.join(itemDestDir, file);
              
              // Check exclusion
              const shouldExclude = config.excludePatterns.some(p => p.test(file));
              if (shouldExclude) {
                console.log(`  Skipping: ${file}`);
                continue;
              }
              
              totalFiles++;
              
              try {
                console.log(`  Processing: ${file}`);
                const result = await processFile(srcFile, processors, config);
                
                // Write processed content
                await fs.writeFile(destFile, result.content, 'utf-8');
                
                successCount++;
                processingStats.push({
                  file: result.metadata.relativePath,
                  processors: result.processingResults,
                  success: true
                });
              } catch (error) {
                console.error(`  ❌ Error processing ${file}:`, error.message);
                errorCount++;
                processingStats.push({
                  file: path.relative(config.srcDir, srcFile),
                  error: error.message,
                  success: false
                });
              }
            }
          }
        } else if (item.isFile() && item.name.endsWith('.md')) {
          const srcFile = path.join(sectionPath, item.name);
          const destFile = path.join(config.publicDir, section.directory, item.name);
          
          // Check exclusion
          const shouldExclude = config.excludePatterns.some(p => p.test(item.name));
          if (shouldExclude) {
            console.log(`  Skipping: ${item.name}`);
            continue;
          }
          
          totalFiles++;
          
          try {
            console.log(`  Processing: ${item.name}`);
            const result = await processFile(srcFile, processors, config);
            
            await fs.writeFile(destFile, result.content, 'utf-8');
            
            successCount++;
            processingStats.push({
              file: result.metadata.relativePath,
              processors: result.processingResults,
              success: true
            });
          } catch (error) {
            console.error(`  ❌ Error processing ${item.name}:`, error.message);
            errorCount++;
            processingStats.push({
              file: path.relative(config.srcDir, srcFile),
              error: error.message,
              success: false
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Section directory not found: ${sectionPath}`);
    }
  }
  
  // Copy assets
  console.log('\nCopying assets...');
  await copyAssets(config);
  
  // Copy Jekyll files
  console.log('\nCopying configuration files...');
  await copyJekyllFiles(config);
  
  // Generate processing report
  const reportPath = path.join(config.publicDir, 'processing-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    totalFiles,
    successCount,
    errorCount,
    processors: processors.getProcessors(),
    files: processingStats
  };
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  
  // Summary
  console.log('\n✅ Build completed!');
  console.log(`📁 Output directory: ${config.publicDir}`);
  console.log(`\n📊 Build Statistics:`);
  console.log(`  Total files: ${totalFiles}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${errorCount}`);
  console.log(`  Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  console.log(`\n📄 Processing report: ${reportPath}`);
  
  if (errorCount > 0) {
    console.error(`\n⚠️  ${errorCount} files failed to process`);
    process.exit(1);
  }
}

// Copy assets directory
async function copyAssets(config) {
  const srcAssetsPath = path.join(config.srcDir, config.assetsDir);
  const destAssetsPath = path.join(config.publicDir, config.assetsDir);
  
  try {
    await copyDirectory(srcAssetsPath, destAssetsPath);
    console.log('Copied src/assets directory');
  } catch (error) {
    console.log('No src/assets directory found');
  }
  
  // Also check root assets
  const rootAssetsPath = path.join(__dirname, '..', config.assetsDir);
  try {
    await copyDirectory(rootAssetsPath, destAssetsPath);
    console.log('Copied root assets directory');
  } catch (error) {
    console.log('No root assets directory found');
  }
}

// Copy Jekyll configuration files
async function copyJekyllFiles(config) {
  const jekyllFiles = ['index.md', '_config.yml'];
  
  for (const file of jekyllFiles) {
    try {
      await fs.copyFile(
        path.join(__dirname, '..', file),
        path.join(config.publicDir, file)
      );
      console.log(`Copied: ${file}`);
    } catch (error) {
      console.log(`${file} not found`);
    }
  }
  
  // Copy _layouts directory
  try {
    const layoutsSrc = path.join(__dirname, '..', '_layouts');
    const layoutsDest = path.join(config.publicDir, '_layouts');
    await copyDirectory(layoutsSrc, layoutsDest);
    console.log('Copied _layouts directory');
  } catch (error) {
    console.log('No _layouts directory found');
  }
}

// Copy directory recursively
async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Run build
if (require.main === module) {
  buildWithProcessors().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

module.exports = { buildWithProcessors };