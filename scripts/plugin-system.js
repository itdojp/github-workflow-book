/**
 * Plugin System for Book Publishing Template
 * Provides extensibility through a hook-based plugin architecture
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const vm = require('vm');

class PluginSystem extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.hooks = new Map();
    this.context = null;
    this.sandbox = null;
  }

  /**
   * Initialize the plugin system with build context
   */
  async initialize(context) {
    this.context = {
      ...context,
      api: this.createPluginAPI()
    };
    
    // Create sandboxed environment for plugins
    this.sandbox = {
      console: console,
      Buffer: Buffer,
      process: {
        env: process.env,
        version: process.version,
        platform: process.platform
      },
      require: this.createSafeRequire()
    };
    
    // Load plugins from configuration
    if (context.config && context.config.plugins) {
      await this.loadPlugins(context.config.plugins);
    }
  }

  /**
   * Create plugin API exposed to plugins
   */
  createPluginAPI() {
    return {
      // File system operations
      readFile: async (filePath) => {
        const fullPath = path.resolve(this.context.srcDir, filePath);
        return await fs.readFile(fullPath, 'utf-8');
      },
      
      writeFile: async (filePath, content) => {
        const fullPath = path.resolve(this.context.publicDir, filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        return await fs.writeFile(fullPath, content, 'utf-8');
      },
      
      // Utility functions
      glob: async (pattern, options = {}) => {
        const glob = require('glob');
        return new Promise((resolve, reject) => {
          glob(pattern, { cwd: this.context.srcDir, ...options }, (err, files) => {
            if (err) reject(err);
            else resolve(files);
          });
        });
      },
      
      // Markdown processing
      parseMarkdown: (content) => {
        const matter = require('gray-matter');
        return matter(content);
      },
      
      // Logging
      log: (message, ...args) => {
        console.log(`[Plugin] ${message}`, ...args);
      },
      
      error: (message, ...args) => {
        console.error(`[Plugin Error] ${message}`, ...args);
      }
    };
  }

  /**
   * Create a limited require function for plugins
   */
  createSafeRequire() {
    const allowedModules = [
      'path', 'url', 'querystring', 'string_decoder',
      'gray-matter', 'marked', 'cheerio', 'moment'
    ];
    
    return (moduleName) => {
      if (allowedModules.includes(moduleName)) {
        return require(moduleName);
      }
      throw new Error(`Module '${moduleName}' is not allowed in plugins`);
    };
  }

  /**
   * Load plugins from configuration
   */
  async loadPlugins(pluginConfigs) {
    for (const pluginConfig of pluginConfigs) {
      try {
        if (typeof pluginConfig === 'string') {
          // Load by name
          await this.loadPlugin(pluginConfig);
        } else if (typeof pluginConfig === 'object') {
          // Load with options
          await this.loadPlugin(pluginConfig.name, pluginConfig.options);
        }
      } catch (error) {
        console.error(`Failed to load plugin:`, error);
      }
    }
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(pluginName, options = {}) {
    try {
      let plugin;
      
      // Try to load from plugins directory first
      const pluginPaths = [
        path.join(__dirname, '..', 'plugins', pluginName),
        path.join(__dirname, '..', 'plugins', `${pluginName}.js`),
        path.join(__dirname, '..', 'node_modules', `book-plugin-${pluginName}`),
        pluginName // Absolute path or node_modules
      ];
      
      for (const pluginPath of pluginPaths) {
        try {
          // Check if it's a directory with index.js
          const stats = await fs.stat(pluginPath).catch(() => null);
          if (stats && stats.isDirectory()) {
            plugin = require(path.join(pluginPath, 'index.js'));
          } else {
            plugin = require(pluginPath);
          }
          break;
        } catch (error) {
          // Continue to next path
        }
      }
      
      if (!plugin) {
        throw new Error(`Plugin '${pluginName}' not found`);
      }
      
      // Validate plugin structure
      if (!plugin.name || !plugin.version) {
        throw new Error(`Invalid plugin structure for '${pluginName}'`);
      }
      
      // Initialize plugin
      const initializedPlugin = {
        ...plugin,
        options: { ...plugin.defaultOptions, ...options }
      };
      
      // Register plugin
      this.plugins.set(plugin.name, initializedPlugin);
      
      // Register hooks
      if (plugin.hooks) {
        for (const [hookName, handler] of Object.entries(plugin.hooks)) {
          this.registerHook(hookName, handler.bind(initializedPlugin));
        }
      }
      
      console.log(`✅ Loaded plugin: ${plugin.name} v${plugin.version}`);
      
    } catch (error) {
      throw new Error(`Failed to load plugin '${pluginName}': ${error.message}`);
    }
  }

  /**
   * Register a hook handler
   */
  registerHook(hookName, handler) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName).push(handler);
  }

  /**
   * Execute hook handlers
   */
  async executeHook(hookName, ...args) {
    const handlers = this.hooks.get(hookName) || [];
    
    for (const handler of handlers) {
      try {
        await handler(this.context, ...args);
      } catch (error) {
        console.error(`Error in hook '${hookName}':`, error);
      }
    }
  }

  /**
   * Execute hook handlers with transformation
   */
  async transformThroughHooks(hookName, initialValue, ...args) {
    const handlers = this.hooks.get(hookName) || [];
    let value = initialValue;
    
    for (const handler of handlers) {
      try {
        const result = await handler(value, this.context, ...args);
        if (result !== undefined) {
          value = result;
        }
      } catch (error) {
        console.error(`Error in transform hook '${hookName}':`, error);
      }
    }
    
    return value;
  }

  /**
   * Get plugin by name
   */
  getPlugin(name) {
    return this.plugins.get(name);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * Unload a plugin
   */
  unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    // Remove hooks
    if (plugin.hooks) {
      for (const hookName of Object.keys(plugin.hooks)) {
        const handlers = this.hooks.get(hookName) || [];
        this.hooks.set(
          hookName,
          handlers.filter(h => h !== plugin.hooks[hookName])
        );
      }
    }
    
    // Remove plugin
    this.plugins.delete(name);
    return true;
  }

  /**
   * Validate plugin dependencies
   */
  validateDependencies() {
    for (const plugin of this.plugins.values()) {
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!this.plugins.has(dep)) {
            throw new Error(
              `Plugin '${plugin.name}' requires '${dep}' which is not loaded`
            );
          }
        }
      }
    }
  }
}

// Plugin interface definition
const PluginInterface = {
  // Required properties
  name: 'string',
  version: 'string',
  
  // Optional properties
  description: 'string',
  author: 'string',
  dependencies: 'array',
  defaultOptions: 'object',
  
  // Hooks
  hooks: {
    // Build lifecycle hooks
    beforeBuild: 'function',
    afterBuild: 'function',
    
    // Content processing hooks
    beforeProcessFile: 'function',
    processContent: 'function',
    afterProcessFile: 'function',
    
    // Asset handling hooks
    processAsset: 'function',
    
    // Table of contents hooks
    beforeGenerateTOC: 'function',
    modifyTOC: 'function',
    
    // Output hooks
    beforeWrite: 'function',
    afterWrite: 'function'
  }
};

module.exports = { PluginSystem, PluginInterface };