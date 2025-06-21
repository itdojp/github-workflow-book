#!/usr/bin/env node

/**
 * Content Validation Test Suite
 * Validates markdown content structure, links, and formatting
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const grayMatter = require('gray-matter');
const marked = require('marked');
const { runSafeguardCheck } = require('./content-safeguard');

class ContentValidator {
  constructor() {
    this.results = {
      structure: [],
      frontmatter: [],
      links: [],
      content: [],
      safeguard: null
    };
    this.errors = [];
    this.warnings = [];
  }

  async validateStructure(srcDir) {
    console.log('Validating content structure...');
    
    const requiredFiles = [
      'introduction/index.md',
      'chapters/chapter01/index.md',
      'afterword/index.md'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(srcDir, file);
      try {
        await fs.access(filePath);
        this.results.structure.push({ file, status: 'found' });
        console.log(`✅ Required file found: ${file}`);
      } catch (error) {
        this.results.structure.push({ file, status: 'missing' });
        this.errors.push(`Missing required file: ${file}`);
        console.log(`❌ Missing required file: ${file}`);
      }
    }
  }

  async validateFrontmatter(file) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const parsed = grayMatter(content);
      
      const requiredFields = ['title'];
      const missing = requiredFields.filter(field => !parsed.data[field]);
      
      if (missing.length > 0) {
        this.warnings.push(`${file}: Missing frontmatter fields: ${missing.join(', ')}`);
        this.results.frontmatter.push({ file, status: 'incomplete', missing });
      } else {
        this.results.frontmatter.push({ file, status: 'valid' });
      }
    } catch (error) {
      this.errors.push(`Error parsing frontmatter in ${file}: ${error.message}`);
      this.results.frontmatter.push({ file, status: 'error', error: error.message });
    }
  }

  async validateLinks(file) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const { content: markdownContent } = grayMatter(content);
      
      // Find all markdown links
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const links = [];
      let match;
      
      while ((match = linkRegex.exec(markdownContent)) !== null) {
        links.push({
          text: match[1],
          url: match[2],
          line: markdownContent.substring(0, match.index).split('\n').length
        });
      }
      
      // Validate relative links
      const brokenLinks = [];
      for (const link of links) {
        if (link.url.startsWith('./') || link.url.startsWith('../')) {
          const linkPath = path.resolve(path.dirname(file), link.url);
          try {
            await fs.access(linkPath);
          } catch (error) {
            brokenLinks.push(link);
          }
        }
      }
      
      this.results.links.push({
        file,
        totalLinks: links.length,
        brokenLinks: brokenLinks.length,
        broken: brokenLinks
      });
      
      if (brokenLinks.length > 0) {
        this.errors.push(`${file}: ${brokenLinks.length} broken links found`);
      }
      
    } catch (error) {
      this.errors.push(`Error validating links in ${file}: ${error.message}`);
    }
  }

  async validateContent(file) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const { content: markdownContent } = grayMatter(content);
      
      const issues = [];
      
      // Check for common markdown issues
      const lines = markdownContent.split('\n');
      lines.forEach((line, index) => {
        // Check for multiple consecutive blank lines
        if (index > 0 && lines[index - 1] === '' && line === '' && lines[index + 1] === '') {
          issues.push(`Line ${index + 1}: Multiple consecutive blank lines`);
        }
        
        // Check for trailing whitespace
        if (line.endsWith(' ') || line.endsWith('\t')) {
          issues.push(`Line ${index + 1}: Trailing whitespace`);
        }
        
        // Check for inconsistent heading levels
        if (line.startsWith('#')) {
          const level = line.match(/^#+/)[0].length;
          if (level > 3) {
            this.warnings.push(`${file}:${index + 1}: Deep heading level (h${level})`);
          }
        }
      });
      
      this.results.content.push({
        file,
        issues: issues.length,
        details: issues
      });
      
      if (issues.length > 0) {
        this.warnings.push(`${file}: ${issues.length} content issues found`);
      }
      
    } catch (error) {
      this.errors.push(`Error validating content in ${file}: ${error.message}`);
    }
  }

  async validateAllFiles(srcDir) {
    const mdFiles = glob.sync('**/*.md', {
      cwd: srcDir,
      absolute: true,
      ignore: ['node_modules/**', '.git/**', '**/*.draft.md', '**/*.private.md']
    });
    
    console.log(`Found ${mdFiles.length} markdown files to validate`);
    
    for (const file of mdFiles) {
      console.log(`Validating: ${path.relative(srcDir, file)}`);
      await this.validateFrontmatter(file);
      await this.validateLinks(file);
      await this.validateContent(file);
    }
  }

  async runSafeguardValidation(srcDir) {
    console.log('Running content safeguard validation...');
    try {
      const safeguardResult = await runSafeguardCheck(srcDir, { saveReport: false });
      this.results.safeguard = {
        hasViolations: safeguardResult.hasViolations,
        hasWarnings: safeguardResult.hasWarnings,
        summary: safeguardResult.analyzer.statistics
      };
      
      if (safeguardResult.hasViolations) {
        this.errors.push('Content safeguard violations detected');
      }
      if (safeguardResult.hasWarnings) {
        this.warnings.push('Content safeguard warnings detected');
      }
    } catch (error) {
      this.errors.push(`Safeguard validation error: ${error.message}`);
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        errors: this.errors.length,
        warnings: this.warnings.length,
        totalFiles: this.results.frontmatter.length
      },
      errors: this.errors,
      warnings: this.warnings,
      results: this.results
    };
    
    await fs.writeFile(
      'content-validation-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n=== Content Validation Summary ===');
    console.log(`Total files validated: ${report.summary.totalFiles}`);
    console.log(`Errors: ${report.summary.errors}`);
    console.log(`Warnings: ${report.summary.warnings}`);
    
    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach(error => console.log(`  ❌ ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\nWarnings:');
      this.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
    
    console.log('\nReport saved to: content-validation-report.json');
  }
}

// Main execution
async function main() {
  const validator = new ContentValidator();
  const srcDir = process.argv[2] || 'src';
  
  try {
    console.log(`Starting content validation for: ${srcDir}`);
    
    await validator.validateStructure(srcDir);
    await validator.validateAllFiles(srcDir);
    await validator.runSafeguardValidation(srcDir);
    await validator.generateReport();
    
    process.exit(validator.errors.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('Content validation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ContentValidator };
