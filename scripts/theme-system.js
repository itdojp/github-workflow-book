/**
 * Theme System for Book Publishing Template
 * Provides customizable themes for book appearance
 */

const fs = require('fs').promises;
const path = require('path');

class ThemeSystem {
  constructor() {
    this.themes = new Map();
    this.activeTheme = null;
    this.customThemes = new Map();
  }

  /**
   * Initialize theme system with configuration
   */
  async initialize(config = {}) {
    this.config = {
      themesDir: path.join(__dirname, '..', 'themes'),
      outputDir: path.join(__dirname, '..', 'public', 'assets', 'css'),
      defaultTheme: 'modern',
      enableDarkMode: true,
      customProperties: true,
      ...config
    };

    // Load built-in themes
    await this.loadBuiltInThemes();

    // Load custom themes
    if (config.customThemesDir) {
      await this.loadCustomThemes(config.customThemesDir);
    }

    // Set active theme
    this.setActiveTheme(config.theme || this.config.defaultTheme);
  }

  /**
   * Load built-in themes
   */
  async loadBuiltInThemes() {
    const builtInThemes = {
      modern: new ModernTheme(),
      classic: new ClassicTheme(),
      minimal: new MinimalTheme(),
      academic: new AcademicTheme(),
      magazine: new MagazineTheme()
    };

    for (const [name, theme] of Object.entries(builtInThemes)) {
      this.registerTheme(name, theme);
    }
  }

