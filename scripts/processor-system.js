/**
 * Custom Processor System
 * Enables custom content processing with chained processors
 */

const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

/**
 * Base Processor Class
 * All custom processors should extend this class
 */
class BaseProcessor {
  constructor(options = {}) {
    this.options = options;
    this.name = this.constructor.name;
    this.enabled = options.enabled !== false;
  }

  /**
   * Process content - must be implemented by subclasses
   * @param {string} content - The content to process
   * @param {object} metadata - Additional metadata
   * @returns {Promise<string>} - Processed content
   */
  async process(content, metadata) {
    throw new Error(`Process method not implemented in ${this.name}`);
  }

  /**
   * Validate processor configuration
   * @returns {boolean} - True if valid
   */
  validate() {
    return true;
  }

  /**
   * Get processor information
   * @returns {object} - Processor info
   */
  getInfo() {
    return {
      name: this.name,
      enabled: this.enabled,
      options: this.options
    };
  }
}

/**
 * Processor Chain
 * Manages and executes processors in sequence
 */
class ProcessorChain {
  constructor() {
    this.processors = [];
    this.errorHandlers = [];
  }

  /**
   * Add a processor to the chain
   * @param {BaseProcessor} processor - Processor instance
   * @param {number} priority - Processing order (lower = earlier)
   */
  addProcessor(processor, priority = 100) {
    if (!(processor instanceof BaseProcessor)) {
      throw new Error('Processor must extend BaseProcessor');
    }

    this.processors.push({ processor, priority });
    this.processors.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a processor by name
   * @param {string} name - Processor name
   */
  removeProcessor(name) {
    this.processors = this.processors.filter(
      item => item.processor.name !== name
    );
  }

  /**
   * Add error handler
   * @param {Function} handler - Error handler function
   */
  addErrorHandler(handler) {
    this.errorHandlers.push(handler);
  }

  /**
   * Process content through all processors
   * @param {string} content - Content to process
   * @param {object} metadata - Additional metadata
   * @returns {Promise<string>} - Processed content
   */
  async process(content, metadata = {}) {
    let processedContent = content;
    const results = [];

    for (const { processor } of this.processors) {
      if (!processor.enabled) {
        continue;
      }

      try {
        const startTime = Date.now();
        processedContent = await processor.process(processedContent, metadata);
        const duration = Date.now() - startTime;

        results.push({
          processor: processor.name,
          duration,
          success: true
        });
      } catch (error) {
        // Handle errors
        for (const handler of this.errorHandlers) {
          handler(error, processor, metadata);
        }

        results.push({
          processor: processor.name,
          error: error.message,
          success: false
        });

        // Continue or throw based on configuration
        if (processor.options.failOnError) {
          throw error;
        }
      }
    }

    return {
      content: processedContent,
      results
    };
  }

  /**
   * Get all processors
   * @returns {Array} - List of processors
   */
  getProcessors() {
    return this.processors.map(({ processor, priority }) => ({
      ...processor.getInfo(),
      priority
    }));
  }
}

// Built-in Processors

/**
 * Include Processor
 * Handles file inclusion with {{include:path}} syntax
 */
class IncludeProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      basePath: process.cwd(),
      recursive: true,
      maxDepth: 5,
      ...options
    });
    this.depth = 0;
  }

  async process(content, metadata) {
    if (this.depth >= this.options.maxDepth) {
      throw new Error('Maximum include depth exceeded');
    }

    this.depth++;

    const regex = /\{\{include:(.+?)\}\}/g;
    const matches = Array.from(content.matchAll(regex));

    for (const match of matches) {
      const [fullMatch, filePath] = match;
      const resolvedPath = path.resolve(this.options.basePath, filePath.trim());

      try {
        let includedContent = await fs.readFile(resolvedPath, 'utf-8');

        // Process includes recursively if enabled
        if (this.options.recursive) {
          const result = await this.process(includedContent, {
            ...metadata,
            includedFrom: resolvedPath
          });
          includedContent = result;
        }

        content = content.replace(fullMatch, includedContent);
      } catch (error) {
        throw new Error(`Failed to include file '${filePath}': ${error.message}`);
      }
    }

    this.depth--;
    return content;
  }
}

