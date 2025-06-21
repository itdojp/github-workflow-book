/**
 * Emoji Processor
 * Converts emoji shortcodes to actual emojis
 */

const { BaseProcessor } = require('../scripts/processor-system');

class EmojiProcessor extends BaseProcessor {
  constructor(options = {}) {
    super({
      style: 'shortcode', // shortcode, unicode, or image
      imageUrl: 'https://twemoji.maxcdn.com/v/latest/72x72/',
      customEmojis: {},
      ...options
    });
    
    // Common emoji mappings
    this.emojis = {
      // Smileys
      ':smile:': '😊',
      ':laughing:': '😆',
      ':blush:': '😊',
      ':heart:': '❤️',
      ':+1:': '👍',
      ':thumbsup:': '👍',
      ':-1:': '👎',
      ':thumbsdown:': '👎',
      ':clap:': '👏',
      ':wave:': '👋',
      
      // Objects
      ':book:': '📖',
      ':books:': '📚',
      ':pencil:': '✏️',
      ':memo:': '📝',
      ':computer:': '💻',
      ':keyboard:': '⌨️',
      ':rocket:': '🚀',
      ':fire:': '🔥',
      ':star:': '⭐',
      ':sparkles:': '✨',
      
      // Symbols
      ':warning:': '⚠️',
      ':x:': '❌',
      ':white_check_mark:': '✅',
      ':heavy_check_mark:': '✔️',
      ':question:': '❓',
      ':exclamation:': '❗',
      ':bulb:': '💡',
      ':information_source:': 'ℹ️',
      
      // Nature
      ':sunny:': '☀️',
      ':cloud:': '☁️',
      ':rainbow:': '🌈',
      ':umbrella:': '☂️',
      
      // Add custom emojis
      ...this.options.customEmojis
    };
  }

  async process(content, metadata) {
    // Process emoji shortcodes
    const regex = /:([a-zA-Z0-9_+-]+):/g;
    
    return content.replace(regex, (match, shortcode) => {
      const fullShortcode = `:${shortcode}:`;
      
      if (this.emojis[fullShortcode]) {
        return this.renderEmoji(this.emojis[fullShortcode], shortcode);
      }
      
      // Return original if not found
      return match;
    });
  }

  renderEmoji(emoji, shortcode) {
    switch (this.options.style) {
      case 'unicode':
        return emoji;
        
      case 'image':
        // Convert to image tag
        const codePoint = this.getEmojiCodePoint(emoji);
        const imageUrl = `${this.options.imageUrl}${codePoint}.png`;
        return `<img class="emoji" alt="${emoji}" src="${imageUrl}" />`;
        
      case 'shortcode':
      default:
        // Return as span with emoji
        return `<span class="emoji" title=":${shortcode}:">${emoji}</span>`;
    }
  }

  getEmojiCodePoint(emoji) {
    // Get Unicode code point for emoji (simplified)
    const codePoint = emoji.codePointAt(0).toString(16);
    return codePoint;
  }
}

module.exports = EmojiProcessor;