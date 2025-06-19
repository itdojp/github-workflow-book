#!/usr/bin/env node

/**
 * 画像最適化モジュール
 * Sharp.jsを使用した高度な画像最適化機能
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

class ImageOptimizer {
  constructor(config = {}) {
    this.config = {
      quality: config.quality || 85,
      formats: config.formats || ['webp', 'original'],
      maxWidth: config.maxWidth || 1920,
      stripMetadata: config.stripMetadata !== false,
      lazyLoad: config.lazyLoad !== false,
      ...config
    };
    
    this.stats = {
      totalImages: 0,
      optimizedImages: 0,
      totalSizeBefore: 0,
      totalSizeAfter: 0,
      errors: []
    };
  }
  
  /**
   * ファイルが画像ファイルかどうか判定
   */
  isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'].includes(ext);
  }
  
  /**
   * 画像を最適化
   */
  async optimizeImage(inputPath, outputPath) {
    try {
      const stats = await fs.stat(inputPath);
      this.stats.totalImages++;
      this.stats.totalSizeBefore += stats.size;
      
      const ext = path.extname(inputPath).toLowerCase();
      const baseName = path.basename(outputPath, ext);
      const outputDir = path.dirname(outputPath);
      
      // 出力ディレクトリを作成
      await fs.mkdir(outputDir, { recursive: true });
      
      // 元の画像を読み込み
      let pipeline = sharp(inputPath);
      
      // メタデータの取得
      const metadata = await pipeline.metadata();
      
      // サイズ調整
      if (metadata.width > this.config.maxWidth) {
        pipeline = pipeline.resize(this.config.maxWidth, null, {
          withoutEnlargement: true,
          fit: 'inside'
        });
      }
      
      // メタデータの削除
      if (this.config.stripMetadata) {
        pipeline = pipeline.withMetadata(false);
      }
      
      // 各フォーマットで出力
      const promises = [];
      
      for (const format of this.config.formats) {
        if (format === 'original') {
          // オリジナルフォーマットで最適化
          const optimizedPath = outputPath;
          const promise = this.saveOptimizedImage(pipeline, optimizedPath, ext);
          promises.push(promise);
        } else if (format === 'webp') {
          // WebP形式で保存
          const webpPath = path.join(outputDir, `${baseName}.webp`);
          const promise = pipeline.clone()
            .webp({ quality: this.config.quality })
            .toFile(webpPath)
            .then(info => {
              this.stats.totalSizeAfter += info.size;
              return info;
            });
          promises.push(promise);
        } else if (format === 'avif') {
          // AVIF形式で保存
          const avifPath = path.join(outputDir, `${baseName}.avif`);
          const promise = pipeline.clone()
            .avif({ quality: this.config.quality })
            .toFile(avifPath)
            .then(info => {
              this.stats.totalSizeAfter += info.size;
              return info;
            });
          promises.push(promise);
        }
      }
      
      await Promise.all(promises);
      this.stats.optimizedImages++;
      
      return true;
    } catch (error) {
      this.stats.errors.push({
        file: inputPath,
        error: error.message
      });
      
      // エラーが発生した場合は元のファイルをコピー
      try {
        await fs.copyFile(inputPath, outputPath);
        const stats = await fs.stat(outputPath);
        this.stats.totalSizeAfter += stats.size;
      } catch (copyError) {
        console.error(`Failed to copy original file: ${inputPath}`, copyError);
      }
      
      return false;
    }
  }
  
  /**
   * 最適化された画像を保存
   */
  async saveOptimizedImage(pipeline, outputPath, originalExt) {
    let outputPipeline = pipeline.clone();
    
    switch (originalExt) {
      case '.jpg':
      case '.jpeg':
        outputPipeline = outputPipeline.jpeg({ 
          quality: this.config.quality,
          progressive: true,
          mozjpeg: true
        });
        break;
      case '.png':
        outputPipeline = outputPipeline.png({ 
          quality: this.config.quality,
          compressionLevel: 9,
          progressive: true
        });
        break;
      case '.webp':
        outputPipeline = outputPipeline.webp({ 
          quality: this.config.quality
        });
        break;
      case '.gif':
        // GIFは特別な処理なし（Sharp.jsのGIFサポートは限定的）
        await fs.copyFile(inputPath, outputPath);
        const stats = await fs.stat(outputPath);
        this.stats.totalSizeAfter += stats.size;
        return;
      default:
        outputPipeline = outputPipeline.jpeg({ 
          quality: this.config.quality,
          progressive: true
        });
    }
    
    const info = await outputPipeline.toFile(outputPath);
    this.stats.totalSizeAfter += info.size;
    return info;
  }
  
  /**
   * 最適化レポートを出力
   */
  printReport() {
    console.log('\n📊 Image Optimization Report:');
    console.log(`   Total images processed: ${this.stats.totalImages}`);
    console.log(`   Images optimized: ${this.stats.optimizedImages}`);
    
    if (this.stats.totalImages > 0) {
      const sizeBefore = (this.stats.totalSizeBefore / 1024 / 1024).toFixed(2);
      const sizeAfter = (this.stats.totalSizeAfter / 1024 / 1024).toFixed(2);
      const reduction = ((1 - this.stats.totalSizeAfter / this.stats.totalSizeBefore) * 100).toFixed(1);
      
      console.log(`   Total size before: ${sizeBefore} MB`);
      console.log(`   Total size after: ${sizeAfter} MB`);
      console.log(`   Size reduction: ${reduction}%`);
    }
    
    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️  Optimization errors: ${this.stats.errors.length}`);
      this.stats.errors.forEach(err => {
        console.log(`   - ${err.file}: ${err.error}`);
      });
    }
  }
  
  /**
   * HTMLコンテンツ内の画像タグを最適化
   */
  optimizeImageTags(html) {
    if (!this.config.lazyLoad) {
      return html;
    }
    
    // img タグに loading="lazy" を追加
    return html.replace(
      /<img\s+([^>]*?)(?<!loading=["'][^"']*["'])\s*\/?>/gi,
      '<img $1 loading="lazy" />'
    );
  }
}

module.exports = ImageOptimizer;

// CLIとして実行された場合
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node image-optimizer.js <input> <output> [options]');
    console.log('Options:');
    console.log('  --quality=<number>    JPEG/WebP quality (default: 85)');
    console.log('  --max-width=<number>  Maximum width in pixels (default: 1920)');
    console.log('  --formats=<list>      Output formats (default: webp,original)');
    process.exit(1);
  }
  
  const [input, output] = args;
  const config = {};
  
  // オプションをパース
  args.slice(2).forEach(arg => {
    const [key, value] = arg.split('=');
    switch (key) {
      case '--quality':
        config.quality = parseInt(value);
        break;
      case '--max-width':
        config.maxWidth = parseInt(value);
        break;
      case '--formats':
        config.formats = value.split(',');
        break;
    }
  });
  
  const optimizer = new ImageOptimizer(config);
  
  optimizer.optimizeImage(input, output)
    .then(success => {
      if (success) {
        console.log(`✅ Optimized: ${input} -> ${output}`);
      } else {
        console.log(`❌ Failed to optimize: ${input}`);
      }
      optimizer.printReport();
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}