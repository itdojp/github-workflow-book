#!/usr/bin/env node

/**
 * Error Recovery System
 * Enhanced error messages and automatic recovery functionality
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
// Simple levenshtein distance implementation\nfunction levenshtein(a, b) {\n  if (a === b) return 0;\n  if (a.length === 0) return b.length;\n  if (b.length === 0) return a.length;\n  \n  const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));\n  \n  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;\n  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;\n  \n  for (let j = 1; j <= b.length; j++) {\n    for (let i = 1; i <= a.length; i++) {\n      const cost = a[i - 1] === b[j - 1] ? 0 : 1;\n      matrix[j][i] = Math.min(\n        matrix[j - 1][i] + 1,     // deletion\n        matrix[j][i - 1] + 1,     // insertion  \n        matrix[j - 1][i - 1] + cost // substitution\n      );\n    }\n  }\n  \n  return matrix[b.length][a.length];\n}

class ErrorRecoverySystem {
  constructor(options = {}) {
    this.options = {
      autoRecovery: options.autoRecovery || false,
      verbose: options.verbose || false,
      saveBackups: options.saveBackups !== false,
      suggestionThreshold: options.suggestionThreshold || 3,
      maxSuggestions: options.maxSuggestions || 5
    };
    
    this.recoveryLog = {
      timestamp: new Date().toISOString(),
      errors: [],
      recoveries: [],
      suggestions: []
    };
    
    this.fileIndex = new Map();
    this.configCache = new Map();
    
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      bright: '\x1b[1m'
    };
  }

  log(level, message, data = null) {
    const color = this.colors[level] || this.colors.reset;
    const timestamp = new Date().toISOString().slice(11, 19);
    
    console.log(`${this.colors.cyan}[${timestamp}]${this.colors.reset} ${color}${message}${this.colors.reset}`);
    
    if (data && this.options.verbose) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async init() {
    this.log('blue', '🔧 Initializing error recovery system...');
    await this.buildFileIndex();
    await this.loadConfigFiles();
  }

  async buildFileIndex() {
    const patterns = [
      'src/**/*.md',
      'scripts/**/*.js',
      '*.json',
      '*.yml',
      '*.yaml',
      '.github/**/*'
    ];
    
    for (const pattern of patterns) {
      const files = glob.sync(pattern, { ignore: ['node_modules/**', '.git/**'] });
      
      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          const basename = path.basename(file);
          const dirname = path.dirname(file);
          
          this.fileIndex.set(file, {
            path: file,
            basename,
            dirname,
            size: stats.size,
            mtime: stats.mtime
          });
        } catch (error) {
          // File might have been deleted, skip
        }
      }
    }
    
    this.log('green', `📁 Indexed ${this.fileIndex.size} files`);
  }

  async loadConfigFiles() {
    const configFiles = [
      'package.json',
      'book-config.json',
      '.deploy-config.json'
    ];
    
    for (const file of configFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        this.configCache.set(file, JSON.parse(content));
      } catch (error) {
        // Config file doesn't exist or invalid JSON
      }
    }
  }

  createEnhancedError(originalError, context = {}) {
    const enhancedError = {
      timestamp: new Date().toISOString(),
      originalError: {
        message: originalError.message,
        stack: originalError.stack,
        code: originalError.code
      },
      context,
      enhancedMessage: this.generateEnhancedMessage(originalError, context),
      suggestions: this.generateSuggestions(originalError, context),
      recoveryActions: this.generateRecoveryActions(originalError, context)
    };
    
    this.recoveryLog.errors.push(enhancedError);
    return enhancedError;
  }

  generateEnhancedMessage(error, context) {
    const message = error.message || error.toString();
    
    // File not found errors
    if (error.code === 'ENOENT' || message.includes('not found')) {
      return this.enhanceFileNotFoundError(error, context);
    }
    
    // Permission errors
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return this.enhancePermissionError(error, context);
    }
    
    // JSON parse errors
    if (message.includes('JSON') || message.includes('parse')) {
      return this.enhanceJSONError(error, context);
    }
    
    // Markdown errors
    if (message.includes('markdown') || context.fileType === 'md') {
      return this.enhanceMarkdownError(error, context);
    }
    
    // Build errors
    if (context.operation === 'build') {
      return this.enhanceBuildError(error, context);
    }
    
    // Default enhancement
    return {
      original: message,
      enhanced: `${message}\n\nContext: ${JSON.stringify(context, null, 2)}`,
      severity: this.determineSeverity(error, context)
    };
  }

  enhanceFileNotFoundError(error, context) {
    const filePath = this.extractFilePathFromError(error, context);
    
    if (!filePath) {
      return {
        original: error.message,
        enhanced: `File not found. Please check the file path and permissions.`,
        severity: 'high'
      };
    }
    
    const suggestions = this.findSimilarFiles(filePath);
    const dirname = path.dirname(filePath);
    const basename = path.basename(filePath);
    
    let enhanced = `File not found: '${filePath}'\n`;
    
    if (suggestions.length > 0) {
      enhanced += `\nDid you mean one of these files?\n`;
      suggestions.forEach((suggestion, index) => {
        enhanced += `  ${index + 1}. ${suggestion.path} (${suggestion.similarity}% match)\n`;
      });
    }
    
    // Check if directory exists
    if (this.fileIndex.has(dirname)) {
      const dirFiles = Array.from(this.fileIndex.values())
        .filter(file => file.dirname === dirname)
        .map(file => file.basename);
      
      if (dirFiles.length > 0) {
        enhanced += `\nFiles in directory '${dirname}':${dirFiles.map(f => `\n  - ${f}`).join('')}`;
      }
    } else {
      enhanced += `\nDirectory '${dirname}' does not exist.`;
      
      const parentDir = path.dirname(dirname);
      if (this.fileIndex.has(parentDir)) {
        enhanced += ` Parent directory '${parentDir}' exists.`;
      }
    }
    
    return {
      original: error.message,
      enhanced,
      severity: 'high',
      suggestions
    };
  }

  enhancePermissionError(error, context) {
    const filePath = this.extractFilePathFromError(error, context);
    
    return {
      original: error.message,
      enhanced: `Permission denied: '${filePath}'\n\n` +
                `This usually means:\n` +
                `  - The file/directory doesn't have proper permissions\n` +
                `  - The file is being used by another process\n` +
                `  - You need elevated privileges\n\n` +
                `Try:\n` +
                `  - chmod +r "${filePath}" (to add read permission)\n` +
                `  - chmod +w "${filePath}" (to add write permission)\n` +
                `  - Close other applications using this file`,
      severity: 'high'
    };
  }

  enhanceJSONError(error, context) {
    const filePath = context.file || 'unknown file';
    const message = error.message;
    
    let enhanced = `JSON parsing error in '${filePath}'\n\n`;
    
    // Extract line/column info if available
    const lineMatch = message.match(/line (\d+)/i);
    const columnMatch = message.match(/column (\d+)/i);
    
    if (lineMatch || columnMatch) {
      const line = lineMatch ? lineMatch[1] : '?';
      const column = columnMatch ? columnMatch[1] : '?';
      enhanced += `Error at line ${line}, column ${column}\n\n`;
    }
    
    // Common JSON error patterns
    if (message.includes('Unexpected token')) {
      enhanced += `Common causes:\n` +
                  `  - Missing or extra comma\n` +
                  `  - Unquoted string keys\n` +
                  `  - Trailing comma before closing bracket\n` +
                  `  - Single quotes instead of double quotes`;
    } else if (message.includes('Unexpected end')) {
      enhanced += `The JSON file appears to be incomplete.\n` +
                  `Check for:\n` +
                  `  - Missing closing brackets } or ]\n` +
                  `  - Truncated file`;
    }
    
    return {
      original: error.message,
      enhanced,
      severity: 'medium'
    };
  }

  enhanceMarkdownError(error, context) {
    const filePath = context.file || 'unknown markdown file';
    
    return {
      original: error.message,
      enhanced: `Markdown processing error in '${filePath}'\n\n` +
                `Common markdown issues:\n` +
                `  - Malformed frontmatter (YAML header)\n` +
                `  - Unescaped special characters\n` +
                `  - Invalid link syntax\n` +
                `  - Missing blank lines around code blocks\n` +
                `  - Inconsistent heading levels`,
      severity: 'medium'
    };
  }

  enhanceBuildError(error, context) {
    const message = error.message;
    
    let enhanced = `Build process failed\n\n`;
    
    if (message.includes('ENOSPC')) {
      enhanced += `Disk space error: Not enough space to complete the build.\n` +
                  `Try: npm run clean to free up space.`;
    } else if (message.includes('EMFILE') || message.includes('too many open files')) {
      enhanced += `Too many open files error.\n` +
                  `This usually happens with large projects.\n` +
                  `Try: Increase file descriptor limits or break down the build.`;
    } else if (message.includes('Module not found')) {
      enhanced += `Missing dependency.\n` +
                  `Try: npm install to install missing packages.`;
    } else {
      enhanced += `Build step failed: ${context.step || 'unknown'}\n` +
                  `Check the build logs for more details.`;
    }
    
    return {
      original: error.message,
      enhanced,
      severity: 'high'
    };
  }

  extractFilePathFromError(error, context) {
    // Try to extract file path from various sources
    if (context.file) return context.file;
    if (error.path) return error.path;
    
    const message = error.message;
    
    // Common patterns for file paths in error messages
    const patterns = [
      /'([^']+)'/,           // Single quotes
      /"([^"]+)"/,           // Double quotes
      /\s([\w\/.\-]+\.\w+)/,   // File extensions
      /ENOENT.*?\s+([\w\/.\-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  findSimilarFiles(targetPath) {
    const targetBasename = path.basename(targetPath);
    const targetDirname = path.dirname(targetPath);
    
    const candidates = Array.from(this.fileIndex.values())
      .filter(file => {
        // Prefer files in the same or nearby directories
        const dirDistance = this.calculatePathDistance(file.dirname, targetDirname);
        return dirDistance <= 2; // Allow some directory traversal
      })
      .map(file => {
        const nameDistance = levenshtein(file.basename.toLowerCase(), targetBasename.toLowerCase());
        const similarity = Math.max(0, 100 - (nameDistance * 10));
        
        return {
          path: file.path,
          basename: file.basename,
          similarity: Math.round(similarity),
          distance: nameDistance
        };
      })
      .filter(candidate => candidate.similarity >= this.options.suggestionThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, this.options.maxSuggestions);
    
    return candidates;
  }

  calculatePathDistance(path1, path2) {
    const parts1 = path1.split(path.sep).filter(p => p);
    const parts2 = path2.split(path.sep).filter(p => p);
    
    return Math.abs(parts1.length - parts2.length) + 
           levenshtein(parts1.join('/'), parts2.join('/'));
  }

  generateSuggestions(error, context) {
    const suggestions = [];
    const errorType = this.classifyError(error, context);
    
    switch (errorType) {
      case 'file_not_found':
        const similarFiles = this.findSimilarFiles(this.extractFilePathFromError(error, context));
        suggestions.push(...similarFiles.map(file => ({
          type: 'file_suggestion',
          action: `Use file: ${file.path}`,
          confidence: file.similarity,
          autoRecoverable: true
        })));
        break;
        
      case 'permission_error':
        suggestions.push({
          type: 'permission_fix',
          action: 'Fix file permissions',
          command: `chmod +rw "${this.extractFilePathFromError(error, context)}"`,
          confidence: 90,
          autoRecoverable: false
        });
        break;
        
      case 'json_error':
        suggestions.push({
          type: 'json_validation',
          action: 'Validate and fix JSON syntax',
          command: 'Use online JSON validator or IDE with JSON support',
          confidence: 80,
          autoRecoverable: false
        });
        break;
        
      case 'build_error':
        suggestions.push(
          {
            type: 'clean_build',
            action: 'Clean and rebuild',
            command: 'npm run clean && npm run build',
            confidence: 70,
            autoRecoverable: true
          },
          {
            type: 'dependency_install',
            action: 'Reinstall dependencies',
            command: 'npm install',
            confidence: 60,
            autoRecoverable: true
          }
        );
        break;
    }
    
    return suggestions;
  }

  generateRecoveryActions(error, context) {
    const actions = [];
    const errorType = this.classifyError(error, context);
    
    if (errorType === 'file_not_found') {
      const filePath = this.extractFilePathFromError(error, context);
      const dirname = path.dirname(filePath);
      
      actions.push({
        type: 'create_directory',
        description: `Create missing directory: ${dirname}`,
        action: async () => {
          await fs.mkdir(dirname, { recursive: true });
          return `Directory ${dirname} created`;
        },
        auto: true
      });
      
      if (filePath.endsWith('.md')) {
        actions.push({
          type: 'create_template',
          description: `Create template markdown file: ${filePath}`,
          action: async () => {
            const template = this.generateMarkdownTemplate(filePath);
            await fs.writeFile(filePath, template);
            return `Template file ${filePath} created`;
          },
          auto: this.options.autoRecovery
        });
      }
    }
    
    if (errorType === 'build_error') {
      actions.push({
        type: 'partial_recovery',
        description: 'Save partial build results',
        action: async () => {
          await this.savePartialBuild();
          return 'Partial build results saved';
        },
        auto: true
      });
    }
    
    return actions;
  }

  classifyError(error, context) {
    const message = error.message || error.toString();
    
    if (error.code === 'ENOENT' || message.includes('not found')) {
      return 'file_not_found';
    }
    
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return 'permission_error';
    }
    
    if (message.includes('JSON') || message.includes('parse')) {
      return 'json_error';
    }
    
    if (context.operation === 'build') {
      return 'build_error';
    }
    
    return 'unknown';
  }

  determineSeverity(error, context) {
    const message = error.message || error.toString();
    
    if (message.includes('ENOSPC') || message.includes('out of space')) {
      return 'critical';
    }
    
    if (error.code === 'ENOENT' || context.operation === 'build') {
      return 'high';
    }
    
    if (message.includes('JSON') || message.includes('markdown')) {
      return 'medium';
    }
    
    return 'low';
  }

  generateMarkdownTemplate(filePath) {
    const basename = path.basename(filePath, '.md');
    const title = basename.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    return `---
title: "${title}"
---

# ${title}

Content goes here.

## Section 1

Description.

## Section 2

More content.
`;
  }

  async savePartialBuild() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `.recovery/partial-build-${timestamp}`;
    
    await fs.mkdir(backupDir, { recursive: true });
    
    // Save any existing public directory
    try {
      await fs.cp('public', path.join(backupDir, 'public'), { recursive: true });
    } catch (error) {
      // public directory might not exist
    }
    
    // Save build metadata
    try {
      await fs.cp('.build-meta.json', path.join(backupDir, '.build-meta.json'));
    } catch (error) {
      // metadata might not exist
    }
    
    return backupDir;
  }

  async executeRecoveryAction(action) {
    this.log('yellow', `🔧 Executing recovery action: ${action.description}`);
    
    try {
      const result = await action.action();
      
      this.recoveryLog.recoveries.push({
        timestamp: new Date().toISOString(),
        action: action.type,
        description: action.description,
        result,
        success: true
      });
      
      this.log('green', `✅ Recovery action completed: ${result}`);
      return { success: true, result };
      
    } catch (error) {
      this.recoveryLog.recoveries.push({
        timestamp: new Date().toISOString(),
        action: action.type,
        description: action.description,
        error: error.message,
        success: false
      });
      
      this.log('red', `❌ Recovery action failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async recoverFromError(error, context = {}) {
    this.log('red', `🚨 Error detected: ${error.message}`);
    
    const enhancedError = this.createEnhancedError(error, context);
    
    // Display enhanced error message
    console.log(`\n${this.colors.red}${this.colors.bright}Enhanced Error Information:${this.colors.reset}`);
    console.log(enhancedError.enhancedMessage.enhanced);
    
    // Display suggestions
    if (enhancedError.suggestions.length > 0) {
      console.log(`\n${this.colors.yellow}${this.colors.bright}Suggestions:${this.colors.reset}`);
      enhancedError.suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion.action} (${suggestion.confidence}% confidence)`);
      });
    }
    
    // Execute automatic recovery actions
    const recoveryActions = enhancedError.recoveryActions.filter(action => 
      action.auto || this.options.autoRecovery
    );
    
    if (recoveryActions.length > 0) {
      console.log(`\n${this.colors.cyan}${this.colors.bright}Automatic Recovery:${this.colors.reset}`);
      
      for (const action of recoveryActions) {
        await this.executeRecoveryAction(action);
      }
    }
    
    // Show manual recovery actions
    const manualActions = enhancedError.recoveryActions.filter(action => 
      !action.auto && !this.options.autoRecovery
    );
    
    if (manualActions.length > 0) {
      console.log(`\n${this.colors.magenta}${this.colors.bright}Manual Recovery Options:${this.colors.reset}`);
      manualActions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action.description}`);
      });
    }
    
    return enhancedError;
  }

  async saveRecoveryLog() {
    const logFile = `.recovery/recovery-log-${Date.now()}.json`;
    await fs.mkdir('.recovery', { recursive: true });
    await fs.writeFile(logFile, JSON.stringify(this.recoveryLog, null, 2));
    
    this.log('cyan', `📝 Recovery log saved: ${logFile}`);
    return logFile;
  }

  async generateRecoveryReport() {
    const report = {
      summary: {
        totalErrors: this.recoveryLog.errors.length,
        totalRecoveries: this.recoveryLog.recoveries.length,
        successfulRecoveries: this.recoveryLog.recoveries.filter(r => r.success).length,
        autoRecoveryEnabled: this.options.autoRecovery
      },
      errors: this.recoveryLog.errors,
      recoveries: this.recoveryLog.recoveries,
      suggestions: this.recoveryLog.suggestions
    };
    
    console.log(`\n${this.colors.cyan}${this.colors.bright}Recovery Session Summary:${this.colors.reset}`);
    console.log(`Errors processed: ${report.summary.totalErrors}`);
    console.log(`Recovery actions executed: ${report.summary.totalRecoveries}`);
    console.log(`Successful recoveries: ${report.summary.successfulRecoveries}`);
    
    const reportFile = await this.saveRecoveryLog();
    return { report, reportFile };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    autoRecovery: args.includes('--auto') || args.includes('-a'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    saveBackups: !args.includes('--no-backups')
  };
  
  const recovery = new ErrorRecoverySystem(options);
  
  try {
    await recovery.init();
    
    // If no specific error provided, run a general health check
    if (args.length === 0 || args.every(arg => arg.startsWith('-'))) {
      recovery.log('blue', '🏥 Running system health check...');
      
      // Check for common issues
      const issues = await runHealthCheck(recovery);
      
      if (issues.length === 0) {
        recovery.log('green', '✅ No issues detected');
      } else {
        recovery.log('yellow', `⚠️  Found ${issues.length} potential issues`);
        
        for (const issue of issues) {
          await recovery.recoverFromError(new Error(issue.message), issue.context);
        }
      }
    }
    
    await recovery.generateRecoveryReport();
    
  } catch (error) {
    console.error('Recovery system error:', error);
    process.exit(1);
  }
}

async function runHealthCheck(recovery) {
  const issues = [];
  
  // Check required directories
  const requiredDirs = ['src', 'scripts'];
  for (const dir of requiredDirs) {
    try {
      await fs.access(dir);
    } catch (error) {
      issues.push({
        message: `Required directory '${dir}' not found`,
        context: { operation: 'health_check', missingDir: dir }
      });
    }
  }
  
  // Check required files
  const requiredFiles = ['package.json', 'src/introduction/index.md'];
  for (const file of requiredFiles) {
    try {
      await fs.access(file);
    } catch (error) {
      issues.push({
        message: `Required file '${file}' not found`,
        context: { operation: 'health_check', missingFile: file }
      });
    }
  }
  
  // Check package.json validity
  try {
    const content = await fs.readFile('package.json', 'utf-8');
    JSON.parse(content);
  } catch (error) {
    issues.push({
      message: 'package.json is invalid or corrupted',
      context: { operation: 'health_check', file: 'package.json' }
    });
  }
  
  return issues;
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error recovery failed:', error);
    process.exit(1);
  });
}

module.exports = {
  ErrorRecoverySystem
};