  /**
   * Load custom themes from directory
   */
  async loadCustomThemes(themesDir) {
    try {
      const files = await fs.readdir(themesDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          const themePath = path.join(themesDir, file);
          const ThemeClass = require(themePath);
          const theme = new ThemeClass();
          const themeName = path.basename(file, '.js');
          
          this.registerTheme(themeName, theme);
          this.customThemes.set(themeName, theme);
        }
      }
    } catch (error) {
      console.warn(`Failed to load custom themes: ${error.message}`);
    }
  }

  /**
   * Register a theme
   */
  registerTheme(name, theme) {
    if (!theme.name || !theme.generate) {
      throw new Error(`Invalid theme structure for '${name}'`);
    }
    
    this.themes.set(name, theme);
    console.log(`✅ Registered theme: ${name}`);
  }

  /**
   * Set active theme
   */
  setActiveTheme(name) {
    const theme = this.themes.get(name);
    
    if (!theme) {
      throw new Error(`Theme '${name}' not found`);
    }
    
    this.activeTheme = theme;
    return theme;
  }

  /**
   * Generate CSS for active theme
   */
  async generateCSS(options = {}) {
    if (!this.activeTheme) {
      throw new Error('No active theme set');
    }

    const themeOptions = {
      ...this.activeTheme.defaultOptions,
      ...options
    };

    // Generate base CSS
    let css = await this.activeTheme.generate(themeOptions);

    // Add dark mode if enabled
    if (this.config.enableDarkMode && this.activeTheme.generateDarkMode) {
      const darkCSS = await this.activeTheme.generateDarkMode(themeOptions);
      css += '\n\n' + this.wrapInDarkMode(darkCSS);
    }

    // Add responsive styles
    if (this.activeTheme.generateResponsive) {
      const responsiveCSS = await this.activeTheme.generateResponsive(themeOptions);
      css += '\n\n' + responsiveCSS;
    }

    return css;
  }

  /**
   * Wrap CSS in dark mode media query
   */
  wrapInDarkMode(css) {
    return `@media (prefers-color-scheme: dark) {\n${this.indentCSS(css)}\n}`;
  }

  /**
   * Indent CSS content
   */
  indentCSS(css) {
    return css.split('\n').map(line => '  ' + line).join('\n');
  }

  /**
   * Save theme CSS to file
   */
  async saveTheme(filename = 'theme.css') {
    const css = await this.generateCSS();
    const outputPath = path.join(this.config.outputDir, filename);
    
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });
    
    // Write CSS file
    await fs.writeFile(outputPath, css, 'utf-8');
    
    console.log(`📄 Theme CSS saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * Get all available themes
   */
  getAvailableThemes() {
    return Array.from(this.themes.keys());
  }

  /**
   * Get theme information
   */
  getThemeInfo(name) {
    const theme = this.themes.get(name);
    
    if (!theme) {
      return null;
    }
    
    return {
      name: theme.name,
      description: theme.description,
      author: theme.author,
      version: theme.version,
      options: theme.defaultOptions
    };
  }
}

/**
 * Base Theme Class
 */
class BaseTheme {
  constructor() {
    this.name = 'Base Theme';
    this.description = 'Base theme class';
    this.author = 'Book Publishing Template';
    this.version = '1.0.0';
    this.defaultOptions = {};
  }

  /**
   * Generate theme CSS
   */
  async generate(options) {
    throw new Error('Generate method must be implemented by theme');
  }

  /**
   * Generate CSS variables
   */
  generateCSSVariables(variables) {
    const lines = [':root {'];
    
    for (const [key, value] of Object.entries(variables)) {
      lines.push(`  --${key}: ${value};`);
    }
    
    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generate color scheme
   */
  generateColorScheme(colors) {
    return this.generateCSSVariables({
      'color-primary': colors.primary,
      'color-secondary': colors.secondary,
      'color-background': colors.background,
      'color-surface': colors.surface,
      'color-text': colors.text,
      'color-text-secondary': colors.textSecondary,
      'color-border': colors.border,
      'color-success': colors.success,
      'color-warning': colors.warning,
      'color-error': colors.error
    });
  }

  /**
   * Generate typography styles
   */
  generateTypography(typography) {
    return `
/* Typography */
body {
  font-family: ${typography.fontFamily};
  font-size: ${typography.baseFontSize};
  line-height: ${typography.lineHeight};
  color: var(--color-text);
}

h1, h2, h3, h4, h5, h6 {
  font-family: ${typography.headingFontFamily || typography.fontFamily};
  font-weight: ${typography.headingWeight || '700'};
  line-height: ${typography.headingLineHeight || '1.2'};
  margin-top: ${typography.headingMarginTop || '2rem'};
  margin-bottom: ${typography.headingMarginBottom || '1rem'};
}

h1 { font-size: ${typography.h1Size || '2.5rem'}; }
h2 { font-size: ${typography.h2Size || '2rem'}; }
h3 { font-size: ${typography.h3Size || '1.5rem'}; }
h4 { font-size: ${typography.h4Size || '1.25rem'}; }
h5 { font-size: ${typography.h5Size || '1.1rem'}; }
h6 { font-size: ${typography.h6Size || '1rem'}; }

p {
  margin-bottom: ${typography.paragraphSpacing || '1rem'};
}

code {
  font-family: ${typography.codeFontFamily || 'monospace'};
  font-size: ${typography.codeFontSize || '0.875em'};
}
`;
  }
}

/**
 * Modern Theme
 */
class ModernTheme extends BaseTheme {
  constructor() {
    super();
    this.name = 'Modern';
    this.description = 'Clean, contemporary design with focus on readability';
    
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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        baseFontSize: '16px',
        lineHeight: '1.6',
        headingFontFamily: 'inherit',
        codeFontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
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
    
    return `
/* Modern Theme */
${this.generateColorScheme(colors)}

${this.generateTypography(typography)}

/* Layout */
.container {
  max-width: ${layout.maxWidth};
  margin: 0 auto;
  padding: 0 1rem;
}

/* Header */
header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  height: ${layout.headerHeight};
  position: sticky;
  top: 0;
  z-index: 100;
}

/* Main Content */
main {
  min-height: calc(100vh - ${layout.headerHeight});
  padding: 2rem 0;
}

