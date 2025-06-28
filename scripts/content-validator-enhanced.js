#!/usr/bin/env node

/**
 * Enhanced Content Validation System
 * Comprehensive validation for markdown content integrity
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const marked = require('marked');
const grayMatter = require('gray-matter');

class ContentValidator {
  constructor(options = {}) {
    this.options = {
      fix: options.fix || false,
      report: options.report || false,
      verbose: options.verbose || false,
      srcDir: options.srcDir || 'src',
      outputDir: options.outputDir || 'validation-reports',
      strict: options.strict || false
    };
    
    this.results = {
      errors: [],
      warnings: [],
      info: [],
      fixed: [],
      stats: {
        filesChecked: 0,
        markdownIssues: 0,
        linksChecked: 0,
        imagesChecked: 0,
        duplicateIds: 0,
        metadataIssues: 0,
        totalFixed: 0
      }
    };
    
    this.fileContents = new Map();
    this.idRegistry = new Map();
    this.anchorRegistry = new Map();
    this.linkRegistry = new Map();
    
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
  }

  log(level, message) {
    if (!this.options.verbose && level === 'info') return;
    
    const color = this.colors[level] || this.colors.reset;
    const icon = {
      error: '❌',
      warning: '⚠️ ',
      success: '✅',
      info: '🔔',
      fixed: '🔧'
    }[level] || '📄';
    
    console.log(`${color}${icon} ${message}${this.colors.reset}`);
  }

  addIssue(type, severity, file, line, message, suggestion = null, fixable = false) {
    const issue = {
      type,
      severity,
      file,
      line,
      message,
      suggestion,
      fixable,
      timestamp: new Date().toISOString()
    };
    
    if (severity === 'error') {
      this.results.errors.push(issue);
    } else if (severity === 'warning') {
      this.results.warnings.push(issue);
    } else {
      this.results.info.push(issue);
    }
    
    return issue;
  }

  async validateFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.fileContents.set(filePath, content);
      this.results.stats.filesChecked++;
      
      this.log('info', `Validating: ${path.relative(process.cwd(), filePath)}`);
      
      let modifiedContent = content;
      
      // Parse frontmatter and content
      const parsed = grayMatter(content);
      
      // Run all validations
      await this.validateMarkdownSyntax(filePath, parsed.content);
      await this.validateMetadata(filePath, parsed.data);
      await this.validateLinks(filePath, parsed.content);
      await this.validateImages(filePath, parsed.content);
      await this.validateAnchorsAndIds(filePath, parsed.content);
      await this.validateHeadingStructure(filePath, parsed.content);
      
      // Apply fixes if requested
      if (this.options.fix) {
        modifiedContent = await this.applyFixes(filePath, content, parsed);
        if (modifiedContent !== content) {
          await fs.writeFile(filePath, modifiedContent);
          this.results.stats.totalFixed++;
          this.log('fixed', `Fixed issues in: ${path.basename(filePath)}`);
        }
      }
      
    } catch (error) {
      this.addIssue(
        'system',
        'error',
        filePath,
        0,
        `Failed to process file: ${error.message}`
      );
    }
  }

  async validateMarkdownSyntax(filePath, content) {
    try {
      // Use marked to parse and check for syntax errors
      const tokens = marked.lexer(content);
      
      // Check for common markdown issues
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // Check for malformed links
        const malformedLink = /\[([^\]]*)\](?!\(|\[)/g;
        if (malformedLink.test(line)) {
          this.addIssue(
            'markdown',
            'error',
            filePath,
            lineNum,
            'Malformed link syntax - missing URL',
            'Add parentheses with URL: [text](url)',
            true
          );
          this.results.stats.markdownIssues++;
        }
        
        // Check for unclosed code blocks
        if (line.startsWith('```') && i === lines.length - 1) {
          this.addIssue(
            'markdown',
            'error',
            filePath,
            lineNum,
            'Unclosed code block',
            'Add closing ``` on a new line',
            true
          );
          this.results.stats.markdownIssues++;
        }
        
        // Check for improper emphasis
        const unbalancedEmphasis = /(^|[^*])\*([^*]+)(?!\*)/g;
        if (unbalancedEmphasis.test(line)) {
          this.addIssue(
            'markdown',
            'warning',
            filePath,
            lineNum,
            'Unbalanced emphasis markers',
            'Ensure * or ** are properly paired',
            true
          );
          this.results.stats.markdownIssues++;
        }
        
        // Check for hard tabs
        if (line.includes('\t')) {
          this.addIssue(
            'markdown',
            'warning',
            filePath,
            lineNum,
            'Hard tabs detected',
            'Replace tabs with spaces',
            true
          );
          this.results.stats.markdownIssues++;
        }
      }
      
    } catch (error) {
      this.addIssue(
        'markdown',
        'error',
        filePath,
        0,
        `Markdown parsing error: ${error.message}`,
        'Check markdown syntax for errors'
      );
      this.results.stats.markdownIssues++;
    }
  }

  async validateMetadata(filePath, metadata) {
    const requiredFields = ['title'];
    const recommendedFields = ['description', 'order', 'status'];
    
    // Check required fields
    for (const field of requiredFields) {
      if (!metadata[field]) {
        this.addIssue(
          'metadata',
          'error',
          filePath,
          1,
          `Missing required metadata field: ${field}`,
          `Add '${field}:' to frontmatter`,
          true
        );
        this.results.stats.metadataIssues++;
      }
    }
    
    // Check recommended fields
    for (const field of recommendedFields) {
      if (!metadata[field]) {
        this.addIssue(
          'metadata',
          'warning',
          filePath,
          1,
          `Missing recommended metadata field: ${field}`,
          `Consider adding '${field}:' to frontmatter`
        );
      }
    }
    
    // Validate metadata consistency
    if (metadata.order && typeof metadata.order !== 'number') {
      this.addIssue(
        'metadata',
        'error',
        filePath,
        1,
        `Invalid order value: ${metadata.order}`,
        'Order should be a number',
        true
      );
      this.results.stats.metadataIssues++;
    }
    
    if (metadata.status && !['draft', 'review', 'published'].includes(metadata.status)) {
      this.addIssue(
        'metadata',
        'warning',
        filePath,
        1,
        `Invalid status value: ${metadata.status}`,
        'Status should be: draft, review, or published'
      );
    }
  }

  async validateLinks(filePath, content) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const lines = content.split('\n');
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const linkText = match[1];
      const linkUrl = match[2];
      const lineNum = this.getLineNumber(content, match.index);
      
      this.results.stats.linksChecked++;
      
      // Track all links
      if (!this.linkRegistry.has(linkUrl)) {
        this.linkRegistry.set(linkUrl, []);
      }
      this.linkRegistry.get(linkUrl).push({ file: filePath, line: lineNum });
      
      // Check internal links
      if (this.isInternalLink(linkUrl)) {
        await this.validateInternalLink(filePath, lineNum, linkUrl, linkText);
      }
      
      // Check anchor links
      if (linkUrl.startsWith('#')) {
        this.validateAnchorLink(filePath, lineNum, linkUrl);
      }
      
      // Check for empty link text
      if (!linkText.trim()) {
        this.addIssue(
          'link',
          'warning',
          filePath,
          lineNum,
          'Empty link text',
          'Add descriptive link text',
          true
        );
      }
    }
  }

  async validateInternalLink(filePath, lineNum, linkUrl, linkText) {
    const currentDir = path.dirname(filePath);
    let targetPath = linkUrl.split('#')[0];
    
    if (targetPath.startsWith('/')) {
      targetPath = path.join(this.options.srcDir, targetPath.slice(1));
    } else {
      targetPath = path.resolve(currentDir, targetPath);
    }
    
    try {
      await fs.access(targetPath);
    } catch (error) {
      this.addIssue(
        'link',
        'error',
        filePath,
        lineNum,
        `Broken internal link: ${linkUrl}`,
        'Check if the file exists at the specified path',
        false
      );
    }
    
    // Check anchor in target file
    if (linkUrl.includes('#')) {
      const anchor = linkUrl.split('#')[1];
      // This will be validated after all files are processed
      this.anchorRegistry.set(`${targetPath}#${anchor}`, {
        source: filePath,
        line: lineNum
      });
    }
  }

  validateAnchorLink(filePath, lineNum, anchor) {
    // Store for later validation
    this.anchorRegistry.set(`${filePath}${anchor}`, {
      source: filePath,
      line: lineNum
    });
  }

  async validateImages(filePath, content) {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = imageRegex.exec(content)) !== null) {
      const altText = match[1];
      const imagePath = match[2];
      const lineNum = this.getLineNumber(content, match.index);
      
      this.results.stats.imagesChecked++;
      
      // Check for missing alt text
      if (!altText.trim()) {
        this.addIssue(
          'image',
          'warning',
          filePath,
          lineNum,
          'Missing alt text for image',
          'Add descriptive alt text for accessibility',
          true
        );
      }
      
      // Check internal images
      if (this.isInternalLink(imagePath)) {
        await this.validateInternalImage(filePath, lineNum, imagePath);
      }
    }
  }

  async validateInternalImage(filePath, lineNum, imagePath) {
    const currentDir = path.dirname(filePath);
    let targetPath;
    
    if (imagePath.startsWith('/')) {
      targetPath = path.join(process.cwd(), imagePath.slice(1));
    } else {
      targetPath = path.resolve(currentDir, imagePath);
    }
    
    try {
      await fs.access(targetPath);
    } catch (error) {
      this.addIssue(
        'image',
        'error',
        filePath,
        lineNum,
        `Missing image file: ${imagePath}`,
        'Check if the image exists at the specified path'
      );
    }
  }

  async validateAnchorsAndIds(filePath, content) {
    // Extract headings as potential anchors
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      const headingText = match[2];
      const lineNum = this.getLineNumber(content, match.index);
      const anchorId = this.generateAnchorId(headingText);
      
      // Check for duplicate IDs
      if (this.idRegistry.has(anchorId)) {
        const existing = this.idRegistry.get(anchorId);
        this.addIssue(
          'anchor',
          'error',
          filePath,
          lineNum,
          `Duplicate anchor ID: #${anchorId}`,
          `Already defined in ${existing.file}:${existing.line}`,
          false
        );
        this.results.stats.duplicateIds++;
      } else {
        this.idRegistry.set(anchorId, {
          file: filePath,
          line: lineNum,
          text: headingText
        });
      }
    }
    
    // Extract explicit anchor definitions
    const anchorRegex = /<a\s+(?:name|id)="([^"]+)"/g;
    while ((match = anchorRegex.exec(content)) !== null) {
      const anchorId = match[1];
      const lineNum = this.getLineNumber(content, match.index);
      
      if (this.idRegistry.has(anchorId)) {
        const existing = this.idRegistry.get(anchorId);
        this.addIssue(
          'anchor',
          'error',
          filePath,
          lineNum,
          `Duplicate anchor ID: ${anchorId}`,
          `Already defined in ${existing.file}:${existing.line}`,
          false
        );
        this.results.stats.duplicateIds++;
      } else {
        this.idRegistry.set(anchorId, {
          file: filePath,
          line: lineNum
        });
      }
    }
  }

  async validateHeadingStructure(filePath, content) {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2],
        line: this.getLineNumber(content, match.index)
      });
    }
    
    // Check heading hierarchy
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];
      
      // Check for skipped heading levels
      if (current.level > previous.level + 1) {
        this.addIssue(
          'heading',
          'warning',
          filePath,
          current.line,
          `Skipped heading level: h${previous.level} to h${current.level}`,
          'Use sequential heading levels',
          true
        );
      }
    }
    
    // Check for multiple h1
    const h1Count = headings.filter(h => h.level === 1).length;
    if (h1Count > 1) {
      this.addIssue(
        'heading',
        'warning',
        filePath,
        headings.find(h => h.level === 1).line,
        `Multiple h1 headings found (${h1Count})`,
        'Use only one h1 per document'
      );
    }
  }

  async applyFixes(filePath, content, parsed) {
    let modifiedContent = content;
    const fixes = this.results.errors.concat(this.results.warnings)
      .filter(issue => issue.file === filePath && issue.fixable);
    
    if (fixes.length === 0) return content;
    
    // Apply metadata fixes
    const metadataFixes = fixes.filter(f => f.type === 'metadata');
    if (metadataFixes.length > 0) {
      const newMetadata = { ...parsed.data };
      
      for (const fix of metadataFixes) {
        if (fix.message.includes('Missing required metadata field: title')) {
          newMetadata.title = path.basename(filePath, '.md')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
        }
        
        if (fix.message.includes('Invalid order value')) {
          newMetadata.order = parseInt(newMetadata.order) || 0;
        }
      }
      
      modifiedContent = grayMatter.stringify(parsed.content, newMetadata);
      this.results.fixed.push({ file: filePath, type: 'metadata', count: metadataFixes.length });
    }
    
    // Apply markdown fixes
    const markdownFixes = fixes.filter(f => f.type === 'markdown');
    if (markdownFixes.length > 0) {
      let lines = modifiedContent.split('\n');
      
      for (const fix of markdownFixes) {
        if (fix.message.includes('Hard tabs detected')) {
          lines[fix.line - 1] = lines[fix.line - 1].replace(/\t/g, '  ');
        }
        
        if (fix.message.includes('Malformed link syntax')) {
          lines[fix.line - 1] = lines[fix.line - 1].replace(
            /\[([^\]]*)\](?!\(|\[)/g,
            '[$1]()'
          );
        }
      }
      
      modifiedContent = lines.join('\n');
      this.results.fixed.push({ file: filePath, type: 'markdown', count: markdownFixes.length });
    }
    
    return modifiedContent;
  }

  async validateCrossReferences() {
    // Validate anchor references after all files are processed
    for (const [anchor, ref] of this.anchorRegistry.entries()) {
      if (!anchor.includes('#')) continue;
      
      const [file, id] = anchor.split('#');
      const targetFile = file || ref.source;
      
      if (!this.idRegistry.has(id)) {
        this.addIssue(
          'anchor',
          'error',
          ref.source,
          ref.line,
          `Broken anchor reference: #${id}`,
          `Anchor not found in ${targetFile}`
        );
      }
    }
  }

  generateAnchorId(text) {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  isInternalLink(url) {
    return !url.startsWith('http://') && 
           !url.startsWith('https://') && 
           !url.startsWith('mailto:') &&
           !url.startsWith('#');
  }

  async generateReport() {
    const reportDir = this.options.outputDir;
    await fs.mkdir(reportDir, { recursive: true });
    
    const timestamp = new Date().toISOString();
    const reportData = {
      timestamp,
      summary: {
        filesChecked: this.results.stats.filesChecked,
        totalIssues: this.results.errors.length + this.results.warnings.length,
        errors: this.results.errors.length,
        warnings: this.results.warnings.length,
        fixed: this.results.stats.totalFixed
      },
      stats: this.results.stats,
      errors: this.results.errors,
      warnings: this.results.warnings,
      fixed: this.results.fixed
    };
    
    // Generate JSON report
    const jsonPath = path.join(reportDir, 'validation-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(reportData, null, 2));
    this.log('success', `JSON report generated: ${jsonPath}`);
    
    // Generate HTML report
    const htmlPath = path.join(reportDir, 'validation-report.html');
    await fs.writeFile(htmlPath, this.generateHTMLReport(reportData));
    this.log('success', `HTML report generated: ${htmlPath}`);
    
    // Generate Markdown report
    const mdPath = path.join(reportDir, 'validation-report.md');
    await fs.writeFile(mdPath, this.generateMarkdownReport(reportData));
    this.log('success', `Markdown report generated: ${mdPath}`);
  }

  generateHTMLReport(data) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Content Validation Report - ${data.timestamp}</title>
    <style>
        body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-value { font-size: 36px; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #666; font-size: 14px; }
        .errors .stat-value { color: #dc3545; }
        .warnings .stat-value { color: #ffc107; }
        .success .stat-value { color: #28a745; }
        .issues { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .issue { margin: 20px 0; padding: 15px; border-left: 4px solid #dee2e6; background: #f8f9fa; }
        .issue.error { border-color: #dc3545; background: #f8d7da; }
        .issue.warning { border-color: #ffc107; background: #fff3cd; }
        .issue-header { font-weight: bold; margin-bottom: 5px; }
        .issue-file { color: #6c757d; font-size: 14px; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 5px; }
        .badge.error { background: #dc3545; color: white; }
        .badge.warning { background: #ffc107; color: #212529; }
        .suggestion { margin-top: 10px; padding: 10px; background: rgba(0,123,255,0.1); border-radius: 4px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Content Validation Report</h1>
            <p>Generated: ${new Date(data.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${data.summary.filesChecked}</div>
                <div class="stat-label">Files Checked</div>
            </div>
            <div class="stat ${data.summary.errors > 0 ? 'errors' : 'success'}">
                <div class="stat-value">${data.summary.errors}</div>
                <div class="stat-label">Errors</div>
            </div>
            <div class="stat ${data.summary.warnings > 0 ? 'warnings' : 'success'}">
                <div class="stat-value">${data.summary.warnings}</div>
                <div class="stat-label">Warnings</div>
            </div>
            <div class="stat">
                <div class="stat-value">${data.summary.fixed}</div>
                <div class="stat-label">Auto-Fixed</div>
            </div>
        </div>
        
        <div class="issues">
            ${data.errors.length > 0 ? `
            <h2>Errors (${data.errors.length})</h2>
            ${data.errors.map(issue => `
            <div class="issue error">
                <div class="issue-header">
                    <span class="badge error">${issue.type.toUpperCase()}</span>
                    ${issue.message}
                </div>
                <div class="issue-file">${issue.file}:${issue.line}</div>
                ${issue.suggestion ? `<div class="suggestion">💡 ${issue.suggestion}</div>` : ''}
            </div>
            `).join('')}
            ` : ''}
            
            ${data.warnings.length > 0 ? `
            <h2>Warnings (${data.warnings.length})</h2>
            ${data.warnings.map(issue => `
            <div class="issue warning">
                <div class="issue-header">
                    <span class="badge warning">${issue.type.toUpperCase()}</span>
                    ${issue.message}
                </div>
                <div class="issue-file">${issue.file}:${issue.line}</div>
                ${issue.suggestion ? `<div class="suggestion">💡 ${issue.suggestion}</div>` : ''}
            </div>
            `).join('')}
            ` : ''}
            
            ${data.errors.length === 0 && data.warnings.length === 0 ? '<h2>✅ All validation checks passed!</h2>' : ''}
        </div>
    </div>
</body>
</html>`;
  }

  generateMarkdownReport(data) {
    let report = `# Content Validation Report

`;
    report += `Generated: ${new Date(data.timestamp).toLocaleString()}\n\n`;
    
    report += `## Summary\n\n`;
    report += `- **Files Checked**: ${data.summary.filesChecked}\n`;
    report += `- **Errors**: ${data.summary.errors}\n`;
    report += `- **Warnings**: ${data.summary.warnings}\n`;
    report += `- **Auto-Fixed**: ${data.summary.fixed}\n\n`;
    
    report += `## Statistics\n\n`;
    report += `- Markdown Issues: ${data.stats.markdownIssues}\n`;
    report += `- Links Checked: ${data.stats.linksChecked}\n`;
    report += `- Images Checked: ${data.stats.imagesChecked}\n`;
    report += `- Duplicate IDs: ${data.stats.duplicateIds}\n`;
    report += `- Metadata Issues: ${data.stats.metadataIssues}\n\n`;
    
    if (data.errors.length > 0) {
      report += `## Errors\n\n`;
      data.errors.forEach(issue => {
        report += `### ${issue.type.toUpperCase()}: ${issue.message}\n`;
        report += `- **File**: ${issue.file}:${issue.line}\n`;
        if (issue.suggestion) {
          report += `- **Suggestion**: ${issue.suggestion}\n`;
        }
        report += `\n`;
      });
    }
    
    if (data.warnings.length > 0) {
      report += `## Warnings\n\n`;
      data.warnings.forEach(issue => {
        report += `### ${issue.type.toUpperCase()}: ${issue.message}\n`;
        report += `- **File**: ${issue.file}:${issue.line}\n`;
        if (issue.suggestion) {
          report += `- **Suggestion**: ${issue.suggestion}\n`;
        }
        report += `\n`;
      });
    }
    
    if (data.fixed.length > 0) {
      report += `## Fixed Issues\n\n`;
      data.fixed.forEach(fix => {
        report += `- **${fix.file}**: Fixed ${fix.count} ${fix.type} issues\n`;
      });
    }
    
    return report;
  }

  displaySummary() {
    console.log('\n' + '='.repeat(60));
    console.log(`${this.colors.cyan}📊 VALIDATION SUMMARY${this.colors.reset}`);
    console.log('='.repeat(60));
    
    console.log(`\nFiles checked: ${this.results.stats.filesChecked}`);
    console.log(`Total issues: ${this.results.errors.length + this.results.warnings.length}`);
    console.log(`${this.colors.red}Errors: ${this.results.errors.length}${this.colors.reset}`);
    console.log(`${this.colors.yellow}Warnings: ${this.results.warnings.length}${this.colors.reset}`);
    
    if (this.options.fix) {
      console.log(`${this.colors.green}Fixed: ${this.results.stats.totalFixed} files${this.colors.reset}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    fix: args.includes('--fix'),
    report: args.includes('--report'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    strict: args.includes('--strict')
  };
  
  const validator = new ContentValidator(options);
  
  console.log(`${validator.colors.blue}🔍 Starting enhanced content validation...${validator.colors.reset}\n`);
  
  try {
    // Find all markdown files
    const pattern = path.join(validator.options.srcDir, '**/*.md');
    const files = glob.sync(pattern, {
      ignore: ['node_modules/**', '.git/**', '**/*.draft.md', '**/*.private.md']
    });
    
    console.log(`Found ${files.length} markdown files to validate\n`);
    
    // Validate each file
    for (const file of files) {
      await validator.validateFile(file);
    }
    
    // Validate cross-references
    await validator.validateCrossReferences();
    
    // Generate report if requested
    if (options.report) {
      await validator.generateReport();
    }
    
    // Display summary
    validator.displaySummary();
    
    // Exit with appropriate code
    process.exit(validator.results.errors.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(`${validator.colors.red}❌ Validation failed: ${error.message}${validator.colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { ContentValidator };