/**
 * Variable Processor
 * Replaces variables with {{var:name}} syntax
 */
class VariableProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      variables: {},
      allowEnv: true,
      prefix: 'VAR_',
      ...options
    });
  }

  async process(content, metadata) {
    const regex = /\{\{var:(.+?)\}\}/g;

    return content.replace(regex, (match, varName) => {
      const name = varName.trim();

      // Check in provided variables
      if (this.options.variables[name] !== undefined) {
        return this.options.variables[name];
      }

      // Check in environment variables if allowed
      if (this.options.allowEnv) {
        const envName = this.options.prefix + name.toUpperCase();
        if (process.env[envName] !== undefined) {
          return process.env[envName];
        }
      }

      // Check in metadata
      if (metadata[name] !== undefined) {
        return metadata[name];
      }

      // Return original if not found
      return match;
    });
  }
}

/**
 * Code Block Processor
 * Enhanced code block processing with execution support
 */
class CodeBlockProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      languages: {
        javascript: true,
        python: false,
        bash: false
      },
      timeout: 5000,
      sandbox: true,
      ...options
    });
  }

  async process(content, metadata) {
    const regex = /```(\w+)(?::(\w+))?\n([\s\S]*?)```/g;
    const matches = Array.from(content.matchAll(regex));

    for (const match of matches) {
      const [fullMatch, language, directive, code] = match;

      if (directive === 'exec' && this.options.languages[language]) {
        try {
          const result = await this.executeCode(language, code);
          const output = `\`\`\`${language}\n${code}\`\`\`\n\n**Output:**\n\`\`\`\n${result}\n\`\`\``;
          content = content.replace(fullMatch, output);
        } catch (error) {
          const errorOutput = `\`\`\`${language}\n${code}\`\`\`\n\n**Error:**\n\`\`\`\n${error.message}\n\`\`\``;
          content = content.replace(fullMatch, errorOutput);
        }
      }
    }

    return content;
  }

  async executeCode(language, code) {
    if (language === 'javascript' && this.options.languages.javascript) {
      // Simple sandboxed execution for JavaScript
      const vm = require('vm');
      const sandbox = {
        console: {
          log: (...args) => args.join(' ')
        },
        result: null
      };

      const script = new vm.Script(`
        result = (function() {
          ${code}
        })();
      `);

      const context = vm.createContext(sandbox);
      script.runInContext(context, { timeout: this.options.timeout });

      return sandbox.result || 'No output';
    }

    throw new Error(`Execution not supported for language: ${language}`);
  }
}

/**
 * Link Processor
 * Transforms links based on rules
 */
class LinkProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      baseUrl: '',
      external: {
        target: '_blank',
        rel: 'noopener noreferrer'
      },
      transforms: [],
      ...options
    });
  }

  async process(content, metadata) {
    // Process markdown links
    content = content.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (match, text, url) => {
        const transformedUrl = this.transformUrl(url);
        const attributes = this.getLinkAttributes(transformedUrl);
        
        if (attributes) {
          return `<a href="${transformedUrl}"${attributes}>${text}</a>`;
        }
        
        return `[${text}](${transformedUrl})`;
      }
    );

    return content;
  }

  transformUrl(url) {
    // Apply custom transforms
    for (const transform of this.options.transforms) {
      if (transform.pattern && transform.pattern.test(url)) {
        url = url.replace(transform.pattern, transform.replacement);
      }
    }

    // Add base URL for relative links
    if (this.options.baseUrl && !url.match(/^https?:\/\//)) {
      url = this.options.baseUrl + url;
    }

    return url;
  }

  getLinkAttributes(url) {
    if (url.match(/^https?:\/\//) && this.options.external) {
      const attrs = [];
      if (this.options.external.target) {
        attrs.push(`target="${this.options.external.target}"`);
      }
      if (this.options.external.rel) {
        attrs.push(`rel="${this.options.external.rel}"`);
      }
      return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    }
    return '';
  }
}

/**
 * Metadata Processor
 * Extracts and processes front matter metadata
 */
class MetadataProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      extract: true,
      inject: true,
      template: null,
      ...options
    });
  }

  async process(content, metadata) {
    const matter = require('gray-matter');
    const parsed = matter(content);

    // Merge extracted metadata
    Object.assign(metadata, parsed.data);

    // Inject metadata if template provided
    if (this.options.inject && this.options.template) {
      const header = this.renderTemplate(this.options.template, metadata);
      content = header + '\n\n' + parsed.content;
    } else {
      content = parsed.content;
    }

    return content;
  }

  renderTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }
}