/* Components */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.button {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  text-decoration: none;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.button:hover {
  background: color-mix(in srgb, var(--color-primary) 85%, black);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Code Blocks */
pre {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
}

/* Blockquotes */
blockquote {
  border-left: 4px solid var(--color-primary);
  padding-left: 1rem;
  margin-left: 0;
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

th {
  background: var(--color-surface);
  font-weight: 600;
}
`;
  }

  async generateDarkMode(options) {
    return `
:root {
  --color-primary: #0d6efd;
  --color-secondary: #6c757d;
  --color-background: #121212;
  --color-surface: #1e1e1e;
  --color-text: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-border: #2d2d2d;
  --color-success: #198754;
  --color-warning: #ffc107;
  --color-error: #dc3545;
}

body {
  background: var(--color-background);
}

pre {
  background: #0d1117;
  border-color: #30363d;
}
`;
  }

  async generateResponsive(options) {
    return `
/* Tablet */
@media (max-width: 768px) {
  body {
    font-size: 15px;
  }
  
  .container {
    padding: 0 0.75rem;
  }
  
  h1 { font-size: 2rem; }
  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.25rem; }
}

/* Mobile */
@media (max-width: 480px) {
  body {
    font-size: 14px;
  }
  
  .container {
    padding: 0 0.5rem;
  }
  
  main {
    padding: 1rem 0;
  }
  
  .card {
    padding: 1rem;
  }
}
`;
  }
}

/**
 * Classic Theme
 */
class ClassicTheme extends BaseTheme {
  constructor() {
    super();
    this.name = 'Classic';
    this.description = 'Traditional book design with serif fonts';
    
    this.defaultOptions = {
      colors: {
        primary: '#8b4513',
        secondary: '#d2691e',
        background: '#fdf6e3',
        surface: '#fffbf0',
        text: '#2e2e2e',
        textSecondary: '#5a5a5a',
        border: '#e6d7c3',
        success: '#228b22',
        warning: '#ff8c00',
        error: '#dc143c'
      },
      typography: {
        fontFamily: 'Georgia, "Times New Roman", Times, serif',
        baseFontSize: '18px',
        lineHeight: '1.8',
        headingFontFamily: '"Playfair Display", Georgia, serif',
        codeFontFamily: '"Courier New", Courier, monospace'
      },
      layout: {
        maxWidth: '700px',
        sidebarWidth: '200px',
        headerHeight: '80px'
      }
    };
  }

  async generate(options) {
    const { colors, typography, layout } = options;
    
    return `
/* Classic Theme */
${this.generateColorScheme(colors)}

${this.generateTypography(typography)}

/* Classic styling */
body {
  background: var(--color-background);
  text-rendering: optimizeLegibility;
}

/* Ornamental elements */
h1 {
  text-align: center;
  position: relative;
  padding-bottom: 1rem;
}

h1::after {
  content: '❦';
  display: block;
  text-align: center;
  font-size: 1rem;
  color: var(--color-primary);
  margin-top: 0.5rem;
}

/* Drop caps */
.chapter > p:first-of-type::first-letter {
  float: left;
  font-size: 4em;
  line-height: 0.8;
  margin: 0.1em 0.1em 0 0;
  color: var(--color-primary);
  font-weight: bold;
}

/* Classic blockquote */
blockquote {
  font-style: italic;
  position: relative;
  padding: 1rem 2rem;
  quotes: '"' '"';
}

blockquote::before {
  content: open-quote;
  font-size: 3em;
  position: absolute;
  left: 0;
  top: -0.25em;
  color: var(--color-primary);
  opacity: 0.5;
}

/* Page-like appearance */
.page {
  background: var(--color-surface);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  padding: 3rem;
  margin: 2rem auto;
  max-width: ${layout.maxWidth};
}

/* Classic header */
header {
  text-align: center;
  padding: 2rem 0;
  border-bottom: 2px solid var(--color-primary);
  margin-bottom: 2rem;
}

/* Footer with page numbers */
footer {
  text-align: center;
  padding: 2rem 0;
  font-style: italic;
  color: var(--color-text-secondary);
}
`;
  }
}

/**
 * Minimal Theme
 */
class MinimalTheme extends BaseTheme {
  constructor() {
    super();
    this.name = 'Minimal';
    this.description = 'Clean, distraction-free reading experience';
    
    this.defaultOptions = {
      colors: {
        primary: '#000000',
        secondary: '#666666',
        background: '#ffffff',
        surface: '#ffffff',
        text: '#000000',
        textSecondary: '#666666',
        border: '#e0e0e0',
        success: '#00a86b',
        warning: '#ff9800',
        error: '#f44336'
      },
      typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        baseFontSize: '18px',
        lineHeight: '1.75',
        headingFontFamily: 'inherit',
        codeFontFamily: 'monospace'
      },
      layout: {
        maxWidth: '650px',
        sidebarWidth: '0',
        headerHeight: '0'
      }
    };
  }

  async generate(options) {
    const { colors, typography, layout } = options;
    
    return `
/* Minimal Theme */
${this.generateColorScheme(colors)}

${this.generateTypography(typography)}

/* Reset and minimal styling */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: var(--color-background);
  color: var(--color-text);
  padding: 2rem;
}

/* Content container */
.content {
  max-width: ${layout.maxWidth};
  margin: 0 auto;
}

/* Minimal headings */
h1, h2, h3, h4, h5, h6 {
  font-weight: 400;
  letter-spacing: -0.02em;
}

h1 {
  font-size: 2rem;
  margin: 3rem 0 1rem;
}

h2 {
  font-size: 1.5rem;
  margin: 2.5rem 0 1rem;
}

/* Links */
a {
  color: var(--color-text);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

a:hover {
  text-decoration-thickness: 2px;
}

/* Minimal code blocks */
pre {
  padding: 1rem;
  margin: 1rem 0;
  overflow-x: auto;
  border-left: 2px solid var(--color-border);
}

code {
  padding: 0.125rem 0.25rem;
  background: var(--color-surface);
}

/* Simple blockquote */
blockquote {
  padding-left: 1rem;
  border-left: 2px solid var(--color-border);
  margin: 1rem 0;
}

/* Clean tables */
table {
  width: 100%;
  margin: 1rem 0;
}

th, td {
  text-align: left;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

th {
  font-weight: 600;
}

/* Remove all decorative elements */
hr {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 2rem 0;
}
`;
  }
}

/**
 * Academic Theme
 */
class AcademicTheme extends BaseTheme {
  constructor() {
    super();
    this.name = 'Academic';
    this.description = 'Formal design suitable for academic papers';
    
    this.defaultOptions = {
      colors: {
        primary: '#1a237e',
        secondary: '#3f51b5',
        background: '#ffffff',
        surface: '#f5f5f5',
        text: '#000000',
        textSecondary: '#424242',
        border: '#bdbdbd',
        success: '#4caf50',
        warning: '#ff9800',
        error: '#f44336'
      },
      typography: {
        fontFamily: '"Times New Roman", Times, serif',
        baseFontSize: '12pt',
        lineHeight: '2',
        headingFontFamily: 'Arial, Helvetica, sans-serif',
        codeFontFamily: '"Courier New", Courier, monospace'
      },
      layout: {
        maxWidth: '8.5in',
        sidebarWidth: '0',
        headerHeight: '0',
        margins: '1in'
      }
    };
  }

  async generate(options) {
    const { colors, typography, layout } = options;
    
    return `
/* Academic Theme */
${this.generateColorScheme(colors)}

/* Paper-like layout */
@page {
  size: letter;
  margin: ${layout.margins};
}

body {
  font-family: ${typography.fontFamily};
  font-size: ${typography.baseFontSize};
  line-height: ${typography.lineHeight};
  color: var(--color-text);
  text-align: justify;
  hyphens: auto;
}

/* Document container */
.document {
  max-width: ${layout.maxWidth};
  margin: 0 auto;
  padding: ${layout.margins};
  background: white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

/* Academic headings */
h1, h2, h3, h4, h5, h6 {
  font-family: ${typography.headingFontFamily};
  font-weight: bold;
  text-align: left;
  margin: 1em 0 0.5em;
}

h1 {
  font-size: 14pt;
  text-transform: uppercase;
  text-align: center;
}

h2 {
  font-size: 12pt;
  text-transform: uppercase;
}

h3 {
  font-size: 12pt;
  font-style: italic;
}

/* Abstract */
.abstract {
  margin: 2em 4em;
  font-size: 10pt;
  text-align: justify;
}

.abstract h2 {
  text-align: center;
  font-size: 12pt;
  font-weight: bold;
  margin-bottom: 0.5em;
}

/* Citations */
.citation {
  vertical-align: super;
  font-size: 0.8em;
  text-decoration: none;
}

/* References */
.references {
  font-size: 10pt;
  line-height: 1.5;
}

.references li {
  margin-bottom: 0.5em;
  text-indent: -2em;
  padding-left: 2em;
}

/* Figures and tables */
figure {
  margin: 1em 0;
  text-align: center;
}

figcaption {
  font-size: 10pt;
  margin-top: 0.5em;
}

table {
  margin: 1em auto;
  border-collapse: collapse;
  font-size: 10pt;
}

th, td {
  padding: 0.5em;
  border: 1px solid var(--color-border);
}

th {
  background: var(--color-surface);
  font-weight: bold;
}

/* Footnotes */
.footnote {
  font-size: 9pt;
  line-height: 1.5;
  border-top: 1px solid var(--color-border);
  padding-top: 1em;
  margin-top: 2em;
}

/* Page numbers */
@media print {
  .page-number {
    position: fixed;
    bottom: 0.5in;
    right: 0.5in;
    font-size: 10pt;
  }
}
`;
  }
}

/**
 * Magazine Theme
 */
class MagazineTheme extends BaseTheme {
  constructor() {
    super();
    this.name = 'Magazine';
    this.description = 'Dynamic magazine-style layout';
    
    this.defaultOptions = {
      colors: {
        primary: '#e91e63',
        secondary: '#9c27b0',
        background: '#fafafa',
        surface: '#ffffff',
        text: '#212121',
        textSecondary: '#757575',
        border: '#e0e0e0',
        success: '#4caf50',
        warning: '#ff9800',
        error: '#f44336'
      },
      typography: {
        fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',
        baseFontSize: '16px',
        lineHeight: '1.6',
        headingFontFamily: '"Roboto Slab", Georgia, serif',
        codeFontFamily: '"Roboto Mono", monospace'
      },
      layout: {
        maxWidth: '1200px',
        sidebarWidth: '300px',
        headerHeight: '80px',
        gridGap: '2rem'
      }
    };
  }

  async generate(options) {
    const { colors, typography, layout } = options;
    
    return `
/* Magazine Theme */
${this.generateColorScheme(colors)}

${this.generateTypography(typography)}

/* Magazine layout */
body {
  background: var(--color-background);
}

.magazine-container {
  max-width: ${layout.maxWidth};
  margin: 0 auto;
  padding: 2rem;
}

/* Hero section */
.hero {
  position: relative;
  height: 60vh;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: white;
  text-align: center;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 3.5rem;
  font-weight: 900;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  margin: 0;
}

/* Grid layout */
.magazine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${layout.gridGap};
  margin-bottom: 3rem;
}

/* Article cards */
.article-card {
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.article-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
}

.article-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.article-card-content {
  padding: 1.5rem;
}

.article-card h2 {
  font-size: 1.5rem;
  margin: 0 0 0.5rem;
  color: var(--color-primary);
}

.article-card .meta {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: 1rem;
}

/* Pull quotes */
.pull-quote {
  font-size: 1.5rem;
  font-weight: 300;
  font-style: italic;
  color: var(--color-primary);
  border-left: 4px solid var(--color-primary);
  padding-left: 1.5rem;
  margin: 2rem 0;
}

/* Feature box */
.feature-box {
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: 8px;
  padding: 2rem;
  margin: 2rem 0;
  position: relative;
}

.feature-box::before {
  content: 'FEATURE';
  position: absolute;
  top: -12px;
  left: 20px;
  background: var(--color-primary);
  color: white;
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
  font-weight: bold;
  letter-spacing: 1px;
}

/* Sidebar */
.sidebar {
  background: var(--color-surface);
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sidebar h3 {
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

/* Responsive columns */
@media (min-width: 768px) {
  .two-column {
    column-count: 2;
    column-gap: 2rem;
  }
  
  .three-column {
    column-count: 3;
    column-gap: 2rem;
  }
}
`;
  }
}

// Export theme system and themes
module.exports = {
  ThemeSystem,
  BaseTheme,
  ModernTheme,
  ClassicTheme,
  MinimalTheme,
  AcademicTheme,
  MagazineTheme
};