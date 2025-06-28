#!/usr/bin/env node

/**
 * Watch Mode Implementation
 * File change monitoring with automatic rebuilds and live reload
 */

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');

class WatchMode {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3000,
      wsPort: options.wsPort || 3001,
      srcDir: options.srcDir || 'src',
      publicDir: options.publicDir || 'public',
      startServer: options.startServer || false,
      debounceDelay: options.debounceDelay || 300,
      verbose: options.verbose || false,
      ignored: options.ignored || ['node_modules', '.git', '.DS_Store', '*.swp', '*.tmp']
    };
    
    this.watcher = null;
    this.wsServer = null;
    this.clients = new Set();
    this.buildQueue = new Map();
    this.rebuildTimer = null;
    this.isBuilding = false;
    this.buildCount = 0;
    this.buildCache = new Map();
    
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
    const color = this.colors[level] || this.colors.reset;
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(`${this.colors.cyan}[${timestamp}]${this.colors.reset} ${color}${message}${this.colors.reset}`);
  }

  async init() {
    this.log('blue', '🔍 Starting watch mode...');
    
    // Ensure initial build
    await this.initialBuild();
    
    // Start WebSocket server
    await this.startWebSocketServer();
    
    // Start file watcher
    this.startWatching();
    
    // Start development server if requested
    if (this.options.startServer) {
      await this.startDevServer();
    }
    
    this.log('green', '✅ Watch mode ready');
    this.log('cyan', `   👀 Watching: ${this.options.srcDir}`);
    this.log('cyan', `   🌐 WebSocket: ws://localhost:${this.options.wsPort}`);
    if (this.options.startServer) {
      this.log('cyan', `   🎉 Dev server: http://localhost:${this.options.port}`);
    }
  }

  async initialBuild() {
    this.log('blue', '🔨 Running initial build...');
    
    try {
      await this.runBuild('full');
      this.log('green', '✅ Initial build complete');
    } catch (error) {
      this.log('red', `❌ Initial build failed: ${error.message}`);
      throw error;
    }
  }

  startWatching() {
    const watchPaths = [
      `${this.options.srcDir}/**/*.md`,
      `${this.options.srcDir}/**/*.yml`,
      `${this.options.srcDir}/**/*.yaml`,
      `${this.options.srcDir}/**/*.json`,
      'book-config.json',
      'package.json'
    ];
    
    this.watcher = chokidar.watch(watchPaths, {
      ignored: this.options.ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });
    
    this.watcher
      .on('add', path => this.handleFileChange('add', path))
      .on('change', path => this.handleFileChange('change', path))
      .on('unlink', path => this.handleFileChange('unlink', path))
      .on('error', error => this.log('red', `Watcher error: ${error}`));
    
    // Handle process termination
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  handleFileChange(event, filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    
    this.log('yellow', `📄 ${event}: ${relativePath}`);
    
    // Add to build queue
    this.buildQueue.set(filePath, {
      event,
      path: filePath,
      relativePath,
      timestamp: Date.now()
    });
    
    // Debounce rebuilds
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
    }
    
    this.rebuildTimer = setTimeout(() => {
      this.processBuildQueue();
    }, this.options.debounceDelay);
  }

  async processBuildQueue() {
    if (this.isBuilding || this.buildQueue.size === 0) {
      return;
    }
    
    this.isBuilding = true;
    this.buildCount++;
    
    const changes = Array.from(this.buildQueue.values());
    this.buildQueue.clear();
    
    this.log('blue', `🔄 Build #${this.buildCount} - Processing ${changes.length} changes...`);
    
    try {
      // Determine build type
      const buildType = this.determineBuildType(changes);
      
      // Track build time
      const startTime = Date.now();
      
      // Run appropriate build
      if (buildType === 'incremental') {
        await this.runIncrementalBuild(changes);
      } else {
        await this.runBuild('full');
      }
      
      const buildTime = Date.now() - startTime;
      this.log('green', `✅ Build complete in ${buildTime}ms`);
      
      // Notify connected clients
      this.notifyClients('reload');
      
    } catch (error) {
      this.log('red', `❌ Build failed: ${error.message}`);
      this.notifyClients('error', { message: error.message });
    } finally {
      this.isBuilding = false;
    }
  }

  determineBuildType(changes) {
    // Check if any structural changes require full rebuild
    const requiresFullRebuild = changes.some(change => {
      return (
        change.event === 'unlink' ||
        change.path.includes('book-config.json') ||
        change.path.includes('package.json') ||
        change.path.match(/chapters?\/.*\/index\.md$/)
      );
    });
    
    return requiresFullRebuild ? 'full' : 'incremental';
  }

  async runBuild(type = 'full') {
    return new Promise((resolve, reject) => {
      const buildCommand = type === 'full' ? 'build' : 'build:incremental';
      const build = spawn('npm', ['run', buildCommand], {
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      if (!this.options.verbose) {
        build.stdout?.on('data', data => stdout += data);
        build.stderr?.on('data', data => stderr += data);
      }
      
      build.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Build failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  async runIncrementalBuild(changes) {
    // For now, delegate to the incremental build script
    // In the future, this could be optimized further
    await this.runBuild('incremental');
    
    // Update build cache
    for (const change of changes) {
      if (change.event === 'unlink') {
        this.buildCache.delete(change.path);
      } else {
        this.buildCache.set(change.path, {
          timestamp: Date.now(),
          hash: await this.getFileHash(change.path)
        });
      }
    }
  }

  async getFileHash(filePath) {
    try {
      const crypto = require('crypto');
      const content = await fs.readFile(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      return null;
    }
  }

  async startWebSocketServer() {
    this.wsServer = new WebSocket.Server({ port: this.options.wsPort });
    
    this.wsServer.on('connection', (ws) => {
      this.clients.add(ws);
      this.log('cyan', `🔌 Client connected (${this.clients.size} total)`);
      
      // Send initial connection message
      ws.send(JSON.stringify({ type: 'connected', buildCount: this.buildCount }));
      
      ws.on('close', () => {
        this.clients.delete(ws);
        this.log('cyan', `🔌 Client disconnected (${this.clients.size} total)`);
      });
      
      ws.on('error', (error) => {
        this.log('red', `WebSocket error: ${error.message}`);
      });
    });
    
    // Inject live reload script into HTML files
    await this.injectLiveReloadScript();
  }

  notifyClients(type, data = {}) {
    const message = JSON.stringify({
      type,
      timestamp: Date.now(),
      buildCount: this.buildCount,
      ...data
    });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  async injectLiveReloadScript() {
    const liveReloadScript = `
<!-- Live Reload Script -->
<script>
(function() {
  const ws = new WebSocket('ws://localhost:${this.options.wsPort}');
  let reconnectTimer = null;
  
  ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    if (data.type === 'reload') {
      console.log('Live reload: Reloading page...');
      location.reload();
    } else if (data.type === 'error') {
      console.error('Build error:', data.message);
    }
  };
  
  ws.onclose = function() {
    console.log('Live reload: Connection lost. Attempting to reconnect...');
    reconnectTimer = setInterval(function() {
      const testWs = new WebSocket('ws://localhost:${this.options.wsPort}');
      testWs.onopen = function() {
        clearInterval(reconnectTimer);
        location.reload();
      };
    }, 1000);
  };
  
  ws.onerror = function(error) {
    console.error('Live reload error:', error);
  };
})();
</script>
`;
    
    // Find all HTML files in public directory
    const glob = require('glob');
    const htmlFiles = glob.sync(`${this.options.publicDir}/**/*.html`);
    
    for (const htmlFile of htmlFiles) {
      try {
        let content = await fs.readFile(htmlFile, 'utf-8');
        
        // Skip if already injected
        if (content.includes('Live Reload Script')) {
          continue;
        }
        
        // Inject before closing body tag
        content = content.replace('</body>', `${liveReloadScript}</body>`);
        await fs.writeFile(htmlFile, content);
        
      } catch (error) {
        this.log('yellow', `Failed to inject live reload into ${htmlFile}: ${error.message}`);
      }
    }
  }

  async startDevServer() {
    // Start the HTTP server using npx http-server
    const server = spawn('npx', ['http-server', this.options.publicDir, '-p', this.options.port], {
      stdio: 'inherit'
    });
    
    server.on('error', (error) => {
      this.log('red', `Dev server error: ${error.message}`);
    });
    
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async cleanup() {
    this.log('yellow', '\n🚫 Shutting down watch mode...');
    
    // Close file watcher
    if (this.watcher) {
      await this.watcher.close();
    }
    
    // Close WebSocket connections
    this.clients.forEach(client => client.close());
    
    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    this.log('green', '👋 Watch mode stopped');
    process.exit(0);
  }

  // Advanced features
  async getChangedFiles(since) {
    const changed = [];
    
    for (const [filePath, cache] of this.buildCache.entries()) {
      if (cache.timestamp > since) {
        changed.push(filePath);
      }
    }
    
    return changed;
  }

  getBuildStats() {
    return {
      buildCount: this.buildCount,
      cachedFiles: this.buildCache.size,
      connectedClients: this.clients.size,
      queuedChanges: this.buildQueue.size,
      isBuilding: this.isBuilding
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    startServer: args.includes('--server') || args.includes('-s'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    port: parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000'),
    wsPort: parseInt(args.find(arg => arg.startsWith('--ws-port='))?.split('=')[1] || '3001'),
    srcDir: args.find(arg => arg.startsWith('--src='))?.split('=')[1] || 'src',
    publicDir: args.find(arg => arg.startsWith('--public='))?.split('=')[1] || 'public'
  };
  
  const watcher = new WatchMode(options);
  
  try {
    await watcher.init();
    
    // Keep process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('Watch mode failed to start:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Watch mode error:', error);
    process.exit(1);
  });
}

module.exports = { WatchMode };