/**
 * Diagram Processor
 * Converts diagram code to images
 */
class DiagramProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      types: ['mermaid', 'plantuml', 'graphviz'],
      outputDir: 'assets/diagrams',
      format: 'svg',
      ...options
    });
  }

  async process(content, metadata) {
    for (const type of this.options.types) {
      const regex = new RegExp(`\`\`\`${type}\\n([\\s\\S]*?)\`\`\``, 'g');
      const matches = Array.from(content.matchAll(regex));

      for (const [fullMatch, diagramCode] of matches) {
        try {
          const diagramPath = await this.renderDiagram(type, diagramCode, metadata);
          const imageTag = `![${type} diagram](${diagramPath})`;
          content = content.replace(fullMatch, imageTag);
        } catch (error) {
          console.error(`Failed to render ${type} diagram:`, error);
          // Keep original code block on error
        }
      }
    }

    return content;
  }

  async renderDiagram(type, code, metadata) {
    // This is a placeholder - actual implementation would use
    // appropriate libraries for each diagram type
    const filename = `diagram-${Date.now()}.${this.options.format}`;
    const outputPath = path.join(this.options.outputDir, filename);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // In real implementation, render diagram here
    // For now, just save the code
    await fs.writeFile(outputPath, code, 'utf-8');

    return outputPath;
  }
}

/**
 * Table Processor
 * Enhanced table processing with CSV support
 */
class TableProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      csvDelimiter: ',',
      alignment: 'left',
      headers: true,
      ...options
    });
  }

  async process(content, metadata) {
    // Process CSV blocks
    const csvRegex = /```csv\n([\s\S]*?)```/g;
    
    content = content.replace(csvRegex, (match, csvContent) => {
      return this.csvToMarkdownTable(csvContent.trim());
    });

    return content;
  }

  csvToMarkdownTable(csv) {
    const lines = csv.split('\n');
    const delimiter = this.options.csvDelimiter;
    const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));

    if (rows.length === 0) return '';

    let table = '';

    // Headers
    if (this.options.headers) {
      table += '| ' + rows[0].join(' | ') + ' |\n';
      table += '|' + rows[0].map(() => '---').join('|') + '|\n';
      rows.shift();
    }

    // Data rows
    for (const row of rows) {
      table += '| ' + row.join(' | ') + ' |\n';
    }

    return table;
  }
}

// Factory for creating processors
class ProcessorFactory {
  static processors = {
    include: IncludeProcessor,
    variable: VariableProcessor,
    codeBlock: CodeBlockProcessor,
    link: LinkProcessor,
    metadata: MetadataProcessor,
    diagram: DiagramProcessor,
    table: TableProcessor
  };

  static register(name, ProcessorClass) {
    this.processors[name] = ProcessorClass;
  }

  static create(name, options) {
    const ProcessorClass = this.processors[name];
    if (!ProcessorClass) {
      throw new Error(`Unknown processor: ${name}`);
    }
    return new ProcessorClass(options);
  }

  static getAvailable() {
    return Object.keys(this.processors);
  }
}

module.exports = {
  BaseProcessor,
  ProcessorChain,
  ProcessorFactory,
  // Export built-in processors
  IncludeProcessor,
  VariableProcessor,
  CodeBlockProcessor,
  LinkProcessor,
  MetadataProcessor,
  DiagramProcessor,
  TableProcessor
};