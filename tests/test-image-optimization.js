#!/usr/bin/env node

/**
 * 画像最適化機能のテストスクリプト
 */

const fs = require('fs').promises;
const path = require('path');
const ImageOptimizer = require('../scripts/image-optimizer');

async function testImageOptimization() {
  console.log('🧪 Testing Image Optimization Features...\n');

  // テスト用設定
  const testConfig = {
    quality: 80,
    formats: ['webp', 'avif', 'original'],
    maxWidth: 800,
    stripMetadata: true
  };

  const optimizer = new ImageOptimizer(testConfig);
  
  // テスト: 画像ファイル判定
  console.log('1. Testing image file detection:');
  const testFiles = [
    'test.jpg',
    'test.png', 
    'test.webp',
    'test.svg',
    'test.txt',
    'test.md'
  ];
  
  testFiles.forEach(file => {
    const isImage = optimizer.isImageFile(file);
    console.log(`   ${file}: ${isImage ? '✅ Image' : '❌ Not image'}`);
  });
  
  // テスト: SVGファイル判定  
  console.log('\n2. Testing SVG file detection:');
  testFiles.forEach(file => {
    const isSvg = optimizer.isSvgFile(file);
    console.log(`   ${file}: ${isSvg ? '✅ SVG' : '❌ Not SVG'}`);
  });
  
  // テスト: 実際の画像が存在する場合の最適化
  console.log('\n3. Testing actual image optimization:');
  const assetsDir = path.join(__dirname, '..', 'assets', 'images');
  try {
    const files = await fs.readdir(assetsDir);
    const imageFiles = files.filter(file => optimizer.isImageFile(file));
    
    if (imageFiles.length > 0) {
      console.log(`   Found ${imageFiles.length} image files:`);
      imageFiles.forEach(file => {
        console.log(`   - ${file}`);
      });
    } else {
      console.log('   No image files found for testing');
    }
  } catch (error) {
    console.log('   Assets directory not accessible');
  }
  
  // テスト: 最適化レポート
  console.log('\n4. Testing optimization report:');
  const report = optimizer.generateReport();
  console.log('   Initial report:', report);
  
  console.log('\n5. Testing report formatting:');
  const testSizes = [0, 1024, 1048576, 1073741824];
  testSizes.forEach(size => {
    console.log(`   ${size} bytes = ${optimizer.formatBytes(size)}`);
  });
  
  console.log('\n✅ Image optimization tests completed!');
}

async function testBuildIntegration() {
  console.log('\n🔧 Testing Build Integration...\n');
  
  // テスト: 設定ファイルの読み込み
  try {
    const configPath = path.join(__dirname, '..', 'book-config.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    console.log('1. Configuration loading:');
    if (config.imageOptimization) {
      console.log('   ✅ Image optimization config found');
      console.log('   Settings:', JSON.stringify(config.imageOptimization, null, 2));
    } else {
      console.log('   ❌ Image optimization config not found');
    }
    
    // テスト: public ディレクトリの画像ファイル確認
    console.log('\n2. Generated image files:');
    const publicAssetsDir = path.join(__dirname, '..', 'public', 'assets', 'images');
    try {
      const files = await fs.readdir(publicAssetsDir);
      const imageFiles = files.filter(file => 
        file.endsWith('.png') || file.endsWith('.webp') || file.endsWith('.avif') || file.endsWith('.jpg') || file.endsWith('.jpeg')
      );
      
      console.log(`   Found ${imageFiles.length} optimized image files:`);
      imageFiles.forEach(file => {
        console.log(`   - ${file}`);
      });
      
      // WebP ファイルの存在確認
      const webpFiles = files.filter(file => file.endsWith('.webp'));
      if (webpFiles.length > 0) {
        console.log(`   ✅ WebP conversion working (${webpFiles.length} files)`);
      } else {
        console.log('   ⚠️ No WebP files found');
      }
      
    } catch (error) {
      console.log('   ❌ Public assets directory not found - run build first');
    }
    
  } catch (error) {
    console.log('   ❌ Configuration loading failed:', error.message);
  }
  
  console.log('\n✅ Build integration tests completed!');
}

// メイン実行
async function main() {
  await testImageOptimization();
  await testBuildIntegration();
  
  console.log('\n🎉 All tests completed!');
  console.log('\nTo test the complete feature:');
  console.log('1. Run: npm run build');
  console.log('2. Check public/assets/images/ for optimized files');
  console.log('3. Open generated HTML files to test lazy loading');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testImageOptimization, testBuildIntegration };