#!/usr/bin/env node

/**
 * Adapter to run Python build script alongside JavaScript build
 * This allows gradual migration from Python to JavaScript
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const runPythonBuild = async () => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'build_book.py');
    
    if (!fs.existsSync(pythonScript)) {
      console.warn('Warning: Python build script not found, skipping Python build');
      resolve();
      return;
    }

    console.log('🐍 Running Python build script...');
    
    const pythonProcess = spawn('python', [pythonScript], {
      cwd: path.dirname(pythonScript),
      stdio: 'inherit',
      env: { ...process.env }
    });

    pythonProcess.on('error', (error) => {
      console.error(`Python build error: ${error.message}`);
      reject(error);
    });

    pythonProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ Python build completed successfully');
        resolve();
      } else {
        reject(new Error(`Python build failed with code ${code}`));
      }
    });
  });
};

// Export for use in other scripts
module.exports = { runPythonBuild };

// Run if called directly
if (require.main === module) {
  runPythonBuild()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}