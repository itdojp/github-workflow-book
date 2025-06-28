/**
 * TOC Generator Plugin
 * Automatically generates and updates table of contents
 */

module.exports = {
  name: 'toc-generator',
  version: '1.0.0',
  description: 'Automatically generates table of contents with advanced features',
  author: 'Book Publishing Template',
  
  defaultOptions: {
    maxDepth: 3,
    includeNumbers: true,
    style: 'default', // default, compact, detailed
    position: 'top', // top, bottom, replace
    marker: '<!-- TOC -->',
    endMarker: '<!-- /TOC -->',
    skipFirst: false // Skip first heading (usually title)
  },
  
  hooks: {
    processContent: async function(content, context, metadata) {
      const options = this.options;
      
      // Check if content has TOC marker
      if (!content.includes(options.marker)) {
        return content;
      }
      
      // Extract headings
      const headings = extractHeadings(content, options);
      
      if (headings.length === 0) {
        return content;
      }
      
      // Generate TOC
      const toc = generateTOC(headings, options, metadata);
      
      // Replace or insert TOC
      if (content.includes(options.endMarker)) {
        // Replace existing TOC
        const regex = new RegExp(
          `${escapeRegex(options.marker)}[\\s\\S]*?${escapeRegex(options.endMarker)}`,
          'g'
        );
        return content.replace(regex, `${options.marker}\n${toc}\n${options.endMarker}`);
      } else {
        // Insert at marker position
        return content.replace(options.marker, `${options.marker}\n${toc}\n${options.endMarker}`);
      }
    },
    
    modifyTOC: async function(tocEntries, context) {
      // Add plugin-specific metadata to TOC entries
      return tocEntries.map(entry => ({
        ...entry,
        plugin: this.name,
        generated: true
      }));
    }
  }
};

// Extract headings from content
function extractHeadings(content, options) {
  const headings = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let headingIndex = 0;
  
  for (const line of lines) {
    // Check for code block boundaries
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    
    // Skip if in code block
    if (inCodeBlock) continue;
    
    // Check for heading
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      
      // Skip if exceeds max depth
      if (level > options.maxDepth) continue;
      
      // Skip first heading if option is set
      if (options.skipFirst && headingIndex === 0) {
        headingIndex++;
        continue;
      }
      
      headings.push({
        level,
        text,
        anchor: generateAnchor(text),
        index: headingIndex++
      });
    }
  }
  
  return headings;
}

// Generate table of contents
function generateTOC(headings, options, metadata) {
  const lines = [];
  
  // Add TOC title if specified
  if (options.title) {
    lines.push(`## ${options.title}`);
    lines.push('');
  }
  
  // Generate TOC based on style
  switch (options.style) {
    case 'compact':
      return generateCompactTOC(headings, options);
    case 'detailed':
      return generateDetailedTOC(headings, options, metadata);
    default:
      return generateDefaultTOC(headings, options);
  }
}

// Default TOC style
function generateDefaultTOC(headings, options) {
  const lines = [];
  let chapterNumber = 0;
  let sectionNumbers = [0, 0, 0, 0, 0, 0];
  
  for (const heading of headings) {
    const indent = '  '.repeat(heading.level - 1);
    let prefix = '';
    
    if (options.includeNumbers) {
      // Update section numbers
      sectionNumbers[heading.level - 1]++;
      for (let i = heading.level; i < 6; i++) {
        sectionNumbers[i] = 0;
      }
      
      // Generate number prefix
      const numbers = sectionNumbers.slice(0, heading.level).filter(n => n > 0);
      prefix = numbers.join('.') + '. ';
    }
    
    lines.push(`${indent}- [${prefix}${heading.text}](#${heading.anchor})`);
  }
  
  return lines.join('\n');
}

// Compact TOC style
function generateCompactTOC(headings, options) {
  const lines = [];
  
  // Group by top-level sections
  const sections = [];
  let currentSection = null;
  
  for (const heading of headings) {
    if (heading.level === 1) {
      currentSection = {
        heading,
        children: []
      };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.children.push(heading);
    }
  }
  
  // Generate compact list
  for (const section of sections) {
    lines.push(`**[${section.heading.text}](#${section.heading.anchor})**`);
    
    if (section.children.length > 0 && options.maxDepth > 1) {
      const childLinks = section.children
        .filter(h => h.level === 2)
        .map(h => `[${h.text}](#${h.anchor})`)
        .join(' • ');
      
      if (childLinks) {
        lines.push(`  ${childLinks}`);
      }
    }
    
    lines.push('');
  }
  
  return lines.join('\n').trim();
}

// Detailed TOC style
function generateDetailedTOC(headings, options, metadata) {
  const lines = [];
  
  // Add metadata if available
  if (metadata) {
    if (metadata.title) {
      lines.push(`# ${metadata.title}`);
    }
    if (metadata.author) {
      lines.push(`*By ${metadata.author}*`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  // Generate detailed TOC with descriptions
  for (const heading of headings) {
    const indent = '  '.repeat(heading.level - 1);
    
    // Main link
    lines.push(`${indent}- **[${heading.text}](#${heading.anchor})**`);
    
    // Add description if available (from heading text after colon)
    const colonIndex = heading.text.indexOf(':');
    if (colonIndex > 0) {
      const description = heading.text.substring(colonIndex + 1).trim();
      if (description) {
        lines.push(`${indent}  *${description}*`);
      }
    }
  }
  
  return lines.join('\n');
}

// Generate anchor from text
function generateAnchor(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

// Escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}