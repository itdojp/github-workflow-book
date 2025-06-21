/**
 * Math Renderer Plugin
 * Renders mathematical equations using KaTeX or MathJax
 */

module.exports = {
  name: 'math-renderer',
  version: '1.0.0',
  description: 'Renders mathematical equations in LaTeX syntax',
  author: 'Book Publishing Template',
  
  defaultOptions: {
    engine: 'katex', // katex or mathjax
    delimiters: {
      inline: ['$', '$'],
      display: ['$$', '$$'],
      alternative: {
        inline: ['\\(', '\\)'],
        display: ['\\[', '\\]']
      }
    },
    throwOnError: false,
    errorColor: '#cc0000',
    macros: {
      '\\RR': '\\mathbb{R}',
      '\\NN': '\\mathbb{N}',
      '\\ZZ': '\\mathbb{Z}',
      '\\QQ': '\\mathbb{Q}',
      '\\CC': '\\mathbb{C}'
    }
  },
  
  hooks: {
    processContent: async function(content, context, metadata) {
      // Process display math first (to avoid conflicts with inline)
      content = this.processDisplayMath(content);
      content = this.processInlineMath(content);
      
      return content;
    },
    
    afterBuild: async function(context) {
      // Add math rendering scripts and styles
      const htmlSnippet = this.generateHtmlDependencies();
      
      // Save as a file that can be included
      await context.api.writeFile('assets/math-renderer.html', htmlSnippet);
      
      context.api.log('Math renderer dependencies saved to assets/math-renderer.html');
    }
  },
  
  // Process display math blocks
  processDisplayMath(content) {
    const options = this.options;
    
    // Process $$ ... $$ style
    const displayRegex = /\$\$([\s\S]*?)\$\$/g;
    content = content.replace(displayRegex, (match, math) => {
      return this.renderMath(math.trim(), true);
    });
    
    // Process \[ ... \] style
    const altDisplayRegex = /\\\[([\s\S]*?)\\\]/g;
    content = content.replace(altDisplayRegex, (match, math) => {
      return this.renderMath(math.trim(), true);
    });
    
    return content;
  },
  
  // Process inline math
  processInlineMath(content) {
    const options = this.options;
    
    // Process $ ... $ style (be careful not to match code blocks)
    const lines = content.split('\n');
    const processedLines = [];
    let inCodeBlock = false;
    
    for (const line of lines) {
      // Check for code block boundaries
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        processedLines.push(line);
        continue;
      }
      
      if (inCodeBlock || line.trim().startsWith('    ')) {
        processedLines.push(line);
        continue;
      }
      
      // Process inline math in this line
      let processedLine = line;
      
      // Match $ ... $ but not $$ (which is display math)
      processedLine = processedLine.replace(
        /(?<!\$)\$(?!\$)([^\$\n]+)\$(?!\$)/g,
        (match, math) => this.renderMath(math.trim(), false)
      );
      
      // Process \( ... \) style
      processedLine = processedLine.replace(
        /\\\(([^\\]+)\\\)/g,
        (match, math) => this.renderMath(math.trim(), false)
      );
      
      processedLines.push(processedLine);
    }
    
    return processedLines.join('\n');
  },
  
  // Render math based on engine
  renderMath(math, isDisplay) {
    const options = this.options;
    
    // Apply macros
    let processedMath = math;
    for (const [macro, replacement] of Object.entries(options.macros)) {
      processedMath = processedMath.replace(new RegExp(escapeRegex(macro), 'g'), replacement);
    }
    
    // Generate appropriate HTML based on engine
    if (options.engine === 'katex') {
      return this.renderKaTeX(processedMath, isDisplay);
    } else {
      return this.renderMathJax(processedMath, isDisplay);
    }
  },
  
  // Render with KaTeX style
  renderKaTeX(math, isDisplay) {
    const className = isDisplay ? 'math-display' : 'math-inline';
    const dataDisplay = isDisplay ? 'true' : 'false';
    
    // We'll let client-side KaTeX do the actual rendering
    return `<span class="${className}" data-math-display="${dataDisplay}">${escapeHtml(math)}</span>`;
  },
  
  // Render with MathJax style
  renderMathJax(math, isDisplay) {
    if (isDisplay) {
      return `\\[${math}\\]`;
    } else {
      return `\\(${math}\\)`;
    }
  },
  
  // Generate HTML dependencies
  generateHtmlDependencies() {
    const options = this.options;
    
    if (options.engine === 'katex') {
      return `
<!-- KaTeX -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>

<script>
document.addEventListener("DOMContentLoaded", function() {
  // Render math elements
  document.querySelectorAll('.math-inline, .math-display').forEach(function(elem) {
    const math = elem.textContent;
    const isDisplay = elem.getAttribute('data-math-display') === 'true';
    
    try {
      katex.render(math, elem, {
        displayMode: isDisplay,
        throwOnError: ${options.throwOnError},
        errorColor: '${options.errorColor}',
        macros: ${JSON.stringify(options.macros)}
      });
    } catch (e) {
      elem.innerHTML = '<span style="color: ${options.errorColor}">Error: ' + e.message + '</span>';
    }
  });
  
  // Also use auto-render for any missed math
  renderMathInElement(document.body, {
    delimiters: [
      {left: '$$', right: '$$', display: true},
      {left: '$', right: '$', display: false},
      {left: '\\\\[', right: '\\\\]', display: true},
      {left: '\\\\(', right: '\\\\)', display: false}
    ],
    throwOnError: ${options.throwOnError}
  });
});
</script>

<style>
.math-display {
  display: block;
  text-align: center;
  margin: 1em 0;
}
.math-inline {
  display: inline;
}
</style>
`;
    } else {
      return `
<!-- MathJax -->
<script>
MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
    processEscapes: true,
    processEnvironments: true,
    macros: ${JSON.stringify(options.macros)}
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
  }
};
</script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
`;
    }
  }
};

// Escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Escape HTML
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