#!/usr/bin/env node

/**
 * Theme Manager CLI
 * Manage themes for the book publishing template
 */

const fs = require('fs').promises;
const path = require('path');
const { ThemeSystem } = require('./theme-system');

// Available commands
const commands = {
  list: listThemes,
  info: showThemeInfo,
  set: setTheme,
  preview: previewTheme,
  create: createTheme,
  customize: customizeTheme,
  export: exportTheme
};

// Main CLI function
async function main() {
  const [command, ...args] = process.argv.slice(2);
  
  if (!command || command === 'help') {
    showHelp();
    return;
  }
  
  if (!commands[command]) {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
  
  try {
    await commands[command](...args);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Show help message
function showHelp() {
  console.log(`
🎨 Theme Manager for Book Publishing Template

Usage: npm run theme <command> [options]

Commands:
  list                    List all available themes
  info <theme>            Show detailed information about a theme
  set <theme>             Set the active theme
  preview <theme>         Generate preview of a theme
  create <name>           Create a new custom theme
  customize <theme>       Customize an existing theme
  export <theme>          Export theme CSS

Examples:
  npm run theme list
  npm run theme set modern
  npm run theme preview classic
  npm run theme create my-custom-theme
`);
}

// List all available themes
async function listThemes() {
  console.log('\n📋 Available Themes\n');
  
  const themeSystem = new ThemeSystem();
  await themeSystem.initialize();
  
  const themes = themeSystem.getAvailableThemes();
  const config = await loadConfig();
  const activeTheme = config.theme || 'modern';
  
  for (const themeName of themes) {
    const info = themeSystem.getThemeInfo(themeName);
    const isActive = themeName === activeTheme;
    const status = isActive ? '✅' : '  ';
    
    console.log(`${status} ${themeName} - ${info.description}`);
  }
  
  console.log(`\n📍 Active theme: ${activeTheme}\n`);
}

// Show theme information
async function showThemeInfo(themeName) {
  if (!themeName) {
    console.error('Please specify a theme name');
    return;
  }
  
  const themeSystem = new ThemeSystem();
  await themeSystem.initialize();
  
  const info = themeSystem.getThemeInfo(themeName);
  
  if (!info) {
    console.error(`Theme '${themeName}' not found`);
    return;
  }
  
  console.log(`\n🎨 Theme: ${info.name}\n`);
  console.log(`Description: ${info.description}`);
  console.log(`Author: ${info.author || 'Unknown'}`);
  console.log(`Version: ${info.version || '1.0.0'}`);
  
  if (info.options) {
    console.log('\nDefault Options:');
    console.log(JSON.stringify(info.options, null, 2));
  }
  
  console.log('');
}

// Set active theme
async function setTheme(themeName) {
  if (!themeName) {
    console.error('Please specify a theme name');
    return;
  }
  
  const themeSystem = new ThemeSystem();
  await themeSystem.initialize();
  
  // Verify theme exists
  const info = themeSystem.getThemeInfo(themeName);
  if (!info) {
    console.error(`Theme '${themeName}' not found`);
    console.log('\nAvailable themes:');
    const themes = themeSystem.getAvailableThemes();
    themes.forEach(t => console.log(`  - ${t}`));
    return;
  }
  
  // Update configuration
  const config = await loadConfig();
  config.theme = themeName;
  await saveConfig(config);
  
  // Generate theme CSS
  themeSystem.setActiveTheme(themeName);
  const cssPath = await themeSystem.saveTheme();
  
  console.log(`✅ Theme set to: ${themeName}`);
  console.log(`📄 CSS generated at: ${cssPath}`);
  
  // Update Jekyll config if needed
  await updateJekyllConfig(themeName);
}

// Preview theme
async function previewTheme(themeName) {
  if (!themeName) {
    console.error('Please specify a theme name');
    return;
  }
  
  console.log(`\n👁️  Generating preview for theme: ${themeName}\n`);
  
  const themeSystem = new ThemeSystem();
  await themeSystem.initialize();
  
  // Set theme temporarily
  themeSystem.setActiveTheme(themeName);
  
  // Generate preview HTML
  const previewHTML = await generatePreviewHTML(themeName, themeSystem);
  const previewPath = path.join(__dirname, '..', 'theme-preview.html');
  
  await fs.writeFile(previewPath, previewHTML, 'utf-8');
  
  console.log(`✅ Preview generated: ${previewPath}`);
  console.log('\nOpen the file in your browser to see the theme preview.');
  
  // Try to open in browser
  const { exec } = require('child_process');
  const command = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';
  
  exec(`${command} "${previewPath}"`);
}

// Create new theme
async function createTheme(themeName) {
  if (!themeName) {
    console.error('Please specify a theme name');
    return;
  }
  
  const themesDir = path.join(__dirname, '..', 'themes');
  await fs.mkdir(themesDir, { recursive: true });
  
  const themeFile = path.join(themesDir, `${themeName}.js`);
  
  // Check if already exists
  try {
    await fs.access(themeFile);
    console.error(`Theme '${themeName}' already exists`);
    return;
  } catch (error) {
    // File doesn't exist, continue
  }
  
  // Create theme template
  const template = `/**
 * ${themeName} Theme
 * Custom theme for book publishing
 */

const { BaseTheme } = require('../scripts/theme-system');

class ${toPascalCase(themeName)}Theme extends BaseTheme {
  constructor() {
    super();
    this.name = '${themeName}';
    this.description = 'Custom theme description';
    this.author = 'Your name';
    this.version = '1.0.0';
    
    this.defaultOptions = {
      colors: {
        primary: '#007bff',
        secondary: '#6c757d',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#212529',
        textSecondary: '#6c757d',
        border: '#dee2e6',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
      },
      typography: {
        fontFamily: 'sans-serif',
        baseFontSize: '16px',
        lineHeight: '1.6',
        headingFontFamily: 'inherit',
        codeFontFamily: 'monospace'
      },
      layout: {
        maxWidth: '800px',
        sidebarWidth: '250px',
        headerHeight: '60px'
      }
    };
  }

  async generate(options) {
    const { colors, typography, layout } = options;
    
    return \`
/* ${themeName} Theme */
\${this.generateColorScheme(colors)}

\${this.generateTypography(typography)}

/* Custom styles */
.container {
  max-width: \${layout.maxWidth};
  margin: 0 auto;
  padding: 1rem;
}

/* Add your custom styles here */

\`;
  }

  async generateDarkMode(options) {
    return \`
/* Dark mode overrides */
:root {
  --color-background: #1a1a1a;
  --color-surface: #2a2a2a;
  --color-text: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-border: #3a3a3a;
}
\`;
  }

  async generateResponsive(options) {
    return \`
/* Responsive styles */
@media (max-width: 768px) {
  .container {
    padding: 0.5rem;
  }
}
\`;
  }
}

module.exports = ${toPascalCase(themeName)}Theme;
`;
  
  await fs.writeFile(themeFile, template, 'utf-8');
  
  console.log(`\n✅ Theme created: ${themeFile}`);
  console.log('\nNext steps:');
  console.log(`1. Edit the theme file to customize styles`);
  console.log(`2. Set the theme: npm run theme set ${themeName}`);
  console.log(`3. Preview: npm run theme preview ${themeName}`);
}

// Customize existing theme
async function customizeTheme(themeName) {
  if (!themeName) {
    console.error('Please specify a theme name');
    return;
  }
  
  console.log(`\n🎨 Customizing theme: ${themeName}\n`);
  
  // Create custom theme config
  const customConfigPath = path.join(__dirname, '..', 'theme-custom.json');
  
  try {
    const existing = await fs.readFile(customConfigPath, 'utf-8');
    const customConfig = JSON.parse(existing);
    
    console.log('Current customizations:');
    console.log(JSON.stringify(customConfig, null, 2));
  } catch (error) {
    // No existing customization
  }
  
  // Interactive customization would go here
  console.log('\nEdit theme-custom.json to customize:');
  console.log('- colors: Primary, secondary, background, etc.');
  console.log('- typography: Font family, sizes, line height');
  console.log('- layout: Max width, spacing, etc.');
  
  // Create example customization file
  const exampleConfig = {
    theme: themeName,
    customizations: {
      colors: {
        primary: '#your-color',
        background: '#your-bg-color'
      },
      typography: {
        fontFamily: '"Your Font", sans-serif',
        baseFontSize: '18px'
      }
    }
  };
  
  await fs.writeFile(customConfigPath, JSON.stringify(exampleConfig, null, 2), 'utf-8');
  console.log(`\n📄 Customization file created: ${customConfigPath}`);
}

// Export theme CSS
async function exportTheme(themeName, outputPath) {
  if (!themeName) {
    console.error('Please specify a theme name');
    return;
  }
  
  const themeSystem = new ThemeSystem();
  await themeSystem.initialize();
  
  themeSystem.setActiveTheme(themeName);
  const css = await themeSystem.generateCSS();
  
  const filename = outputPath || `${themeName}-theme.css`;
  await fs.writeFile(filename, css, 'utf-8');
  
  console.log(`✅ Theme CSS exported to: ${filename}`);
}

// Generate preview HTML
async function generatePreviewHTML(themeName, themeSystem) {
  const css = await themeSystem.generateCSS();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Theme Preview: ${themeName}</title>
    <style>
${css}

/* Preview specific styles */
body {
  margin: 0;
  padding: 2rem;
}

.preview-section {
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--color-border);
}

.color-swatches {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin: 1rem 0;
}

.color-swatch {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
    </style>
</head>
<body>
    <div class="container">
        <h1>Theme Preview: ${themeName}</h1>
        
        <div class="preview-section">
            <h2>Color Palette</h2>
            <div class="color-swatches">
                <div class="color-swatch" style="background: var(--color-primary); color: white;">Primary</div>
                <div class="color-swatch" style="background: var(--color-secondary); color: white;">Secondary</div>
                <div class="color-swatch" style="background: var(--color-background);">Background</div>
                <div class="color-swatch" style="background: var(--color-surface);">Surface</div>
                <div class="color-swatch" style="background: var(--color-text); color: var(--color-background);">Text</div>
                <div class="color-swatch" style="background: var(--color-border);">Border</div>
            </div>
        </div>
        
        <div class="preview-section">
            <h2>Typography</h2>
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
            <h3>Heading 3</h3>
            <h4>Heading 4</h4>
            <h5>Heading 5</h5>
            <h6>Heading 6</h6>
            
            <p>This is a paragraph with <strong>bold text</strong>, <em>italic text</em>, and <a href="#">a link</a>. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            
            <blockquote>
                "This is a blockquote. It should be styled distinctively to stand out from regular text."
            </blockquote>
        </div>
        
        <div class="preview-section">
            <h2>Components</h2>
            
            <div class="card">
                <h3>Card Component</h3>
                <p>This is a card with some content inside.</p>
                <a href="#" class="button">Button</a>
            </div>
            
            <h3>Code Blocks</h3>
            <pre><code>// JavaScript example
function greet(name) {
    console.log(\`Hello, \${name}!\`);
}

greet('World');</code></pre>
            
            <h3>Tables</h3>
            <table>
                <thead>
                    <tr>
                        <th>Feature</th>
                        <th>Status</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Color Scheme</td>
                        <td>✅ Complete</td>
                        <td>Customizable via CSS variables</td>
                    </tr>
                    <tr>
                        <td>Typography</td>
                        <td>✅ Complete</td>
                        <td>Responsive font sizes</td>
                    </tr>
                    <tr>
                        <td>Dark Mode</td>
                        <td>🚧 Optional</td>
                        <td>Available for supported themes</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="preview-section">
            <h2>Lists</h2>
            
            <h3>Unordered List</h3>
            <ul>
                <li>First item</li>
                <li>Second item with <code>inline code</code></li>
                <li>Third item
                    <ul>
                        <li>Nested item 1</li>
                        <li>Nested item 2</li>
                    </ul>
                </li>
            </ul>
            
            <h3>Ordered List</h3>
            <ol>
                <li>Step one</li>
                <li>Step two</li>
                <li>Step three</li>
            </ol>
        </div>
    </div>
</body>
</html>`;
}

// Helper functions
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

async function saveConfig(config) {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(configPath, content, 'utf-8');
}

async function updateJekyllConfig(themeName) {
  const jekyllConfigPath = path.join(__dirname, '..', '_config.yml');
  
  try {
    let content = await fs.readFile(jekyllConfigPath, 'utf-8');
    
    // Update or add theme setting
    if (content.includes('theme:')) {
      content = content.replace(/theme:\s*.+/, `theme: ${themeName}`);
    } else {
      content += `\n# Theme\ntheme: ${themeName}\n`;
    }
    
    await fs.writeFile(jekyllConfigPath, content, 'utf-8');
    console.log('📝 Updated _config.yml');
  } catch (error) {
    // Jekyll config not found
  }
}

function toPascalCase(str) {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// Run CLI
if (require.main === module) {
  main();
}

module.exports = {
  listThemes,
  showThemeInfo,
  setTheme,
  previewTheme,
  createTheme,
  customizeTheme,
  exportTheme
};