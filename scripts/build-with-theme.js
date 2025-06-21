#!/usr/bin/env node

/**
 * Build with Theme Support
 * Builds the book with the configured theme
 */

const fs = require('fs').promises;
const path = require('path');
const { ThemeSystem } = require('./theme-system');

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
      theme: 'modern',
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
    theme: 'modern',
    
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
      }
    ]
  };
}

// Generate theme CSS
async function generateThemeCSS(config) {
  console.log(`\n🎨 Generating theme: ${config.theme}`);
  
  const themeSystem = new ThemeSystem();
  await themeSystem.initialize({
    theme: config.theme,
    customThemesDir: path.join(__dirname, '..', 'themes'),
    outputDir: path.join(config.publicDir, 'assets', 'css')
  });
  
  // Load custom theme options if available
  let themeOptions = {};
  
  if (config.themeOptions && config.themeOptions[config.theme]) {
    themeOptions = config.themeOptions[config.theme];
  }
  
  // Check for theme customization file
  try {
    const customPath = path.join(__dirname, '..', 'theme-custom.json');
    const customContent = await fs.readFile(customPath, 'utf-8');
    const customConfig = JSON.parse(customContent);
    
    if (customConfig.theme === config.theme && customConfig.customizations) {
      // Merge customizations
      themeOptions = mergeDeep(themeOptions, customConfig.customizations);
      console.log('  Applied custom theme settings');
    }
  } catch (error) {
    // No customization file
  }
  
  // Generate and save CSS
  const cssPath = await themeSystem.saveTheme('theme.css');
  console.log(`  Generated CSS: ${cssPath}`);
  
  return themeSystem;
}

// Generate HTML layout with theme
async function generateHTMLLayout(config, themeSystem) {
  const layoutsDir = path.join(config.publicDir, '_layouts');
  await fs.mkdir(layoutsDir, { recursive: true });
  
  // Get active theme info
  const themeInfo = themeSystem.activeTheme;
  
  // Generate default layout
  const defaultLayout = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% if page.title %}{{ page.title }} - {% endif %}{{ site.title }}</title>
    
    <!-- Theme CSS -->
    <link rel="stylesheet" href="{{ '/assets/css/theme.css' | relative_url }}">
    
    <!-- Theme: ${config.theme} -->
    <meta name="theme-name" content="${themeInfo.name}">
    <meta name="theme-version" content="${themeInfo.version || '1.0.0'}">
    
    {% if site.favicon %}
    <link rel="icon" type="image/x-icon" href="{{ site.favicon | relative_url }}">
    {% endif %}
    
    <!-- Custom CSS -->
    {% if site.custom_css %}
    <link rel="stylesheet" href="{{ site.custom_css | relative_url }}">
    {% endif %}
</head>
<body class="theme-${config.theme}">
    <div class="site-wrapper">
        {% include header.html %}
        
        <main class="site-content">
            <div class="container">
                {{ content }}
            </div>
        </main>
        
        {% include footer.html %}
    </div>
    
    <!-- Theme-specific scripts -->
    <script>
        // Dark mode toggle
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        }
    </script>
</body>
</html>`;

  await fs.writeFile(
    path.join(layoutsDir, 'default.html'),
    defaultLayout,
    'utf-8'
  );
  
  // Generate page layout
  const pageLayout = `---
layout: default
---

<article class="page">
    {% if page.title %}
    <header class="page-header">
        <h1 class="page-title">{{ page.title }}</h1>
        {% if page.date %}
        <time class="page-date" datetime="{{ page.date | date_to_xmlschema }}">
            {{ page.date | date: "%Y年%m月%d日" }}
        </time>
        {% endif %}
    </header>
    {% endif %}
    
    <div class="page-content">
        {{ content }}
    </div>
    
    {% if page.tags %}
    <footer class="page-footer">
        <div class="page-tags">
            {% for tag in page.tags %}
            <span class="tag">{{ tag }}</span>
            {% endfor %}
        </div>
    </footer>
    {% endif %}
</article>`;

  await fs.writeFile(
    path.join(layoutsDir, 'page.html'),
    pageLayout,
    'utf-8'
  );
  
  console.log('  Generated layouts with theme support');
}

// Generate includes
async function generateIncludes(config) {
  const includesDir = path.join(config.publicDir, '_includes');
  await fs.mkdir(includesDir, { recursive: true });
  
  // Header include
  const header = `<header class="site-header">
    <nav class="site-nav">
        <a class="site-title" href="{{ '/' | relative_url }}">{{ site.title }}</a>
        
        <div class="nav-links">
            {% for item in site.navigation %}
            <a href="{{ item.url | relative_url }}" 
               class="nav-link {% if page.url == item.url %}active{% endif %}">
                {{ item.title }}
            </a>
            {% endfor %}
        </div>
        
        <!-- Theme toggle -->
        <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
            <span class="theme-toggle-light">🌞</span>
            <span class="theme-toggle-dark">🌙</span>
        </button>
    </nav>
</header>`;

  await fs.writeFile(
    path.join(includesDir, 'header.html'),
    header,
    'utf-8'
  );
  
  // Footer include
  const footer = `<footer class="site-footer">
    <div class="footer-content">
        <p>&copy; {{ site.time | date: '%Y' }} {{ site.author | default: site.title }}</p>
        <p class="theme-credit">
            Theme: <a href="{{ '/theme-info' | relative_url }}">{{ site.theme | default: 'Modern' }}</a>
        </p>
    </div>
