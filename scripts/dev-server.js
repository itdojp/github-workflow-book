#!/usr/bin/env node

/**
 * 開発サーバー - ホットリロード機能付き
 * ファイル変更を監視し、自動的にビルドとブラウザ更新を行う
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const chokidar = require('chokidar');
const WebSocket = require('ws');

// 設定
let CONFIG = {
  port: 8080,
  wsPort: 8081,
  publicDir: path.join(__dirname, '..', 'public'),
  srcDir: path.join(__dirname, '..', 'src'),
  watchPaths: [
    path.join(__dirname, '..', 'src'),
    path.join(__dirname, '..', '_layouts'),
    path.join(__dirname, '..', '_config.yml'),
    path.join(__dirname, '..', 'index.md'),
    path.join(__dirname, '..', 'README.md'),
    path.join(__dirname, '..', 'assets')
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/public/**',
    '**/.git/**',
    '**/.build-meta.json'
  ],
  debounceDelay: 100,
  enabled: true
};

// 設定ファイルの読み込み
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    if (userConfig.hotReload) {
      CONFIG = {
        ...CONFIG,
        ...userConfig.hotReload,
        // パスは絶対パスに変換
        watchPaths: userConfig.hotReload.watchPaths?.map(p => 
          path.join(__dirname, '..', p)
        ) || CONFIG.watchPaths
      };
    }
  } catch (error) {
    console.warn('book-config.json not found or invalid, using default hot reload configuration');
  }
}

class HotReloadServer {
  constructor() {
    this.clients = new Set();
    this.buildInProgress = false;
    this.pendingBuild = false;
    this.buildQueue = [];
  }

  async start() {
    console.log('🔥 Starting development server with hot reload...\n');

    // 設定の読み込み
    await loadConfig();
    
    if (!CONFIG.enabled) {
      console.log('🚫 Hot reload is disabled in configuration');
      return;
    }

    // 初期ビルド
    await this.runBuild();

    // WebSocketサーバーの開始
    this.startWebSocketServer();

    // HTTPサーバーの開始
    this.startHttpServer();

    // ファイル監視の開始
    this.startFileWatcher();

    console.log(`🌐 Server running at http://localhost:${CONFIG.port}`);
    console.log(`🔌 WebSocket server running at ws://localhost:${CONFIG.wsPort}`);
    console.log('👀 Watching for file changes...\n');
    console.log('📱 For multi-device testing:');
    console.log(`   - Local network: http://[your-ip]:${CONFIG.port}`);
    console.log(`   - Use your computer's IP address for mobile/tablet testing`);
    console.log('\n💡 Hot reload features:');
    console.log('   ✅ Automatic page refresh on file changes');
    console.log('   ✅ Build error notifications');
    console.log('   ✅ Build status indicators');
    console.log('   ✅ WebSocket reconnection on disconnect');
    console.log('\nPress Ctrl+C to stop');
  }

  isLocalEnvironment(req) {
    const host = req.headers.host || '';
    return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
  }

