#!/usr/bin/env node

/**
 * Accessibility Testing Suite
 * Tests HTML output for accessibility compliance using axe-core
 */

const fs = require('fs').promises;
const path = require('path');

class AccessibilityTester {
  constructor(dependencies = {}) {
    this.puppeteer = dependencies.puppeteer || require('puppeteer');
    this.AxePuppeteer = dependencies.AxePuppeteer || require('@axe-core/puppeteer').AxePuppeteer;
    this.glob = dependencies.glob || require('glob');
    this.results = {
      passed: [],
      failed: [],
      violations: []
    };
    this.browser = null;
  }

  async init() {
    this.browser = await this.puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async testFile(filePath) {
    const page = await this.browser.newPage();
    
    try {
      await page.goto(`file://${path.resolve(filePath)}`);
      
      const results = await new this.AxePuppeteer(page)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      
      if (results.violations.length === 0) {
        this.results.passed.push(filePath);
        console.log(`✅ ${filePath} - No accessibility issues`);
      } else {
        this.results.failed.push(filePath);
        this.results.violations.push({
          file: filePath,
          violations: results.violations
        });
        console.log(`❌ ${filePath} - ${results.violations.length} issues found`);
        
        // Log details of violations
        results.violations.forEach(violation => {
          console.log(`   ⚠️  ${violation.id}: ${violation.description}`);
          console.log(`       Impact: ${violation.impact}`);
          console.log(`       Nodes: ${violation.nodes.length}`);
        });
      }
    } catch (error) {
      console.error(`❌ Error testing ${filePath}: ${error.message}`);
      this.results.failed.push(filePath);
    } finally {
      await page.close();
    }
  }

  async testDirectory(dir) {
    const htmlFiles = this.glob.sync('**/*.html', {
      cwd: dir,
      absolute: true,
      ignore: ['node_modules/**', '.git/**']
    });

    console.log(`Found ${htmlFiles.length} HTML files to test`);

    for (const file of htmlFiles) {
      await this.testFile(file);
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.passed.length + this.results.failed.length,
        passed: this.results.passed.length,
        failed: this.results.failed.length
      },
      results: this.results
    };

    await fs.writeFile(
      'accessibility-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n=== Accessibility Test Summary ===');
    console.log(`Total files tested: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log('Report saved to: accessibility-report.json');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const tester = new AccessibilityTester();
  
  try {
    await tester.init();
    
    const testDir = process.argv[2] || 'public';
    
    if (!await fs.access(testDir).then(() => true).catch(() => false)) {
      console.log(`Directory ${testDir} not found. Running build first...`);
      
      const { spawn } = require('child_process');
      await new Promise((resolve, reject) => {
        const build = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
        build.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Build failed with code ${code}`));
        });
      });
    }
    
    await tester.testDirectory(testDir);
    await tester.generateReport();
    
    process.exit(tester.results.failed.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('Accessibility test failed:', error.message);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = { AccessibilityTester };
