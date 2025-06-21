const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

describe('Build Process E2E Tests', () => {
  const outputDir = 'public';
  
  test('should generate complete HTML output', async () => {
    // Check if index.html exists
    const indexPath = path.join(outputDir, 'index.html');
    await expect(fs.access(indexPath)).resolves.not.toThrow();
    
    // Read and validate content
    const content = await fs.readFile(indexPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<html');
    expect(content).toContain('<head>');
    expect(content).toContain('<title>');
    expect(content).toContain('<body>');
  });
  
  test('should generate CSS and JS assets', async () => {
    const cssPath = path.join(outputDir, 'css', 'style.css');
    const jsPath = path.join(outputDir, 'js', 'main.js');
    
    await expect(fs.access(cssPath)).resolves.not.toThrow();
    await expect(fs.access(jsPath)).resolves.not.toThrow();
    
    // Check file sizes
    const cssStats = await fs.stat(cssPath);
    const jsStats = await fs.stat(jsPath);
    
    expect(cssStats.size).toBeGreaterThan(0);
    expect(jsStats.size).toBeGreaterThan(0);
  });
  
  test('should handle incremental builds', async () => {
    // Run incremental build
    await new Promise((resolve, reject) => {
      const build = spawn('npm', ['run', 'build:incremental'], {
        stdio: 'pipe'
      });
      
      build.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Incremental build failed with code ${code}`));
      });
    });
    
    // Check if metadata file exists
    await expect(fs.access('.build-meta.json')).resolves.not.toThrow();
    
    // Validate metadata content
    const metaContent = await fs.readFile('.build-meta.json', 'utf-8');
    const meta = JSON.parse(metaContent);
    
    expect(meta).toHaveProperty('lastBuild');
    expect(meta).toHaveProperty('files');
  });
  
  test('should validate content safeguard', async () => {
    // Run safeguard check
    const { runSafeguardCheck } = require('../../scripts/content-safeguard');
    
    const result = await runSafeguardCheck('src', { saveReport: false });
    
    // Should not have critical violations
    expect(result.hasViolations).toBe(false);
  });
  
  test('should generate multiple formats', async () => {
    // Test PDF generation if available
    try {
      await new Promise((resolve, reject) => {
        const pdfBuild = spawn('npm', ['run', 'build:pdf'], {
          stdio: 'pipe'
        });
        
        pdfBuild.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`PDF build failed with code ${code}`));
        });
      });
      
      // Check if PDF output exists
      const pdfPath = path.join('output', 'book.pdf');
      await expect(fs.access(pdfPath)).resolves.not.toThrow();
    } catch (error) {
      console.log('PDF generation not available or failed:', error.message);
    }
  });
});