  startWebSocketServer() {
    this.wss = new WebSocket.Server({ port: CONFIG.wsPort });
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log(`📱 Client connected (${this.clients.size} total)`);
      
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`📱 Client disconnected (${this.clients.size} total)`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  startHttpServer() {
    const server = http.createServer(async (req, res) => {
      try {
        await this.handleRequest(req, res);
      } catch (error) {
        console.error('Server error:', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    server.listen(CONFIG.port, () => {
      console.log(`🚀 HTTP server started on port ${CONFIG.port}`);
    });
  }

  async handleRequest(req, res) {
    let urlPath = req.url === '/' ? '/index' : req.url;
    
    // Remove query parameters
    const urlWithoutQuery = urlPath.split('?')[0];
    
    // For Jekyll-style routing, try multiple file extensions
    const tryPaths = [];
    
    if (urlWithoutQuery.endsWith('/')) {
      const basePath = urlWithoutQuery.slice(0, -1);
      tryPaths.push(path.join(CONFIG.publicDir, basePath, 'index.html'));
      tryPaths.push(path.join(CONFIG.publicDir, basePath, 'index.md'));
      tryPaths.push(path.join(CONFIG.publicDir, basePath + '.html'));
      tryPaths.push(path.join(CONFIG.publicDir, basePath + '.md'));
    } else if (!path.extname(urlWithoutQuery)) {
      tryPaths.push(path.join(CONFIG.publicDir, urlWithoutQuery + '.html'));
      tryPaths.push(path.join(CONFIG.publicDir, urlWithoutQuery + '.md'));
      tryPaths.push(path.join(CONFIG.publicDir, urlWithoutQuery, 'index.html'));
      tryPaths.push(path.join(CONFIG.publicDir, urlWithoutQuery, 'index.md'));
    } else {
      tryPaths.push(path.join(CONFIG.publicDir, urlWithoutQuery));
    }
    
    // Try to find the file
    for (const tryPath of tryPaths) {
      try {
        const stats = await fs.stat(tryPath);
        
        if (stats.isFile()) {
          const content = await fs.readFile(tryPath, 'utf-8');
          const ext = path.extname(tryPath).toLowerCase();
          
          if (ext === '.md') {
            // Convert Markdown to HTML using Jekyll-style layout
            const htmlContent = await this.convertMarkdownToHtml(content, tryPath);
            if (CONFIG.enabled) {
              const hotReloadScript = this.getHotReloadScript();
              const modifiedContent = htmlContent.replace('</body>', `${hotReloadScript}\n</body>`);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(modifiedContent);
            } else {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(htmlContent);
            }
            return;
          } else if (ext === '.html') {
            // HTML file - inject hot reload script
            if (CONFIG.enabled) {
              const hotReloadScript = this.getHotReloadScript();
              const modifiedContent = content.replace('</body>', `${hotReloadScript}\n</body>`);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(modifiedContent);
            } else {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(content);
            }
            return;
          } else {
            // Other files (CSS, JS, images, etc.)
            const mimeTypes = {
              '.css': 'text/css',
              '.js': 'application/javascript',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml'
            };
            
            const mimeType = mimeTypes[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mimeType);
            res.end(content);
            return;
          }
        }
      } catch (error) {
        // Continue to next path
        continue;
      }
    }
    
    // If no file found, return 404
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>404 - Page Not Found</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; }
          h1 { color: #333; }
        </style>
      </head>
      <body>
        <h1>404 - Page Not Found</h1>
        <p>The requested page could not be found.</p>
        <p><a href="/">Return to Home</a></p>
        ${CONFIG.enabled ? this.getHotReloadScript() : ''}
      </body>
      </html>
    `);
  }

  async convertMarkdownToHtml(markdown, filePath) {
    // Read the Jekyll layout
    const layoutPath = path.join(CONFIG.publicDir, '_layouts', 'default.html');
    
    try {
      const layoutContent = await fs.readFile(layoutPath, 'utf-8');
      
      // Simple Markdown to HTML conversion (basic implementation)
      let htmlContent = markdown
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
        .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[h1-6]|<ul|<blockquote|<li)(.+)$/gm, '<p>$1</p>')
        .replace(/<p><\/p>/g, '');
      
      // Replace {{ content }} in layout with our HTML
      const finalHtml = layoutContent
        .replace(/{{ content }}/, htmlContent)
        .replace(/{{ site\.title }}/g, 'Development Preview')
        .replace(/{{ site\.description }}/g, 'Hot Reload Development Server')
        .replace(/{{ site\.author\.name }}/g, 'Author')
        .replace(/{{ site\.author\.github }}/g, 'github')
        .replace(/{{ site\.author\.email }}/g, 'email@example.com')
        .replace(/{{ '\/([^']+)' \| relative_url }}/g, '/$1');
      
      return finalHtml;
    } catch (error) {
      // Fallback to basic HTML structure if layout is not found
      return `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Development Preview</title>
          <style>
            body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
            h1, h2, h3, h4, h5, h6 { color: #333; }
            code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
            blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 20px; color: #666; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
            ul, ol { padding-left: 20px; }
          </style>
        </head>
        <body>
          <main>
            ${markdown.replace(/\n/g, '<br>')}
          </main>
        </body>
        </html>
      `;
    }
  }

  getHotReloadScript() {
    return `
    <script>
      (function() {
        if (!window.location.hostname === 'localhost' && !window.location.hostname === '127.0.0.1') {
          return; // ローカル環境でのみ動作
        }
        
        let ws;
        let reconnectTimeout;
        let isReconnecting = false;
        
        function connect() {
          ws = new WebSocket('ws://localhost:${CONFIG.wsPort}');
          
          ws.onopen = function() {
            console.log('🔥 Hot reload connected');
            isReconnecting = false;
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = null;
            }
          };
          
          ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'reload') {
              console.log('🔄 Reloading page...');
              // Add a small delay to ensure build is complete
              setTimeout(() => {
                window.location.reload();
              }, 100);
            } else if (data.type === 'error') {
              console.error('❌ Build error:', data.message);
              showErrorNotification(data.message);
            } else if (data.type === 'build-start') {
              console.log('🔨 Build started...');
              showBuildNotification('🔨 Building...');
            } else if (data.type === 'build-success') {
              console.log('✅ Build completed');
              showBuildNotification('✅ Build completed', 'success');
              setTimeout(hideBuildNotification, 1000);
            }
          };
          
          ws.onclose = function() {
            if (!isReconnecting) {
              console.log('🔌 Hot reload disconnected, attempting to reconnect...');
              isReconnecting = true;
              reconnectTimeout = setTimeout(connect, 1000);
            }
          };
          
          ws.onerror = function(error) {
            console.error('❌ WebSocket error:', error);
          };
        }
        
        function showErrorNotification(message) {
          const notification = document.createElement('div');
          notification.id = 'hot-reload-error';
          notification.style.cssText = \`
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 400px;
            font-family: monospace;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          \`;
          notification.innerHTML = \`
            <div style="font-weight: bold; margin-bottom: 5px;">❌ Build Error</div>
            <div style="font-size: 12px;">\${message}</div>
            <button onclick="this.parentElement.remove()" style="
              background: none;
              border: 1px solid white;
              color: white;
              padding: 5px 10px;
              margin-top: 10px;
              border-radius: 3px;
              cursor: pointer;
            ">Close</button>
          \`;
          
          // 既存のエラー通知を削除
          const existing = document.getElementById('hot-reload-error');
          if (existing) {
            existing.remove();
          }
          
          document.body.appendChild(notification);
        }
        
        function showBuildNotification(message, type = 'info') {
          const notification = document.createElement('div');
          notification.id = 'hot-reload-build';
          const bgColor = type === 'success' ? '#28a745' : '#007bff';
          notification.style.cssText = \`
            position: fixed;
            top: 20px;
            left: 20px;
            background: \${bgColor};
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            font-family: monospace;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
          \`;
          notification.textContent = message;
          
          // Remove existing notification
          const existing = document.getElementById('hot-reload-build');
          if (existing) {
            existing.remove();
          }
          
          document.body.appendChild(notification);
        }
        
        function hideBuildNotification() {
          const notification = document.getElementById('hot-reload-build');
          if (notification) {
            notification.remove();
          }
        }
        
        connect();
      })();
    </script>`;
  }

  startFileWatcher() {
    const watcher = chokidar.watch(CONFIG.watchPaths, {
      ignored: CONFIG.ignorePatterns,
      persistent: true,
      ignoreInitial: true
    });

    let debounceTimer;

    const handleChange = (event, filePath) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        console.log(`📝 File ${event}: ${path.relative(process.cwd(), filePath)}`);
        await this.handleFileChange(filePath);
      }, CONFIG.debounceDelay);
    };

    watcher
      .on('change', (filePath) => handleChange('changed', filePath))
      .on('add', (filePath) => handleChange('added', filePath))
      .on('unlink', (filePath) => handleChange('removed', filePath))
      .on('error', (error) => console.error('❌ Watcher error:', error));
  }

  async handleFileChange(filePath) {
    if (this.buildInProgress) {
      this.pendingBuild = true;
      return;
    }

    this.broadcastMessage({ type: 'build-start' });
    
    try {
      await this.runBuild();
      this.broadcastMessage({ type: 'build-success' });
      this.broadcastMessage({ type: 'reload' });
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      this.broadcastMessage({ 
        type: 'error', 
        message: error.message 
      });
    }

    // 保留中のビルドがあれば実行
    if (this.pendingBuild) {
      this.pendingBuild = false;
      setTimeout(() => this.handleFileChange(filePath), 100);
    }
  }

  async runBuild() {
    this.buildInProgress = true;
    
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('node', ['scripts/build-incremental.js'], {
        cwd: path.join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      buildProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data); // Show build output in real-time
      });

      buildProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data); // Show build errors in real-time
      });

      buildProcess.on('close', (code) => {
        this.buildInProgress = false;
        if (code === 0) {
          resolve();
        } else {
          const errorMessage = stderr || `Build process exited with code ${code}`;
          reject(new Error(errorMessage));
        }
      });

      buildProcess.on('error', (error) => {
        this.buildInProgress = false;
        reject(error);
      });
    });
  }

  broadcastMessage(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}

// サーバー起動
if (require.main === module) {
  const server = new HotReloadServer();
  
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down development server...');
    process.exit(0);
  });
  
  server.start().catch(error => {
    console.error('❌ Failed to start development server:', error);
    process.exit(1);
  });
}

module.exports = HotReloadServer;