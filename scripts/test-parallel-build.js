#!/usr/bin/env node

/**
 * Test script for parallel build functionality
 * Validates the parallel build system before deployment
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Test configurations
const TESTS = [
  {
    name: 'Small project (sequential)',
    fileCount: 5,
    expectParallel: false
  },
  {
    name: 'Medium project (parallel)',
    fileCount: 25,
    expectParallel: true
  },
  {
    name: 'Large project (parallel)',
    fileCount: 100,
    expectParallel: true
  }
];

// Create test content
async function createTestContent(baseDir, fileCount) {
  const chaptersDir = path.join(baseDir, 'src', 'chapters');
  await fs.mkdir(chaptersDir, { recursive: true });
  
  for (let i = 1; i <= fileCount; i++) {
    const chapterDir = path.join(chaptersDir, `chapter${String(i).padStart(2, '0')}`);
    await fs.mkdir(chapterDir, { recursive: true });
    
    const content = `# Chapter ${i}: Test Chapter

This is test content for chapter ${i}.

## Section 1
Test content for parallel build testing.

## Section 2
More test content with various markdown elements.

### Subsection 2.1
- List item 1
- List item 2
- List item 3

### Subsection 2.2
\`\`\`javascript
// Test code block
function test() {
  console.log('Chapter ${i}');
}
\`\`\`

## Summary
This chapter demonstrated test content ${i}.
`;
    
    await fs.writeFile(path.join(chapterDir, 'index.md'), content, 'utf-8');
  }
  
  // Create minimal config
  const config = {
    contentSections: [
      {
        name: 'chapters',
        title: 'Chapters',
        directory: 'chapters',
        enabled: true,
        order: 1,
        numbering: true
      }
    ],
    tableOfContents: {
      enabled: true,
      title: 'Table of Contents',
      outputFile: 'table-of-contents.md',
      maxDepth: 3,
      includeNumbers: true
    },
    parallel: {
      enabled: true,
      maxWorkers: 4
    }
  };
  
  await fs.writeFile(
    path.join(baseDir, 'book-config.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}

// Run build command
function runBuild(cwd, buildCommand) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const proc = spawn('npm', ['run', buildCommand], {
      cwd,
      shell: true,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      if (code === 0) {
        resolve({
          success: true,
          duration,
          stdout,
          stderr
        });
      } else {
        reject({
          success: false,
          code,
          duration,
          stdout,
          stderr
        });
      }
    });
  });
}

// Verify build output
async function verifyBuildOutput(baseDir, fileCount) {
  const publicDir = path.join(baseDir, 'public');
  
  // Check if public directory exists
  try {
    await fs.access(publicDir);
  } catch (error) {
    return { success: false, error: 'Public directory not found' };
  }
  
  // Check chapters
  const chaptersDir = path.join(publicDir, 'chapters');
  let processedFiles = 0;
  
  for (let i = 1; i <= fileCount; i++) {
    const chapterDir = path.join(chaptersDir, `chapter${String(i).padStart(2, '0')}`);
    const chapterFile = path.join(chapterDir, 'index.md');
    
    try {
      await fs.access(chapterFile);
      processedFiles++;
    } catch (error) {
      // File not found
    }
  }
  
  // Check table of contents
  const tocFile = path.join(publicDir, 'table-of-contents.md');
  let hasToc = false;
  
  try {
    await fs.access(tocFile);
    hasToc = true;
  } catch (error) {
    // TOC not found
  }
  
  return {
    success: processedFiles === fileCount && hasToc,
    processedFiles,
    expectedFiles: fileCount,
    hasToc
  };
}

// Clean up test directory
async function cleanup(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Testing Parallel Build System\n');
  
  const results = [];
  
  for (const test of TESTS) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Files: ${test.fileCount}`);
    console.log(`   Expect parallel: ${test.expectParallel}`);
    
    const testDir = path.join(__dirname, '..', `test-parallel-${test.fileCount}`);
    
    try {
      // Setup
      console.log('   Setting up test content...');
      await cleanup(testDir);
      await createTestContent(testDir, test.fileCount);
      
      // Run parallel build
      console.log('   Running parallel build...');
      const parallelResult = await runBuild(testDir, 'build:parallel');
      
      // Run standard build for comparison
      console.log('   Running standard build for comparison...');
      await cleanup(path.join(testDir, 'public'));
      const standardResult = await runBuild(testDir, 'build');
      
      // Verify output
      console.log('   Verifying build output...');
      const verification = await verifyBuildOutput(testDir, test.fileCount);
      
      // Calculate speedup
      const speedup = standardResult.duration / parallelResult.duration;
      
      // Check if parallel was actually used
      const usedParallel = parallelResult.stdout.includes('parallel') || 
                          parallelResult.stdout.includes('workers');
      
      const result = {
        test: test.name,
        fileCount: test.fileCount,
        parallelDuration: parallelResult.duration,
        standardDuration: standardResult.duration,
        speedup: speedup.toFixed(2),
        usedParallel,
        verification,
        passed: verification.success && 
                (test.expectParallel ? usedParallel : true)
      };
      
      results.push(result);
      
      console.log(`   ✅ Test completed:`);
      console.log(`      Parallel: ${(parallelResult.duration / 1000).toFixed(2)}s`);
      console.log(`      Standard: ${(standardResult.duration / 1000).toFixed(2)}s`);
      console.log(`      Speedup: ${speedup.toFixed(2)}x`);
      console.log(`      Files processed: ${verification.processedFiles}/${verification.expectedFiles}`);
      
      // Cleanup
      await cleanup(testDir);
      
    } catch (error) {
      console.error(`   ❌ Test failed:`, error.message);
      results.push({
        test: test.name,
        fileCount: test.fileCount,
        passed: false,
        error: error.message
      });
      
      // Cleanup on error
      await cleanup(testDir);
    }
  }
  
  // Summary
  console.log('\n\n📊 Test Summary\n');
  console.log('| Test | Files | Parallel Time | Standard Time | Speedup | Result |');
  console.log('|------|-------|---------------|---------------|---------|--------|');
  
  results.forEach(result => {
    const status = result.passed ? '✅ Pass' : '❌ Fail';
    const parallelTime = result.parallelDuration ? 
      `${(result.parallelDuration / 1000).toFixed(2)}s` : 'N/A';
    const standardTime = result.standardDuration ? 
      `${(result.standardDuration / 1000).toFixed(2)}s` : 'N/A';
    const speedup = result.speedup || 'N/A';
    
    console.log(
      `| ${result.test} | ${result.fileCount} | ${parallelTime} | ${standardTime} | ${speedup}x | ${status} |`
    );
  });
  
  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}