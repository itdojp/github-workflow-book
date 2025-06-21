#!/usr/bin/env node

/**
 * Performance Benchmark Tool
 * Compares different build strategies and measures performance improvements
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

class BenchmarkRunner {
  constructor() {
    this.results = [];
    this.testSizes = [
      { name: 'small', files: 10, size: 1024 },      // 1KB files
      { name: 'medium', files: 50, size: 10240 },    // 10KB files
      { name: 'large', files: 100, size: 102400 },   // 100KB files
      { name: 'xl', files: 500, size: 1048576 },     // 1MB files
    ];
  }

  /**
   * Create test content with specified size and complexity
   */
  generateTestContent(targetSize, chapterNum = 1) {
    let content = `# 第${chapterNum}章: テストチャプター\n\n`;
    content += `## はじめに\n\n`;
    content += `このチャプターはパフォーマンステスト用のコンテンツです。\n\n`;
    
    // Add sections until we reach target size
    let sectionNum = 1;
    while (content.length < targetSize) {
      content += `## セクション ${sectionNum}\n\n`;
      content += `これはセクション${sectionNum}の内容です。\n\n`;
      
      // Add code blocks
      content += `\`\`\`javascript\n`;
      content += `function example${sectionNum}() {\n`;
      content += `  console.log("Section ${sectionNum} example");\n`;
      content += `  return "test content";\n`;
      content += `}\n`;
      content += `\`\`\`\n\n`;
      
      // Add bullet points
      for (let i = 1; i <= 5; i++) {
        content += `- ポイント${i}: ここに説明文を記述します。テストコンテンツとして充分な長さにするために、詳細な説明を追加しています。\n`;
      }
      content += `\n`;
      
      // Add some instructor content to test cleaning
      if (sectionNum % 3 === 0) {
        content += `## 講師向け\n\n`;
        content += `このセクションは講師向けの情報です。ビルド時に削除されます。\n\n`;
      }
      
      // Add some private content to test cleaning
      if (sectionNum % 5 === 0) {
        content += `<!-- private -->\n`;
        content += `これはプライベートな内容です。公開版では削除されます。\n`;
        content += `<!-- /private -->\n\n`;
      }
      
      sectionNum++;
    }
    
    return content.substring(0, targetSize);
  }

  /**
   * Create test directory structure
   */
  async createTestStructure(testSize) {
    const testDir = path.join(__dirname, '..', 'test-content');
    const srcDir = path.join(testDir, 'src');
    
    // Clean up existing test content
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    
    // Create directory structure
    await fs.mkdir(path.join(srcDir, 'chapters'), { recursive: true });
    await fs.mkdir(path.join(srcDir, 'introduction'), { recursive: true });
    await fs.mkdir(path.join(srcDir, 'appendices'), { recursive: true });
    await fs.mkdir(path.join(srcDir, 'afterword'), { recursive: true });
    
    // Create test files
    for (let i = 1; i <= testSize.files; i++) {
      const chapterDir = path.join(srcDir, 'chapters', `chapter${String(i).padStart(3, '0')}`);
      await fs.mkdir(chapterDir, { recursive: true });
      
      const content = this.generateTestContent(testSize.size, i);
      await fs.writeFile(path.join(chapterDir, 'index.md'), content);
      
      // Add some additional files
      if (i % 10 === 0) {
        await fs.writeFile(path.join(chapterDir, 'exercises.md'), 
          `# 第${i}章 演習問題\n\n1. 問題1\n2. 問題2\n3. 問題3\n`);
      }
      
      if (i % 15 === 0) {
        await fs.writeFile(path.join(chapterDir, 'draft.md'), 
          `# 第${i}章 ドラフト\n\nこれはドラフトファイルです。`);
      }
    }
    
    // Create introduction and appendices
    await fs.writeFile(path.join(srcDir, 'introduction', 'index.md'), 
      this.generateTestContent(testSize.size * 2, 0));
    await fs.writeFile(path.join(srcDir, 'appendices', 'appendix01', 'index.md'), 
      this.generateTestContent(testSize.size, 999));
    await fs.writeFile(path.join(srcDir, 'afterword', 'index.md'), 
      this.generateTestContent(testSize.size, 1000));
    
    return testDir;
  }

  /**
   * Run a specific build command and measure performance
   */
  async runBenchmark(command, label, testDir) {
    const originalCwd = process.cwd();
    
    try {
      // Change to test directory
      process.chdir(testDir);
      
      // Ensure clean state
      try {
        await fs.rm('public', { recursive: true, force: true });
        await fs.rm('.build-meta.json', { force: true });
        await fs.rm('.build-profile*.json', { force: true });
      } catch (error) {
        // Files might not exist
      }
      
      // Measure memory before
      const memoryBefore = process.memoryUsage();
      
      // Run build command and measure time
      const startTime = Date.now();
      
      try {
        const output = execSync(command, { 
          encoding: 'utf8', 
          timeout: 300000, // 5 minutes timeout
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Measure memory after
        const memoryAfter = process.memoryUsage();
        
        // Check output directory
        let outputFiles = 0;
        let outputSize = 0;
        
        try {
          const publicDir = path.join(testDir, 'public');
          const stats = await this.getDirectoryStats(publicDir);
          outputFiles = stats.files;
          outputSize = stats.size;
        } catch (error) {
          console.warn('Failed to get output stats:', error.message);
        }
        
        // Load profile data if available
        let profileData = null;
        try {
          const profileFiles = await fs.readdir(testDir);
          const profileFile = profileFiles.find(f => f.startsWith('.build-profile'));
          if (profileFile) {
            const profileContent = await fs.readFile(path.join(testDir, profileFile), 'utf-8');
            profileData = JSON.parse(profileContent);
          }
        } catch (error) {
          // Profile data not available
        }
        
        return {
          label,
          success: true,
          duration,
          memoryUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          memoryPeak: memoryAfter.heapUsed,
          outputFiles,
          outputSize,
          throughput: outputFiles / duration * 1000, // files per second
          profile: profileData,
          output: output.split('\n').slice(-10).join('\n') // Last 10 lines
        };
        
      } catch (error) {
        return {
          label,
          success: false,
          error: error.message,
          duration: Date.now() - startTime
        };
      }
      
    } finally {
      process.chdir(originalCwd);
    }
  }

  /**
   * Get directory statistics
   */
  async getDirectoryStats(dir) {
    let files = 0;
    let size = 0;
    
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          const subStats = await this.getDirectoryStats(fullPath);
          files += subStats.files;
          size += subStats.size;
        } else if (item.isFile()) {
          files++;
          const stat = await fs.stat(fullPath);
          size += stat.size;
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return { files, size };
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runComprehensiveBenchmark() {
    console.log('🏁 Starting comprehensive performance benchmark...\n');
    
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
      nodeVersion: process.version
    };
    
    console.log('💻 System Information:');
    console.log(`   Platform: ${systemInfo.platform} ${systemInfo.arch}`);
    console.log(`   CPUs: ${systemInfo.cpus}`);
    console.log(`   Memory: ${systemInfo.memory}`);
    console.log(`   Node.js: ${systemInfo.nodeVersion}\n`);
    
    const buildCommands = [
      { command: 'node ../scripts/build.js', label: 'Original Build' },
      { command: 'node ../scripts/build-parallel.js', label: 'Parallel Build' },
      { command: 'node ../scripts/build-incremental.js', label: 'Original Incremental' },
      { command: 'node ../scripts/build-incremental-optimized.js', label: 'Optimized Incremental' }
    ];
    
    for (const testSize of this.testSizes) {
      console.log(`\n📊 Testing with ${testSize.name.toUpperCase()} dataset (${testSize.files} files, ${Math.round(testSize.size/1024)}KB each):`);
      console.log('='.repeat(80));
      
      // Create test structure
      const testDir = await this.createTestStructure(testSize);
      
      const testResults = [];
      
      for (const build of buildCommands) {
        console.log(`\n🔨 Running ${build.label}...`);
        const result = await this.runBenchmark(build.command, build.label, testDir);
        
        if (result.success) {
          console.log(`   ✅ Completed in ${result.duration}ms`);
          console.log(`   📁 Output: ${result.outputFiles} files (${Math.round(result.outputSize/1024)}KB)`);
          console.log(`   ⚡ Throughput: ${result.throughput.toFixed(2)} files/sec`);
          console.log(`   💾 Memory: ${Math.round(result.memoryPeak/1024/1024)}MB peak`);
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
        }
        
        testResults.push({ ...result, testSize: testSize.name });
      }
      
      // Calculate improvements
      const originalBuild = testResults.find(r => r.label === 'Original Build' && r.success);
      const parallelBuild = testResults.find(r => r.label === 'Parallel Build' && r.success);
      
      if (originalBuild && parallelBuild) {
        const speedup = originalBuild.duration / parallelBuild.duration;
        const memoryReduction = (originalBuild.memoryPeak - parallelBuild.memoryPeak) / originalBuild.memoryPeak * 100;
        
        console.log(`\n📈 Performance Improvements:`);
        console.log(`   🚀 Speed: ${speedup.toFixed(2)}x faster`);
        console.log(`   💾 Memory: ${memoryReduction > 0 ? memoryReduction.toFixed(1) + '% reduction' : 'No significant change'}`);
      }
      
      this.results.push(...testResults);
      
      // Cleanup test directory
      await fs.rm(testDir, { recursive: true, force: true });
    }
    
    // Generate final report
    await this.generateReport(systemInfo);
  }

  /**
   * Generate comprehensive benchmark report
   */
  async generateReport(systemInfo) {
    const report = {
      timestamp: new Date().toISOString(),
      systemInfo,
      results: this.results,
      summary: this.generateSummary()
    };
    
    const reportPath = path.join(__dirname, '..', 'benchmark-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 BENCHMARK SUMMARY');
    console.log('='.repeat(80));
    
    // Performance comparison table
    console.log('\n🏆 Best Performance by Category:');
    
    const categories = ['small', 'medium', 'large', 'xl'];
    
    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.testSize === category && r.success);
      if (categoryResults.length === 0) continue;
      
      const fastest = categoryResults.reduce((best, current) => 
        current.duration < best.duration ? current : best);
      const mostEfficient = categoryResults.reduce((best, current) => 
        current.memoryPeak < best.memoryPeak ? current : best);
      
      console.log(`\n${category.toUpperCase()}:`);
      console.log(`   ⚡ Fastest: ${fastest.label} (${fastest.duration}ms)`);
      console.log(`   💾 Most Memory Efficient: ${mostEfficient.label} (${Math.round(mostEfficient.memoryPeak/1024/1024)}MB)`);
    }
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    console.log('='.repeat(80));
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    const summary = {};
    
    // Group results by test size
    const sizes = [...new Set(this.results.map(r => r.testSize))];
    
    for (const size of sizes) {
      const sizeResults = this.results.filter(r => r.testSize === size && r.success);
      
      if (sizeResults.length > 0) {
        summary[size] = {
          fastest: sizeResults.reduce((best, current) => 
            current.duration < best.duration ? current : best),
          slowest: sizeResults.reduce((worst, current) => 
            current.duration > worst.duration ? current : worst),
          mostMemoryEfficient: sizeResults.reduce((best, current) => 
            current.memoryPeak < best.memoryPeak ? current : best),
          averageDuration: sizeResults.reduce((sum, r) => sum + r.duration, 0) / sizeResults.length,
          averageMemory: sizeResults.reduce((sum, r) => sum + r.memoryPeak, 0) / sizeResults.length
        };
      }
    }
    
    return summary;
  }
}

// Run benchmark if called directly
if (require.main === module) {
  const runner = new BenchmarkRunner();
  runner.runComprehensiveBenchmark().catch(console.error);
}

module.exports = BenchmarkRunner;
>>>>>>> main
