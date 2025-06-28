#!/usr/bin/env node

/**
 * Build Validation Test Suite
 * Tests build process and validates output
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const glob = require('glob');

class BuildValidator {
  constructor() {
    this.results = {
      build: null,
      output: [],
      structure: [],
      assets: []
    };
    this.errors = [];
    this.warnings = [];
  }

  async runBuild(buildCommand = 'npm run build') {
    console.log(`Running build command: ${buildCommand}`);
    
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = buildCommand.split(' ');
      const build = spawn(cmd, args, {
        stdio: ['inherit', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      build.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });
      
      build.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });
      
      build.on('close', (code) => {
        this.results.build = {
          command: buildCommand,
          exitCode: code,
          stdout,
          stderr,
          success: code === 0
        };
        
        if (code === 0) {
          console.log('✅ Build completed successfully');
          resolve();
        } else {
          this.errors.push(`Build failed with exit code ${code}`);
          reject(new Error(`Build failed with exit code ${code}`));
        }
      });
    });
  }

  async validateOutputStructure(outputDir = 'public') {
    console.log('Validating output structure...');
    
    const expectedFiles = [
      'index.html',
      'css/style.css',
      'js/main.js'
    ];
    
    const optionalFiles = [
      'assets/images/',
      'assets/fonts/',
      'sitemap.xml',
      'robots.txt'
    ];
    
    // Check required files
    for (const file of expectedFiles) {
      const filePath = path.join(outputDir, file);
      try {
        const stats = await fs.stat(filePath);
        this.results.structure.push({
          file,
          status: 'found',
          size: stats.size,
          type: stats.isDirectory() ? 'directory' : 'file'
        });
        console.log(`✅ Required file found: ${file} (${stats.size} bytes)`);
      } catch (error) {
        this.results.structure.push({ file, status: 'missing' });
        this.errors.push(`Missing required file: ${file}`);
        console.log(`❌ Missing required file: ${file}`);
      }
    }
    
    // Check optional files
    for (const file of optionalFiles) {
      const filePath = path.join(outputDir, file);
      try {
        const stats = await fs.stat(filePath);
        this.results.structure.push({
          file,
          status: 'found',
          size: stats.isDirectory() ? 'directory' : stats.size,
          type: stats.isDirectory() ? 'directory' : 'file',
          optional: true
        });
        console.log(`✅ Optional file found: ${file}`);
      } catch (error) {
        this.results.structure.push({ file, status: 'missing', optional: true });
        console.log(`⚠️  Optional file missing: ${file}`);
      }
    }
  }

  async validateHTMLOutput(outputDir = 'public') {
    console.log('Validating HTML output...');
    
    const htmlFiles = glob.sync('**/*.html', {
      cwd: outputDir,
      absolute: true
    });
    
    for (const file of htmlFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(outputDir, file);
        
        const validation = {
          file: relativePath,
          size: content.length,
          issues: []
        };
        
        // Basic HTML validation
        if (!content.includes('<!DOCTYPE html>')) {
          validation.issues.push('Missing DOCTYPE declaration');
        }
        
        if (!content.includes('<html')) {
          validation.issues.push('Missing html element');
        }
        
        if (!content.includes('<head>')) {
          validation.issues.push('Missing head element');
        }
        
        if (!content.includes('<title>')) {
          validation.issues.push('Missing title element');
        }
        
        if (!content.includes('<body>')) {
          validation.issues.push('Missing body element');
        }
        
        // Check for meta viewport
        if (!content.includes('viewport')) {
          validation.issues.push('Missing viewport meta tag');
        }
        
        // Check for charset
        if (!content.includes('charset')) {
          validation.issues.push('Missing charset declaration');
        }
        
        this.results.output.push(validation);
        
        if (validation.issues.length > 0) {
          this.warnings.push(`${relativePath}: ${validation.issues.length} HTML issues`);
        } else {
          console.log(`✅ Valid HTML: ${relativePath}`);
        }
        
      } catch (error) {
        this.errors.push(`Error validating HTML ${file}: ${error.message}`);
      }
    }
  }

  async validateAssets(outputDir = 'public') {
    console.log('Validating assets...');
    
    const assetTypes = {
      css: '**/*.css',
      js: '**/*.js',
      images: '**/*.{jpg,jpeg,png,gif,svg,webp}',
      fonts: '**/*.{woff,woff2,ttf,otf}'
    };
    
    for (const [type, pattern] of Object.entries(assetTypes)) {
      const files = glob.sync(pattern, {
        cwd: outputDir,
        absolute: true
      });
      
      const assetInfo = {
        type,
        count: files.length,
        totalSize: 0,
        files: []
      };
      
      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          const relativePath = path.relative(outputDir, file);
          
          assetInfo.files.push({
            path: relativePath,
            size: stats.size
          });
          assetInfo.totalSize += stats.size;
        } catch (error) {
          this.warnings.push(`Error reading asset ${file}: ${error.message}`);
        }
      }
      
      this.results.assets.push(assetInfo);
      console.log(`✅ ${type.toUpperCase()}: ${assetInfo.count} files (${assetInfo.totalSize} bytes)`);
    }
  }

  async runIncrementalBuildTest() {
    console.log('Testing incremental build...');
    
    try {
      // Run incremental build
      await this.runBuild('npm run build:incremental');
      
      // Check if .build-meta.json exists
      try {
        await fs.access('.build-meta.json');
        console.log('✅ Incremental build metadata found');
      } catch (error) {
        this.warnings.push('Incremental build metadata not found');
      }
      
    } catch (error) {
      this.warnings.push(`Incremental build test failed: ${error.message}`);
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        buildSuccess: this.results.build?.success || false,
        errors: this.errors.length,
        warnings: this.warnings.length,
        outputFiles: this.results.output.length,
        assetTypes: this.results.assets.length
      },
      build: this.results.build,
      errors: this.errors,
      warnings: this.warnings,
      results: this.results
    };
    
    await fs.writeFile(
      'build-validation-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n=== Build Validation Summary ===');
    console.log(`Build success: ${report.summary.buildSuccess ? '✅' : '❌'}`);
    console.log(`Output files: ${report.summary.outputFiles}`);
    console.log(`Asset types: ${report.summary.assetTypes}`);
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
    
    console.log('\nReport saved to: build-validation-report.json');
  }
}

// Main execution
async function main() {
  const validator = new BuildValidator();
  const outputDir = process.argv[2] || 'public';
  const buildCommand = process.argv[3] || 'npm run build';
  
  try {
    console.log('Starting build validation...');
    
    // Clean previous build
    console.log('Cleaning previous build...');
    await new Promise((resolve) => {
      const clean = spawn('npm', ['run', 'clean'], { stdio: 'inherit' });
      clean.on('close', () => resolve());
    });
    
    // Run main build
    await validator.runBuild(buildCommand);
    
    // Validate output
    await validator.validateOutputStructure(outputDir);
    await validator.validateHTMLOutput(outputDir);
    await validator.validateAssets(outputDir);
    
    // Test incremental build
    await validator.runIncrementalBuildTest();
    
    await validator.generateReport();
    
    process.exit(validator.errors.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('Build validation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { BuildValidator };
