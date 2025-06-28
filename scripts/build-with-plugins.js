#!/usr/bin/env node

/**
 * Enhanced Build Script with Plugin Support
 * Builds the book with plugin system integration
 */

const fs = require('fs').promises;
const path = require('path');
const { PluginSystem } = require('./plugin-system');

// Load configuration
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    // Default configuration
    return {
      srcDir: path.join(__dirname, '..', 'src'),
      publicDir: path.join(__dirname, '..', 'public'),
      chaptersDir: 'chapters',
      assetsDir: 'assets',
      
      // Plugin configuration
      plugins: [],
      
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
    
    plugins: [],
    
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
        name: 'appendices',
        title: '付録',
        directory: 'appendices',
        enabled: true,
        order: 3,
        numbering: true
      }
    ],
    
    tableOfContents: {
      enabled: true,
      title: '目次',
      outputFile: 'table-of-contents.md',
      maxDepth: 3,
      includeNumbers: true
    },
    
    excludePatterns: [
      /draft\.md$/,
      /notes\.md$/,
      /solutions\.md$/,
      /instructor\.md$/,
      /private\.md$/
    ]
  };
}

// Initialize plugin system
async function initializePlugins(config) {
  const pluginSystem = new PluginSystem();
  
  const context = {
    config,
    srcDir: config.srcDir,
    publicDir: config.publicDir,
    buildStartTime: Date.now()
  };
  
  await pluginSystem.initialize(context);
  
  return pluginSystem;
}

// Process markdown file with plugins
async function processMarkdownFile(srcPath, destPath, content, pluginSystem, metadata) {
  // Clean content (remove private sections)
  let processedContent = content;
  processedContent = processedContent.replace(/<!-- private -->[\s\S]*?<!-- \/private -->/g, '');
  processedContent = processedContent.replace(/<!-- PRIVATE.*?-->/g, '');
  processedContent = processedContent.replace(/## 講師向け[\s\S]*?(?=##|$)/g, '');
  
  // Apply plugin transformations
  processedContent = await pluginSystem.transformThroughHooks(
    'processContent',
    processedContent,
    metadata
  );
  
  return processedContent;
}

// Build with plugins
async function buildWithPlugins() {
  console.log('🚀 Starting build with plugin support...\n');
  
  const config = await loadConfig();
  const pluginSystem = await initializePlugins(config);
  
  // Execute beforeBuild hooks
  await pluginSystem.executeHook('beforeBuild');
  
  // Clean and prepare public directory
  console.log('Cleaning public directory...');
  await fs.rm(config.publicDir, { recursive: true, force: true });
  await fs.mkdir(config.publicDir, { recursive: true });
  
  // Create directories for content sections
  const enabledSections = config.contentSections.filter(section => section.enabled);
  for (const section of enabledSections) {
    await fs.mkdir(path.join(config.publicDir, section.directory), { recursive: true });
  }
  
  // Create assets directory
  await fs.mkdir(path.join(config.publicDir, config.assetsDir), { recursive: true });
  
  console.log('\nProcessing content sections...');
  
  // Process each content section
  const allHeadings = [];
  
  for (const section of enabledSections) {
    const sectionPath = path.join(config.srcDir, section.directory);
    
    try {
      console.log(`\nProcessing ${section.name}...`);
      const items = await fs.readdir(sectionPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          // Process directory
          const itemSrcDir = path.join(sectionPath, item.name);
          const itemDestDir = path.join(config.publicDir, section.directory, item.name);
          await fs.mkdir(itemDestDir, { recursive: true });
          
          // Process files in directory
          const files = await fs.readdir(itemSrcDir);
          for (const file of files) {
            if (file.endsWith('.md')) {
              const srcFile = path.join(itemSrcDir, file);
              const destFile = path.join(itemDestDir, file);
              
              // Check if should exclude
              const shouldExclude = config.excludePatterns.some(pattern => pattern.test(file));
              if (shouldExclude) {
                console.log(`  Skipping: ${file}`);
                continue;
              }
              
              // Execute beforeProcessFile hook
              await pluginSystem.executeHook('beforeProcessFile', srcFile, destFile);
              
              // Read and process file
              const content = await fs.readFile(srcFile, 'utf-8');
              const metadata = {
                section: section.name,
                directory: item.name,
                filename: file
              };
              
              const processedContent = await processMarkdownFile(
                srcFile,
                destFile,
                content,
                pluginSystem,
                metadata
              );
              
              // Execute beforeWrite hook
              const finalContent = await pluginSystem.transformThroughHooks(
                'beforeWrite',
                processedContent,
                destFile
              );
              
              // Write file
              await fs.writeFile(destFile, finalContent, 'utf-8');
              console.log(`  Processed: ${file}`);
              
              // Execute afterProcessFile hook
              await pluginSystem.executeHook('afterProcessFile', srcFile, destFile);
              
              // Extract headings for TOC
              const headings = extractHeadings(finalContent, destFile, section.name, config.tableOfContents.maxDepth);
              allHeadings.push(...headings);
            }
          }
        } else if (item.isFile() && item.name.endsWith('.md')) {
          // Process single file
          const srcFile = path.join(sectionPath, item.name);
          const destFile = path.join(config.publicDir, section.directory, item.name);
          
          // Check if should exclude
          const shouldExclude = config.excludePatterns.some(pattern => pattern.test(item.name));
          if (shouldExclude) {
            console.log(`  Skipping: ${item.name}`);
            continue;
          }
          
          // Process file (same as above)
          await pluginSystem.executeHook('beforeProcessFile', srcFile, destFile);
          
          const content = await fs.readFile(srcFile, 'utf-8');
          const metadata = {
            section: section.name,
            filename: item.name
          };
          
          const processedContent = await processMarkdownFile(
            srcFile,
            destFile,
            content,
            pluginSystem,
            metadata
          );
          
          const finalContent = await pluginSystem.transformThroughHooks(
            'beforeWrite',
            processedContent,
            destFile
          );
          
          await fs.writeFile(destFile, finalContent, 'utf-8');
          console.log(`  Processed: ${item.name}`);
          
          await pluginSystem.executeHook('afterProcessFile', srcFile, destFile);
          
          const headings = extractHeadings(finalContent, destFile, section.name, config.tableOfContents.maxDepth);
          allHeadings.push(...headings);
        }
      }
    } catch (error) {
      console.warn(`Section directory not found: ${sectionPath}`);
    }
  }
  
  // Generate table of contents
  if (config.tableOfContents.enabled) {
    console.log('\nGenerating table of contents...');
    
    // Execute beforeGenerateTOC hook
    await pluginSystem.executeHook('beforeGenerateTOC', allHeadings);
    
    // Allow plugins to modify TOC entries
    const modifiedHeadings = await pluginSystem.transformThroughHooks(
      'modifyTOC',
      allHeadings
    );
    
    const tocContent = generateTableOfContents(modifiedHeadings, config);
    const tocPath = path.join(config.publicDir, config.tableOfContents.outputFile);
    await fs.writeFile(tocPath, tocContent, 'utf-8');
    console.log(`Generated: ${tocPath}`);
  }
  
  // Copy assets
  console.log('\nCopying assets...');
  const srcAssetsPath = path.join(config.srcDir, config.assetsDir);
  const destAssetsPath = path.join(config.publicDir, config.assetsDir);
  
  try {
    await copyDirectory(srcAssetsPath, destAssetsPath, pluginSystem);
    console.log('Copied src/assets directory');
  } catch (error) {
    console.log('No src/assets directory found');
  }
  
  // Copy root assets
  const rootAssetsPath = path.join(__dirname, '..', config.assetsDir);
  try {
    await copyDirectory(rootAssetsPath, destAssetsPath, pluginSystem);
    console.log('Copied root assets directory');
  } catch (error) {
    console.log('No root assets directory found');
  }
  
  // Copy public files
  console.log('\nCopying root files...');
  const publicFiles = config.publicFiles || ['README.md', 'setup-guide.md'];
  
  for (const file of publicFiles) {
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
  
  // Copy Jekyll files
  console.log('\nCopying Jekyll configuration...');
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
  
  // Execute afterBuild hooks
  await pluginSystem.executeHook('afterBuild');
  
  console.log('\n✅ Build completed successfully!');
  console.log(`📁 Output directory: ${config.publicDir}`);
  
  // Show loaded plugins
  const loadedPlugins = pluginSystem.getAllPlugins();
  if (loadedPlugins.length > 0) {
    console.log('\n📦 Loaded plugins:');
    for (const plugin of loadedPlugins) {
      console.log(`  - ${plugin.name} v${plugin.version}`);
    }
  }
}

// Extract headings from content
function extractHeadings(content, filePath, sectionName, maxDepth = 3) {
  const headings = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
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

// Generate anchor from title
function generateAnchor(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

// Generate table of contents
function generateTableOfContents(headings, config) {
  let toc = `# ${config.tableOfContents.title}\n\n`;
  
  const enabledSections = config.contentSections
    .filter(section => section.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Group headings by section
  const headingsBySection = {};
  for (const heading of headings) {
    if (!headingsBySection[heading.sectionName]) {
      headingsBySection[heading.sectionName] = [];
    }
    headingsBySection[heading.sectionName].push(heading);
  }
  
  // Generate TOC for each section
  let chapterNumber = 0;
  let appendixNumber = 0;
  
  for (const section of enabledSections) {
    if (!headingsBySection[section.name]) continue;
    
    const sectionHeadings = headingsBySection[section.name];
    
    for (const heading of sectionHeadings) {
      const indent = '  '.repeat(Math.max(0, heading.level - 1));
      const relativePath = path.relative(config.publicDir, heading.filePath).replace(/\\/g, '/');
      
      if (section.numbering && heading.level === 1) {
        if (section.name === 'chapters') {
          chapterNumber++;
          if (config.tableOfContents.includeNumbers) {
            toc += `${indent}- [第${chapterNumber}章: ${heading.title}](${relativePath}#${heading.anchor})\n`;
          } else {
            toc += `${indent}- [${heading.title}](${relativePath}#${heading.anchor})\n`;
          }
        } else if (section.name === 'appendices') {
          appendixNumber++;
          const letter = String.fromCharCode(65 + appendixNumber - 1);
          toc += `${indent}- [付録${letter}: ${heading.title}](${relativePath}#${heading.anchor})\n`;
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

// Copy directory recursively
async function copyDirectory(src, dest, pluginSystem = null) {
  await fs.mkdir(dest, { recursive: true });
  
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, pluginSystem);
    } else {
      // Allow plugins to process assets
      if (pluginSystem) {
        const processedPath = await pluginSystem.transformThroughHooks(
          'processAsset',
          srcPath,
          destPath
        );
        
        if (processedPath !== srcPath) {
          // Plugin handled the asset
          continue;
        }
      }
      
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Run build
if (require.main === module) {
  buildWithPlugins().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

module.exports = { buildWithPlugins };