</footer>

<script>
function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    
    if (isDark) {
        html.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        html.classList.add('dark');
        localStorage.theme = 'dark';
    }
}
</script>`;

  await fs.writeFile(
    path.join(includesDir, 'footer.html'),
    footer,
    'utf-8'
  );
  
  console.log('  Generated includes');
}

// Build with theme
async function buildWithTheme() {
  console.log('🚀 Starting build with theme support...\n');
  
  const config = await loadConfig();
  
  // Clean and prepare public directory
  console.log('Cleaning public directory...');
  await fs.rm(config.publicDir, { recursive: true, force: true });
  await fs.mkdir(config.publicDir, { recursive: true });
  
  // Create necessary directories
  await fs.mkdir(path.join(config.publicDir, 'assets', 'css'), { recursive: true });
  await fs.mkdir(path.join(config.publicDir, 'assets', 'js'), { recursive: true });
  await fs.mkdir(path.join(config.publicDir, 'assets', 'images'), { recursive: true });
  
  // Generate theme CSS
  const themeSystem = await generateThemeCSS(config);
  
  // Generate layouts with theme
  await generateHTMLLayout(config, themeSystem);
  
  // Generate includes
  await generateIncludes(config);
  
  // Copy content (simplified for demo)
  console.log('\nCopying content...');
  await copyContent(config);
  
  // Generate theme info page
  await generateThemeInfoPage(config, themeSystem);
  
  // Update Jekyll configuration
  await updateJekyllConfig(config);
  
  console.log('\n✅ Build completed with theme support!');
  console.log(`📁 Output directory: ${config.publicDir}`);
  console.log(`🎨 Active theme: ${config.theme}`);
}

// Copy content files
async function copyContent(config) {
  const enabledSections = config.contentSections.filter(s => s.enabled);
  
  for (const section of enabledSections) {
    const sectionSrc = path.join(config.srcDir, section.directory);
    const sectionDest = path.join(config.publicDir, section.directory);
    
    try {
      await copyDirectory(sectionSrc, sectionDest);
      console.log(`  Copied ${section.name} section`);
    } catch (error) {
      console.warn(`  Section ${section.name} not found`);
    }
  }
  
  // Copy root files
  const rootFiles = ['index.md', 'README.md'];
  for (const file of rootFiles) {
    try {
      await fs.copyFile(
        path.join(__dirname, '..', file),
        path.join(config.publicDir, file)
      );
    } catch (error) {
      // File not found
    }
  }
}

// Generate theme info page
async function generateThemeInfoPage(config, themeSystem) {
  const themeInfo = themeSystem.getThemeInfo(config.theme);
  
  const content = `---
layout: page
title: Theme Information
permalink: /theme-info/
---

# Current Theme: ${themeInfo.name}

${themeInfo.description}

## Theme Details

- **Author:** ${themeInfo.author || 'Unknown'}
- **Version:** ${themeInfo.version || '1.0.0'}
- **Base Theme:** ${config.theme}

## Color Palette

<div class="color-palette">
    <div class="color-item">
        <div class="color-box" style="background: var(--color-primary);"></div>
        <span>Primary</span>
    </div>
    <div class="color-item">
        <div class="color-box" style="background: var(--color-secondary);"></div>
        <span>Secondary</span>
    </div>
    <div class="color-item">
        <div class="color-box" style="background: var(--color-background);"></div>
        <span>Background</span>
    </div>
    <div class="color-item">
        <div class="color-box" style="background: var(--color-text);"></div>
        <span>Text</span>
    </div>
</div>

## Customization

To customize this theme, create a \`theme-custom.json\` file:

\`\`\`json
{
  "theme": "${config.theme}",
  "customizations": {
    "colors": {
      "primary": "#your-color"
    },
    "typography": {
      "fontFamily": "your-font"
    }
  }
}
\`\`\`

<style>
.color-palette {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin: 2rem 0;
}

.color-item {
    text-align: center;
}

.color-box {
    width: 100%;
    height: 100px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    margin-bottom: 0.5rem;
}
</style>`;

  await fs.writeFile(
    path.join(config.publicDir, 'theme-info.md'),
    content,
    'utf-8'
  );
  
  console.log('  Generated theme info page');
}

// Update Jekyll configuration
async function updateJekyllConfig(config) {
  const jekyllConfig = `# Book Publishing Template Configuration
title: ${config.title || 'My Book'}
author: ${config.author || 'Author Name'}
description: ${config.description || 'Book description'}

# Theme
theme: ${config.theme}

# Build settings
markdown: kramdown
permalink: pretty

# Navigation
navigation:
  - title: Home
    url: /
  - title: Table of Contents
    url: /toc/
  - title: Theme Info
    url: /theme-info/

# Exclude files
exclude:
  - node_modules
  - package.json
  - package-lock.json
  - scripts
  - src
  - '*.log'
`;

  await fs.writeFile(
    path.join(config.publicDir, '_config.yml'),
    jekyllConfig,
    'utf-8'
  );
  
  console.log('  Generated Jekyll configuration');
}

// Utility functions
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

function mergeDeep(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Run build
if (require.main === module) {
  buildWithTheme().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

module.exports = { buildWithTheme };