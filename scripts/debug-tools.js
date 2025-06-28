#!/usr/bin/env node

/**
 * Debug Tools Suite
 * Comprehensive debugging and profiling tools for the build process
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const os = require('os');
const v8 = require('v8');

class DebugTools {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      profile: options.profile || false,
      memory: options.memory || false,
      trace: options.trace || false,
      saveIntermediate: options.saveIntermediate || false,
      outputFormat: options.outputFormat || 'console',
      breakpoints: options.breakpoints || []
    };
    
    this.session = {
      startTime: Date.now(),
      steps: [],
      metrics: {
        memory: [],
        timing: {},
        performance: []
      },
      errors: [],
      warnings: [],
      breakpointHits: []
    };
    
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const color = this.colors[level] || this.colors.reset;
    
    if (this.options.verbose || level === 'error') {
      console.log(`${this.colors.cyan}[${timestamp}]${this.colors.reset} ${color}${message}${this.colors.reset}`);
      if (data && this.options.verbose) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }

  async startProfiling() {
    this.log('blue', '🔧 Starting debug session...');
    
    if (this.options.memory) {
      this.memoryInterval = setInterval(() => {
        this.captureMemoryUsage();
      }, 1000);
    }
    
    if (this.options.profile) {
      // V8 CPU profiling
      const inspector = require('inspector');
      this.inspectorSession = new inspector.Session();
      this.inspectorSession.connect();
      
      this.inspectorSession.post('Profiler.enable');
      this.inspectorSession.post('Profiler.start');
      this.log('green', '📊 CPU profiling started');
    }
  }

  async stopProfiling() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    
    if (this.options.profile && this.inspectorSession) {
      const { profile } = await new Promise((resolve) => {
        this.inspectorSession.post('Profiler.stop', (err, { profile }) => {
          resolve({ profile });
        });
      });
      
      await this.saveCpuProfile(profile);
      this.inspectorSession.disconnect();
      this.log('green', '📊 CPU profiling completed');
    }
  }

  captureMemoryUsage() {
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };
    
    const snapshot = {
      timestamp: Date.now(),
      process: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      system: systemMem,
      v8: {
        heapStatistics: v8.getHeapStatistics(),
        heapSpaceStatistics: v8.getHeapSpaceStatistics()
      }
    };
    
    this.session.metrics.memory.push(snapshot);
    
    if (this.options.verbose) {
      const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      this.log('cyan', `💾 Memory: Heap ${heapMB}MB, RSS ${rssMB}MB`);
    }
  }

  async startStep(name, description = '') {
    const step = {
      name,
      description,
      startTime: performance.now(),
      startMemory: process.memoryUsage(),
      timestamp: Date.now()
    };
    
    this.session.steps.push(step);
    this.log('blue', `🔄 Starting: ${name}${description ? ` - ${description}` : ''}`);
    
    // Check for breakpoints
    if (this.options.breakpoints.includes(name)) {
      await this.hitBreakpoint(name, step);
    }
    
    return this.session.steps.length - 1;
  }

  async endStep(stepIndex, result = null) {
    if (stepIndex >= this.session.steps.length) return;
    
    const step = this.session.steps[stepIndex];
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    step.endTime = endTime;
    step.duration = endTime - step.startTime;
    step.endMemory = endMemory;
    step.memoryDelta = {
      rss: endMemory.rss - step.startMemory.rss,
      heapTotal: endMemory.heapTotal - step.startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - step.startMemory.heapUsed
    };
    step.result = result;
    
    const duration = Math.round(step.duration);
    const status = result?.success !== false ? '✅' : '❌';
    this.log('green', `${status} Completed: ${step.name} (${duration}ms)`);
    
    if (this.options.saveIntermediate && result) {
      await this.saveIntermediateResult(step.name, result);
    }
  }

  async hitBreakpoint(name, step) {
    this.log('yellow', `🛑 Breakpoint hit: ${name}`);
    
    const breakpointData = {
      name,
      timestamp: Date.now(),
      step: step,
      memory: process.memoryUsage(),
      stackTrace: new Error().stack
    };
    
    this.session.breakpointHits.push(breakpointData);
    
    // Interactive debugging (simplified)
    console.log('\n--- Breakpoint Information ---');
    console.log(`Step: ${name}`);
    console.log(`Memory: ${Math.round(breakpointData.memory.heapUsed / 1024 / 1024)}MB`);
    console.log('Stack trace:', breakpointData.stackTrace);
    console.log('--- End Breakpoint ---\n');
  }

  logError(error, context = '') {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    };
    
    this.session.errors.push(errorData);
    this.log('red', `❌ Error${context ? ` in ${context}` : ''}: ${error.message}`);
    
    if (this.options.trace) {
      console.log('Stack trace:', error.stack);
    }
  }

  logWarning(message, context = '') {
    const warningData = {
      message,
      context,
      timestamp: Date.now()
    };
    
    this.session.warnings.push(warningData);
    this.log('yellow', `⚠️ Warning${context ? ` in ${context}` : ''}: ${message}`);
  }

  async saveIntermediateResult(stepName, result) {
    const filename = `debug-intermediate-${stepName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.json`;
    const filepath = path.join('.debug', filename);
    
    try {
      await fs.mkdir('.debug', { recursive: true });
      await fs.writeFile(filepath, JSON.stringify(result, null, 2));
      this.log('cyan', `💾 Intermediate result saved: ${filename}`);
    } catch (error) {
      this.logError(error, 'saving intermediate result');
    }
  }

  async saveCpuProfile(profile) {
    const filename = `debug-cpu-profile-${Date.now()}.cpuprofile`;
    const filepath = path.join('.debug', filename);
    
    try {
      await fs.mkdir('.debug', { recursive: true });
      await fs.writeFile(filepath, JSON.stringify(profile));
      this.log('green', `📊 CPU profile saved: ${filename}`);
      this.log('cyan', `   Open in Chrome DevTools: chrome://inspect > Load Profile`);
    } catch (error) {
      this.logError(error, 'saving CPU profile');
    }
  }

  async generateReport() {
    const sessionDuration = Date.now() - this.session.startTime;
    
    const report = {
      session: {
        startTime: new Date(this.session.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: sessionDuration,
        options: this.options
      },
      summary: {
        totalSteps: this.session.steps.length,
        completedSteps: this.session.steps.filter(s => s.endTime).length,
        errors: this.session.errors.length,
        warnings: this.session.warnings.length,
        breakpointHits: this.session.breakpointHits.length
      },
      steps: this.session.steps,
      metrics: this.session.metrics,
      errors: this.session.errors,
      warnings: this.session.warnings,
      breakpoints: this.session.breakpointHits
    };
    
    await fs.mkdir('.debug', { recursive: true });
    
    // Save JSON report
    const jsonFile = `.debug/debug-report-${Date.now()}.json`;
    await fs.writeFile(jsonFile, JSON.stringify(report, null, 2));
    
    if (this.options.outputFormat === 'html' || this.options.outputFormat === 'both') {
      await this.generateHtmlReport(report);
    }
    
    return report;
  }

  async generateHtmlReport(report) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug Report - ${new Date(report.session.startTime).toLocaleString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 20px 0; }
        .metric { background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0; color: #2c5aa0; }
        .metric .value { font-size: 2em; font-weight: bold; color: #1e3a8a; }
        .steps { margin: 20px 0; }
        .step { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .step.success { border-left: 5px solid #10b981; }
        .step.error { border-left: 5px solid #ef4444; }
        .error { background: #fee; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .warning { background: #fef3cd; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .memory-chart { width: 100%; height: 300px; background: #f9f9f9; border: 1px solid #ddd; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="header">
        <h1>Debug Report</h1>
        <p><strong>Session:</strong> ${new Date(report.session.startTime).toLocaleString()} - ${new Date(report.session.endTime).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${Math.round(report.session.duration / 1000)}s</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Steps</h3>
            <div class="value">${report.summary.totalSteps}</div>
        </div>
        <div class="metric">
            <h3>Errors</h3>
            <div class="value" style="color: ${report.summary.errors > 0 ? '#ef4444' : '#10b981'}">${report.summary.errors}</div>
        </div>
        <div class="metric">
            <h3>Warnings</h3>
            <div class="value" style="color: ${report.summary.warnings > 0 ? '#f59e0b' : '#10b981'}">${report.summary.warnings}</div>
        </div>
        <div class="metric">
            <h3>Breakpoints</h3>
            <div class="value">${report.summary.breakpointHits}</div>
        </div>
    </div>
    
    ${report.metrics.memory.length > 0 ? `
    <h2>Memory Usage</h2>
    <canvas id="memoryChart" class="memory-chart"></canvas>
    ` : ''}
    
    <h2>Build Steps</h2>
    <div class="steps">
        ${report.steps.map(step => `
        <div class="step ${step.result?.success !== false ? 'success' : 'error'}">
            <h3>${step.name}</h3>
            <p>${step.description}</p>
            <p><strong>Duration:</strong> ${step.duration ? Math.round(step.duration) + 'ms' : 'In progress'}</p>
            ${step.memoryDelta ? `<p><strong>Memory Delta:</strong> ${Math.round(step.memoryDelta.heapUsed / 1024)}KB heap</p>` : ''}
        </div>
        `).join('')}
    </div>
    
    ${report.errors.length > 0 ? `
    <h2>Errors</h2>
    ${report.errors.map(error => `
    <div class="error">
        <strong>${error.context || 'General'}:</strong> ${error.message}
        <pre>${error.stack}</pre>
    </div>
    `).join('')}
    ` : ''}
    
    ${report.warnings.length > 0 ? `
    <h2>Warnings</h2>
    ${report.warnings.map(warning => `
    <div class="warning">
        <strong>${warning.context || 'General'}:</strong> ${warning.message}
    </div>
    `).join('')}
    ` : ''}
    
    <script>
        ${report.metrics.memory.length > 0 ? `
        const memoryData = ${JSON.stringify(report.metrics.memory)};
        const ctx = document.getElementById('memoryChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: memoryData.map(m => new Date(m.timestamp).toLocaleTimeString()),
                datasets: [{
                    label: 'Heap Used (MB)',
                    data: memoryData.map(m => m.process.heapUsed / 1024 / 1024),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }, {
                    label: 'RSS (MB)',
                    data: memoryData.map(m => m.process.rss / 1024 / 1024),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Memory (MB)'
                        }
                    }
                }
            }
        });
        ` : ''}
    </script>
</body>
</html>
    `;
    
    const htmlFile = `.debug/debug-report-${Date.now()}.html`;
    await fs.writeFile(htmlFile, htmlContent);
    this.log('green', `📊 HTML report saved: ${htmlFile}`);
  }

  async displayConsoleSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log(`${this.colors.cyan}${this.colors.bright}🔧 DEBUG SESSION SUMMARY${this.colors.reset}`);
    console.log('='.repeat(60));
    
    console.log(`${this.colors.blue}📊 Session Statistics:${this.colors.reset}`);
    console.log(`   Duration: ${Math.round(report.session.duration / 1000)}s`);
    console.log(`   Steps completed: ${report.summary.completedSteps}/${report.summary.totalSteps}`);
    console.log(`   Errors: ${report.summary.errors}`);
    console.log(`   Warnings: ${report.summary.warnings}`);
    console.log(`   Breakpoint hits: ${report.summary.breakpointHits}`);
    
    if (report.steps.length > 0) {
      console.log(`\n${this.colors.blue}⏱️  Step Performance:${this.colors.reset}`);
      report.steps.forEach(step => {
        if (step.duration) {
          const duration = Math.round(step.duration);
          const status = step.result?.success !== false ? '✅' : '❌';
          console.log(`   ${status} ${step.name}: ${duration}ms`);
        }
      });
    }
    
    if (report.metrics.memory.length > 0) {
      const memoryStats = this.calculateMemoryStats(report.metrics.memory);
      console.log(`\n${this.colors.blue}💾 Memory Statistics:${this.colors.reset}`);
      console.log(`   Peak heap: ${Math.round(memoryStats.peakHeap / 1024 / 1024)}MB`);
      console.log(`   Average heap: ${Math.round(memoryStats.avgHeap / 1024 / 1024)}MB`);
      console.log(`   Peak RSS: ${Math.round(memoryStats.peakRss / 1024 / 1024)}MB`);
    }
    
    console.log('='.repeat(60) + '\n');
  }

  calculateMemoryStats(memoryData) {
    if (memoryData.length === 0) return {};
    
    const heapValues = memoryData.map(m => m.process.heapUsed);
    const rssValues = memoryData.map(m => m.process.rss);
    
    return {
      peakHeap: Math.max(...heapValues),
      avgHeap: heapValues.reduce((a, b) => a + b, 0) / heapValues.length,
      peakRss: Math.max(...rssValues),
      avgRss: rssValues.reduce((a, b) => a + b, 0) / rssValues.length
    };
  }
}

// Build process wrapper with debugging
class DebugBuildProcess {
  constructor(debugTools) {
    this.debug = debugTools;
  }

  async runBuild(command = 'npm run build') {
    const stepIndex = await this.debug.startStep('build', `Running: ${command}`);
    
    try {
      const result = await this.executeCommand(command);
      await this.debug.endStep(stepIndex, { success: true, output: result });
      return result;
    } catch (error) {
      this.debug.logError(error, 'build process');
      await this.debug.endStep(stepIndex, { success: false, error: error.message });
      throw error;
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        if (this.debug.options.verbose) {
          console.log(data.toString().trim());
        }
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        if (this.debug.options.verbose) {
          console.error(data.toString().trim());
        }
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    profile: args.includes('--profile') || args.includes('-p'),
    memory: args.includes('--memory') || args.includes('-m'),
    trace: args.includes('--trace') || args.includes('-t'),
    saveIntermediate: args.includes('--save-intermediate'),
    outputFormat: args.includes('--html') ? 'html' : 'console',
    breakpoints: args.filter(arg => arg.startsWith('--break=')).map(arg => arg.split('=')[1])
  };
  
  const debugTools = new DebugTools(options);
  const buildProcess = new DebugBuildProcess(debugTools);
  
  try {
    await debugTools.startProfiling();
    
    // Run the specified command or default build
    const command = args.find(arg => !arg.startsWith('-')) || 'npm run build';
    
    debugTools.log('blue', `🚀 Starting debug session for: ${command}`);
    
    if (command.includes('build')) {
      await buildProcess.runBuild(command);
    } else {
      // Generic command execution
      const stepIndex = await debugTools.startStep('command', command);
      try {
        const result = await buildProcess.executeCommand(command);
        await debugTools.endStep(stepIndex, { success: true, output: result });
      } catch (error) {
        debugTools.logError(error, 'command execution');
        await debugTools.endStep(stepIndex, { success: false, error: error.message });
      }
    }
    
  } catch (error) {
    debugTools.logError(error, 'main process');
  } finally {
    await debugTools.stopProfiling();
    
    const report = await debugTools.generateReport();
    
    if (options.outputFormat === 'console' || options.outputFormat === 'both') {
      await debugTools.displayConsoleSummary(report);
    }
    
    process.exit(debugTools.session.errors.length > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Debug tools error:', error);
    process.exit(1);
  });
}

module.exports = {
  DebugTools,
  DebugBuildProcess
};
