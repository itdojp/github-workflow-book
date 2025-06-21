/**
 * Syntax Highlighter Plugin
 * Enhanced syntax highlighting for code blocks
 */

module.exports = {
  name: 'syntax-highlighter',
  version: '1.0.0',
  description: 'Provides enhanced syntax highlighting with line numbers and themes',
  author: 'Book Publishing Template',
  
  defaultOptions: {
    theme: 'github', // github, monokai, solarized, dracula
    lineNumbers: true,
    showLanguage: true,
    copyButton: true,
    wrapLongLines: false,
    highlightLines: [], // Array of line numbers to highlight
    startLineNumber: 1
  },
  
  hooks: {
    processContent: async function(content, context, metadata) {
      const options = this.options;
      
      // Process code blocks
      return content.replace(
        /```(\w+)?\n([\s\S]*?)```/g,
        (match, language, code) => {
          return this.highlightCode(code.trim(), language || 'text', options);
        }
      );
    },
    
    afterBuild: async function(context) {
      // Copy syntax highlighting CSS to output
      const cssContent = this.generateCSS(this.options.theme);
      const cssPath = 'assets/css/syntax-highlight.css';
      
      await context.api.writeFile(cssPath, cssContent);
      context.api.log(`Created syntax highlighting CSS at ${cssPath}`);
    }
  },
  
  // Highlight code with options
  highlightCode(code, language, options) {
    const lines = code.split('\n');
    const processedLines = [];
    
    // Add wrapper
    const classes = ['code-block', `language-${language}`, `theme-${options.theme}`];
    if (options.lineNumbers) classes.push('line-numbers');
    if (options.wrapLongLines) classes.push('wrap-lines');
    
    processedLines.push(`<div class="${classes.join(' ')}">`);
    
    // Add header if showing language
    if (options.showLanguage || options.copyButton) {
      processedLines.push('<div class="code-header">');
      if (options.showLanguage) {
        processedLines.push(`<span class="code-language">${language}</span>`);
      }
      if (options.copyButton) {
        processedLines.push('<button class="copy-button" onclick="copyCode(this)">Copy</button>');
      }
      processedLines.push('</div>');
    }
    
    // Add code content
    processedLines.push('<pre><code>');
    
    lines.forEach((line, index) => {
      const lineNumber = index + options.startLineNumber;
      const isHighlighted = options.highlightLines.includes(lineNumber);
      
      if (options.lineNumbers) {
        const lineClass = isHighlighted ? 'line highlighted' : 'line';
        processedLines.push(
          `<span class="${lineClass}"><span class="line-number">${lineNumber}</span>${escapeHtml(line)}</span>`
        );
      } else {
        const lineClass = isHighlighted ? 'highlighted' : '';
        processedLines.push(`<span class="${lineClass}">${escapeHtml(line)}</span>`);
      }
    });
    
    processedLines.push('</code></pre>');
    processedLines.push('</div>');
    
    // Add copy functionality script
    if (options.copyButton && !this._scriptAdded) {
      this._scriptAdded = true;
      processedLines.push(`
<script>
function copyCode(button) {
  const codeBlock = button.closest('.code-block').querySelector('code');
  const text = codeBlock.innerText;
  
  navigator.clipboard.writeText(text).then(() => {
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 2000);
  });
}
</script>
      `);
    }
    
    return processedLines.join('\n');
  },
  
  // Generate CSS for syntax highlighting
  generateCSS(theme) {
    const themes = {
      github: `
.code-block {
  margin: 1em 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #f1f3f5;
  border-bottom: 1px solid #e1e4e8;
}

.code-language {
  font-size: 12px;
  color: #586069;
  font-weight: 600;
}

.copy-button {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #e1e4e8;
  border-radius: 3px;
  background: white;
  cursor: pointer;
}

.copy-button:hover {
  background: #f3f4f6;
}

.code-block pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
}

.code-block code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.line {
  display: block;
}

.line-number {
  display: inline-block;
  width: 40px;
  color: #6e7781;
  text-align: right;
  padding-right: 16px;
  user-select: none;
}

.line.highlighted {
  background: #fff3cd;
  margin: 0 -16px;
  padding: 0 16px;
}
      `,
      
      monokai: `
.code-block.theme-monokai {
  background: #272822;
  border: none;
}

.code-block.theme-monokai .code-header {
  background: #3e3d32;
  border-bottom-color: #464741;
}

.code-block.theme-monokai .code-language {
  color: #f8f8f2;
}

.code-block.theme-monokai .copy-button {
  background: #3e3d32;
  color: #f8f8f2;
  border-color: #464741;
}

.code-block.theme-monokai code {
  color: #f8f8f2;
}

.code-block.theme-monokai .line-number {
  color: #75715e;
}

.code-block.theme-monokai .line.highlighted {
  background: #3e3d32;
}
      `,
      
      solarized: `
.code-block.theme-solarized {
  background: #fdf6e3;
  border-color: #eee8d5;
}

.code-block.theme-solarized .code-header {
  background: #eee8d5;
  border-bottom-color: #e5ddc8;
}

.code-block.theme-solarized .code-language {
  color: #657b83;
}

.code-block.theme-solarized code {
  color: #657b83;
}

.code-block.theme-solarized .line-number {
  color: #93a1a1;
}

.code-block.theme-solarized .line.highlighted {
  background: #eee8d5;
}
      `,
      
      dracula: `
.code-block.theme-dracula {
  background: #282a36;
  border: none;
}

.code-block.theme-dracula .code-header {
  background: #44475a;
  border-bottom: none;
}

.code-block.theme-dracula .code-language {
  color: #f8f8f2;
}

.code-block.theme-dracula .copy-button {
  background: #44475a;
  color: #f8f8f2;
  border-color: #6272a4;
}

.code-block.theme-dracula code {
  color: #f8f8f2;
}

.code-block.theme-dracula .line-number {
  color: #6272a4;
}

.code-block.theme-dracula .line.highlighted {
  background: #44475a;
}
      `
    };
    
    return themes[theme] || themes.github;
  }
};

// Escape HTML special characters
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, m => map[m]);
}