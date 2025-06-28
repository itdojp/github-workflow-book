/**
 * Streaming File Processor
 * Handles large file processing with memory efficiency
 */

const fs = require('fs');
const { createReadStream, createWriteStream } = require('fs');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const path = require('path');

class StreamingProcessor {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 64 * 1024; // 64KB chunks
    this.largeFileThreshold = options.largeFileThreshold || 1024 * 1024; // 1MB
  }

  /**
   * Check if file should be processed with streaming
   */
  async shouldUseStreaming(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size > this.largeFileThreshold;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create content cleaning transform stream
   */
  createCleaningTransform() {
    let buffer = '';
    let isFirstChunk = true;
    
    return new Transform({
      objectMode: false,
      transform(chunk, encoding, callback) {
        // Accumulate chunks to handle patterns that might span chunk boundaries
        buffer += chunk.toString();
        
        // Process complete sections (avoiding cutting in the middle of patterns)
        let processedContent = buffer;
        let lastCompleteSection = buffer.lastIndexOf('\n## ');
        
        if (lastCompleteSection > 0 && !isFirstChunk) {
          // Process up to the last complete section
          const contentToProcess = buffer.substring(0, lastCompleteSection);
          const cleanedContent = this.cleanContentChunk(contentToProcess);
          
          this.push(cleanedContent);
          
          // Keep the remaining part for next iteration
          buffer = buffer.substring(lastCompleteSection);
        } else if (buffer.length > this.chunkSize * 4) {
          // If buffer gets too large, process it anyway
          const cleanedContent = this.cleanContentChunk(buffer);
          this.push(cleanedContent);
          buffer = '';
        }
        
        isFirstChunk = false;
        callback();
      },
      
      flush(callback) {
        // Process remaining buffer
        if (buffer.length > 0) {
          const cleanedContent = this.cleanContentChunk(buffer);
          this.push(cleanedContent);
        }
        callback();
      }
    });
  }

  /**
   * Clean content chunk (partial processing safe)
   */
  cleanContentChunk(content) {
    // プライベートセクションの削除 (only if complete sections are found)
    content = content.replace(/<!--\s*private\s*-->([\s\S]*?)<!--\s*\/private\s*-->/gi, '');
    content = content.replace(/<!--\s*draft\s*-->([\s\S]*?)<!--\s*\/draft\s*-->/gi, '');
    
    // 解答セクションのサンプル化 (only process complete sections)
    content = content.replace(
      /(##\s*解答|##\s*Solutions?)([\s\S]*?)(?=##|\z)/gi,
      (match, heading, solutionContent) => {
        const lines = solutionContent.trim().split('\n');
        const sampleLines = lines.slice(0, 3);
        return `${heading}\n\n${sampleLines.join('\n')}\n\n<!-- 完全版は講師向け資料をご参照ください -->\n\n`;
      }
    );
    
    // 講師向けセクションの削除 (only process complete sections)
    content = content.replace(/##\s*講師向け[\s\S]*?(?=##|$)/g, '');
    content = content.replace(/##\s*Instructor[\s\S]*?(?=##|$)/g, '');
    
    return content;
  }

  /**
   * Create heading extraction transform stream
   */
  createHeadingExtractorTransform(filePath, sectionName, maxDepth = 3) {
    const headings = [];
    let lineNumber = 0;
    
    return new Transform({
      objectMode: false,
      transform(chunk, encoding, callback) {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          lineNumber++;
          const trimmedLine = line.trim();
          const match = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
          
          if (match) {
            const level = match[1].length;
            const title = match[2].trim();
            
            if (level <= maxDepth) {
              headings.push({
                level,
                title,
                filePath,
                sectionName,
                lineNumber,
                anchor: this.generateAnchor(title)
              });
            }
          }
        }
        
        // Pass through the content unchanged
        this.push(chunk);
        callback();
      },
      
      flush(callback) {
        // Emit headings as metadata
        this.emit('headings', headings);
        callback();
      }
    });
  }

  /**
   * Generate anchor for heading
   */
  generateAnchor(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  /**
   * Process large file with streaming
   */
  async processLargeFile(srcPath, destPath, sectionName, collectHeadings = false, maxDepth = 3) {
    try {
      // Ensure destination directory exists
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
      
      const readStream = createReadStream(srcPath, { 
        encoding: 'utf8',
        highWaterMark: this.chunkSize 
      });
      
      const writeStream = createWriteStream(destPath, { encoding: 'utf8' });
      
      const cleaningTransform = this.createCleaningTransform();
      let headings = [];
      
      if (collectHeadings) {
        const headingExtractor = this.createHeadingExtractorTransform(destPath, sectionName, maxDepth);
        
        headingExtractor.on('headings', (extractedHeadings) => {
          headings = extractedHeadings;
        });
        
        // Pipeline with heading extraction
        await pipeline(
          readStream,
          headingExtractor,
          cleaningTransform,
          writeStream
        );
      } else {
        // Pipeline without heading extraction
        await pipeline(
          readStream,
          cleaningTransform,
          writeStream
        );
      }
      
      const stats = await fs.promises.stat(destPath);
      
      return {
        type: 'success',
        srcPath,
        destPath,
        headings,
        size: stats.size,
        streamProcessed: true
      };
      
    } catch (error) {
      return {
        type: 'error',
        srcPath,
        destPath,
        error: {
          message: error.message,
          stack: error.stack
        },
        streamProcessed: true
      };
    }
  }

  /**
   * Process file (automatically choose streaming or regular based on size)
   */
  async processFile(srcPath, destPath, sectionName, collectHeadings = false, maxDepth = 3) {
    const useStreaming = await this.shouldUseStreaming(srcPath);
    
    if (useStreaming) {
      console.log(`📊 Using streaming for large file: ${path.basename(srcPath)}`);
      return await this.processLargeFile(srcPath, destPath, sectionName, collectHeadings, maxDepth);
    } else {
      // Fall back to regular processing for smaller files
      return await this.processRegularFile(srcPath, destPath, sectionName, collectHeadings, maxDepth);
    }
  }

  /**
   * Process regular file (non-streaming)
   */
  async processRegularFile(srcPath, destPath, sectionName, collectHeadings = false, maxDepth = 3) {
    try {
      // Ensure destination directory exists
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
      
      // Read and process file content
      const content = await fs.promises.readFile(srcPath, 'utf-8');
      const cleanedContent = this.cleanContentChunk(content);
      
      // Extract headings if requested
      let headings = [];
      if (collectHeadings) {
        headings = this.extractHeadingsFromContent(cleanedContent, destPath, sectionName, maxDepth);
      }
      
      // Write processed content
      await fs.promises.writeFile(destPath, cleanedContent, 'utf-8');
      
      return {
        type: 'success',
        srcPath,
        destPath,
        headings,
        size: cleanedContent.length,
        streamProcessed: false
      };
      
    } catch (error) {
      return {
        type: 'error',
        srcPath,
        destPath,
        error: {
          message: error.message,
          stack: error.stack
        },
        streamProcessed: false
      };
    }
  }

  /**
   * Extract headings from content
   */
  extractHeadingsFromContent(content, filePath, sectionName, maxDepth = 3) {
    const headings = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (match) {
        const level = match[1].length;
        const title = match[2].trim();
        
        if (level <= maxDepth) {
          headings.push({
            level,
            title,
            filePath,
            sectionName,
            lineNumber: i + 1,
            anchor: this.generateAnchor(title)
          });
        }
      }
    }
    
    return headings;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      chunkSize: this.chunkSize,
      largeFileThreshold: this.largeFileThreshold,
      memoryUsage: process.memoryUsage()
    };
  }
}

module.exports = StreamingProcessor;