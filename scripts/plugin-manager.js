#!/usr/bin/env node

/**
 * Plugin Manager CLI
 * Manage plugins for the book publishing template
 */

const fs = require('fs').promises;
const path = require('path');
const { PluginSystem } = require('./plugin-system');

// Available commands
const commands = {
  list: listPlugins,
  install: installPlugin,
  uninstall: uninstallPlugin,
  enable: enablePlugin,
  disable: disablePlugin,
  info: showPluginInfo,
  validate: validatePlugins,
  create: createPlugin
};

// Main CLI function
async function main() {
  const [command, ...args] = process.argv.slice(2);
  
  if (!command || command === 'help') {
    showHelp();
    return;
  }
  
  if (!commands[command]) {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
  
  try {
    await commands[command](...args);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Show help message
function showHelp() {
  console.log(`
📦 Plugin Manager for Book Publishing Template

Usage: npm run plugin <command> [options]

Commands:
  list                    List all available and installed plugins
  install <name>          Install a plugin
  uninstall <name>        Uninstall a plugin
  enable <name>           Enable a plugin
  disable <name>          Disable a plugin
  info <name>             Show detailed information about a plugin
  validate                Validate all enabled plugins
  create <name>           Create a new plugin template

Examples:
  npm run plugin list
  npm run plugin install toc-generator
  npm run plugin info syntax-highlighter
  npm run plugin create my-custom-plugin
`);
}

// List all plugins
async function listPlugins() {
  console.log('\n📋 Plugin Status\n');
  
  // Load configuration
  const config = await loadConfig();
  const enabledPlugins = config.plugins || [];
  
  // List built-in plugins
  console.log('Built-in Plugins:');
  const builtInPlugins = await getBuiltInPlugins();
  
  for (const plugin of builtInPlugins) {
    const enabled = enabledPlugins.some(p => 
      (typeof p === 'string' && p === plugin.name) ||
      (typeof p === 'object' && p.name === plugin.name)
    );
    
    const status = enabled ? '✅ Enabled' : '⭕ Available';
    console.log(`  ${status}  ${plugin.name} v${plugin.version} - ${plugin.description}`);
  }
  
  // List custom plugins
  const customPlugins = await getCustomPlugins();
  if (customPlugins.length > 0) {
    console.log('\nCustom Plugins:');
    for (const plugin of customPlugins) {
      const enabled = enabledPlugins.some(p => 
        (typeof p === 'string' && p === plugin.name) ||
        (typeof p === 'object' && p.name === plugin.name)
      );
      
      const status = enabled ? '✅ Enabled' : '⭕ Available';
      console.log(`  ${status}  ${plugin.name} v${plugin.version} - ${plugin.description}`);
    }
  }
  
  // Show enabled count
  const enabledCount = enabledPlugins.length;
  console.log(`\n📊 Total: ${enabledCount} plugin(s) enabled\n`);
}

// Install a plugin
async function installPlugin(pluginName) {
  if (!pluginName) {
    console.error('Please specify a plugin name');
    return;
  }
  
  console.log(`\n📥 Installing plugin: ${pluginName}\n`);
  
  // For now, we'll just enable built-in plugins
  // In the future, this could download from a registry
  
  const builtInPlugins = await getBuiltInPlugins();
  const plugin = builtInPlugins.find(p => p.name === pluginName);
  
  if (!plugin) {
    console.error(`Plugin '${pluginName}' not found in built-in plugins`);
    console.log('\nAvailable plugins:');
    builtInPlugins.forEach(p => console.log(`  - ${p.name}`));
    return;
  }
  
  // Enable the plugin
  await enablePlugin(pluginName);
}

// Uninstall a plugin
async function uninstallPlugin(pluginName) {
  if (!pluginName) {
    console.error('Please specify a plugin name');
    return;
  }
  
  console.log(`\n📤 Uninstalling plugin: ${pluginName}\n`);
  
  // Disable the plugin
  await disablePlugin(pluginName);
}

// Enable a plugin
async function enablePlugin(pluginName, options = {}) {
  if (!pluginName) {
    console.error('Please specify a plugin name');
    return;
  }
  
  const config = await loadConfig();
  const plugins = config.plugins || [];
  
  // Check if already enabled
  const existingIndex = plugins.findIndex(p => 
    (typeof p === 'string' && p === pluginName) ||
    (typeof p === 'object' && p.name === pluginName)
  );
  
  if (existingIndex >= 0) {
    console.log(`✅ Plugin '${pluginName}' is already enabled`);
    return;
  }
  
  // Add plugin to config
  if (Object.keys(options).length > 0) {
    plugins.push({ name: pluginName, options });
  } else {
    plugins.push(pluginName);
  }
  
  config.plugins = plugins;
  await saveConfig(config);
  
  console.log(`✅ Plugin '${pluginName}' has been enabled`);
  
  // Show plugin info
  await showPluginInfo(pluginName);
}

// Disable a plugin
async function disablePlugin(pluginName) {
  if (!pluginName) {
    console.error('Please specify a plugin name');
    return;
  }
  
  const config = await loadConfig();
  const plugins = config.plugins || [];
  
  // Find and remove plugin
  const newPlugins = plugins.filter(p => 
    !(typeof p === 'string' && p === pluginName) &&
    !(typeof p === 'object' && p.name === pluginName)
  );
  
  if (newPlugins.length === plugins.length) {
    console.log(`⚠️  Plugin '${pluginName}' is not enabled`);
    return;
  }
  
  config.plugins = newPlugins;
  await saveConfig(config);
  
  console.log(`✅ Plugin '${pluginName}' has been disabled`);
}

// Show plugin information
async function showPluginInfo(pluginName) {
  if (!pluginName) {
    console.error('Please specify a plugin name');
    return;
  }
  
  // Try to load the plugin
  const pluginSystem = new PluginSystem();
  
  try {
    await pluginSystem.loadPlugin(pluginName);
    const plugin = pluginSystem.getPlugin(pluginName);
    
    if (!plugin) {
      console.error(`Plugin '${pluginName}' not found`);
      return;
    }
    
    console.log(`\n📦 Plugin Information\n`);
    console.log(`Name:         ${plugin.name}`);
    console.log(`Version:      ${plugin.version}`);
    console.log(`Description:  ${plugin.description || 'N/A'}`);
    console.log(`Author:       ${plugin.author || 'N/A'}`);
    
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      console.log(`Dependencies: ${plugin.dependencies.join(', ')}`);
    }
    
    if (plugin.hooks) {
      console.log(`\nHooks:`);
      Object.keys(plugin.hooks).forEach(hook => {
        console.log(`  - ${hook}`);
      });
    }
    
    if (plugin.defaultOptions) {
      console.log(`\nDefault Options:`);
      console.log(JSON.stringify(plugin.defaultOptions, null, 2));
    }
    
    console.log('');
    
  } catch (error) {
    console.error(`Failed to load plugin '${pluginName}': ${error.message}`);
  }
}

// Validate all enabled plugins
async function validatePlugins() {
  console.log('\n🔍 Validating plugins...\n');
  
  const config = await loadConfig();
  const pluginSystem = new PluginSystem();
  
  const context = {
    config,
    srcDir: path.join(__dirname, '..', 'src'),
    publicDir: path.join(__dirname, '..', 'public')
  };
  
  await pluginSystem.initialize(context);
  
  const loadedPlugins = pluginSystem.getAllPlugins();
  
  if (loadedPlugins.length === 0) {
    console.log('No plugins are enabled');
    return;
  }
  
  console.log(`Found ${loadedPlugins.length} enabled plugin(s):\n`);
  
  // Validate each plugin
  let hasErrors = false;
  
  for (const plugin of loadedPlugins) {
    console.log(`Validating ${plugin.name}...`);
    
    // Check required properties
    const errors = [];
    
    if (!plugin.name) errors.push('Missing required property: name');
    if (!plugin.version) errors.push('Missing required property: version');
    
    // Check hooks are functions
    if (plugin.hooks) {
      for (const [hookName, handler] of Object.entries(plugin.hooks)) {
        if (typeof handler !== 'function') {
          errors.push(`Hook '${hookName}' is not a function`);
        }
      }
    }
    
    if (errors.length > 0) {
      console.log(`  ❌ ${plugin.name}: ${errors.length} error(s)`);
      errors.forEach(error => console.log(`     - ${error}`));
      hasErrors = true;
    } else {
      console.log(`  ✅ ${plugin.name}: Valid`);
    }
  }
  
  // Validate dependencies
  try {
    pluginSystem.validateDependencies();
    console.log('\n✅ All plugin dependencies are satisfied');
  } catch (error) {
    console.error(`\n❌ Dependency error: ${error.message}`);
    hasErrors = true;
  }
  
  if (hasErrors) {
    console.log('\n⚠️  Some plugins have validation errors');
    process.exit(1);
  } else {
    console.log('\n✅ All plugins validated successfully');
  }
}

// Create a new plugin template
async function createPlugin(pluginName) {
  if (!pluginName) {
    console.error('Please specify a plugin name');
    return;
  }
  
  const pluginDir = path.join(__dirname, '..', 'plugins', pluginName);
  
  // Check if already exists
  try {
    await fs.access(pluginDir);
    console.error(`Plugin directory already exists: ${pluginDir}`);
    return;
  } catch (error) {
    // Directory doesn't exist, continue
  }
  
  // Create plugin directory
  await fs.mkdir(pluginDir, { recursive: true });
  
  // Create plugin template
  const template = `/**
 * ${pluginName} Plugin
 * Description of what this plugin does
 */

module.exports = {
  name: '${pluginName}',
  version: '1.0.0',
  description: 'Your plugin description here',
  author: 'Your name',
  
  // Optional: Specify dependencies on other plugins
  // dependencies: ['other-plugin-name'],
  
  // Default configuration options
  defaultOptions: {
    // Add your default options here
    enabled: true
  },
  
  // Plugin hooks
  hooks: {
    // Build lifecycle hooks
    beforeBuild: async function(context) {
      // Called before the build starts
      context.api.log('${pluginName}: beforeBuild hook');
    },
    
    afterBuild: async function(context) {
      // Called after the build completes
      context.api.log('${pluginName}: afterBuild hook');
    },
    
    // Content processing hooks
    processContent: async function(content, context, metadata) {
      // Process markdown content
      // Return modified content or undefined to keep original
      return content;
    },
    
    // Asset processing hooks
    processAsset: async function(srcPath, destPath, context) {
      // Process asset files
      // Return srcPath to use default copy, or handle it yourself
      return srcPath;
    }
    
    // Add more hooks as needed...
  }
};
`;
  
  const pluginFile = path.join(pluginDir, 'index.js');
  await fs.writeFile(pluginFile, template, 'utf-8');
  
  // Create README
  const readmeContent = `# ${pluginName} Plugin

## Description

Describe what your plugin does here.

## Configuration

\`\`\`json
{
  "plugins": [
    {
      "name": "${pluginName}",
      "options": {
        "enabled": true
      }
    }
  ]
}
\`\`\`

## Available Hooks

- \`beforeBuild\`: Called before the build starts
- \`afterBuild\`: Called after the build completes
- \`processContent\`: Process markdown content
- \`processAsset\`: Process asset files

## Development

To test your plugin:

1. Enable it in \`book-config.json\`
2. Run \`npm run build:plugins\`
3. Check the output for your plugin's log messages
`;
  
  await fs.writeFile(path.join(pluginDir, 'README.md'), readmeContent, 'utf-8');
  
  console.log(`\n✅ Plugin template created at: ${pluginDir}`);
  console.log('\nNext steps:');
  console.log('1. Edit the plugin file to add your functionality');
  console.log(`2. Enable the plugin: npm run plugin enable ${pluginName}`);
  console.log('3. Test with: npm run build:plugins');
}

// Get built-in plugins
async function getBuiltInPlugins() {
  const pluginsDir = path.join(__dirname, '..', 'plugins');
  const plugins = [];
  
  try {
    const entries = await fs.readdir(pluginsDir);
    
    for (const entry of entries) {
      const pluginPath = path.join(pluginsDir, entry);
      
      try {
        let plugin;
        const stats = await fs.stat(pluginPath);
        
        if (stats.isDirectory()) {
          plugin = require(path.join(pluginPath, 'index.js'));
        } else if (entry.endsWith('.js')) {
          plugin = require(pluginPath);
        } else {
          continue;
        }
        
        if (plugin && plugin.name && plugin.version) {
          plugins.push({
            name: plugin.name,
            version: plugin.version,
            description: plugin.description || '',
            path: pluginPath
          });
        }
      } catch (error) {
        // Skip invalid plugins
      }
    }
  } catch (error) {
    // Plugins directory doesn't exist
  }
  
  return plugins;
}

// Get custom plugins (from node_modules)
async function getCustomPlugins() {
  // In the future, this could scan node_modules for book-plugin-* packages
  return [];
}

// Load configuration
async function loadConfig() {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {
      plugins: []
    };
  }
}

// Save configuration
async function saveConfig(config) {
  const configPath = path.join(__dirname, '..', 'book-config.json');
  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(configPath, content, 'utf-8');
}

// Run CLI
if (require.main === module) {
  main();
}

module.exports = {
  listPlugins,
  installPlugin,
  uninstallPlugin,
  enablePlugin,
  disablePlugin,
  showPluginInfo,
  validatePlugins,
  createPlugin
};