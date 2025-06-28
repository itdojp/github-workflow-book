/**
 * Glossary Processor
 * Automatically creates links to glossary terms
 */

const { BaseProcessor } = require('../scripts/processor-system');

class GlossaryProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      glossaryFile: 'glossary.json',
      linkClass: 'glossary-term',
      tooltip: true,
      caseSensitive: false,
      ...options
    });
    
    this.glossary = null;
  }

  async loadGlossary() {
    if (this.glossary) return;
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const glossaryPath = path.resolve(this.options.glossaryFile);
      const content = await fs.readFile(glossaryPath, 'utf-8');
      this.glossary = JSON.parse(content);
    } catch (error) {
      console.warn(`Failed to load glossary: ${error.message}`);
      this.glossary = {};
    }
  }

  async process(content, metadata) {
    await this.loadGlossary();
    
    // Process each term in the glossary
    for (const [term, definition] of Object.entries(this.glossary)) {
      const regex = this.createTermRegex(term);
      
      content = content.replace(regex, (match, before, termMatch, after) => {
        // Don't replace if already in a link or code
        if (this.isInSpecialContext(content, match)) {
          return match;
        }
        
        // Create glossary link
        const link = this.createGlossaryLink(termMatch, definition);
        return before + link + after;
      });
    }
    
    return content;
  }

  createTermRegex(term) {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = this.options.caseSensitive ? 'g' : 'gi';
    
    // Match term with word boundaries
    return new RegExp(`(^|\\s)(${escapedTerm})(\\s|$|[.,!?;:])`, flags);
  }

  isInSpecialContext(content, match) {
    const index = content.indexOf(match);
    
    // Check if in code block
    const beforeContent = content.substring(0, index);
    const codeBlockCount = (beforeContent.match(/```/g) || []).length;
    if (codeBlockCount % 2 === 1) return true;
    
    // Check if in inline code
    const lineStart = beforeContent.lastIndexOf('\n') + 1;
    const lineEnd = content.indexOf('\n', index);
    const line = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd);
    
    const beforeInLine = line.substring(0, index - lineStart);
    const inlineCodeCount = (beforeInLine.match(/`/g) || []).length;
    if (inlineCodeCount % 2 === 1) return true;
    
    // Check if already in a link
    const linkRegex = /\[([^\]]+)\]\([^)]+\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      if (index >= linkMatch.index && index < linkMatch.index + linkMatch[0].length) {
        return true;
      }
    }
    
    return false;
  }

  createGlossaryLink(term, definition) {
    if (this.options.tooltip) {
      // Create link with tooltip
      const escapedDefinition = definition.replace(/"/g, '&quot;');
      return `<abbr class="${this.options.linkClass}" title="${escapedDefinition}">${term}</abbr>`;
    } else {
      // Create simple link
      return `[${term}](#glossary-${this.slugify(term)})`;
    }
  }

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }
}

module.exports = GlossaryProcessor;