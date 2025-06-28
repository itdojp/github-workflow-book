#!/usr/bin/env node

/**
 * Wrapper for publishing to Zenn platform
 * Integrates with the existing Python-based Zenn publishing script
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('📚 Publishing to Zenn platform...');

// Check if publication_manager.py exists
const pythonScript = path.join(__dirname, 'publication_manager.py');
if (!fs.existsSync(pythonScript)) {
  console.error('Error: publication_manager.py not found');
  console.error('The Python-based publishing system is required for Zenn integration');
  process.exit(1);
}

// Run the Python publication manager
const pythonProcess = spawn('python', [pythonScript, 'zenn'], {
  cwd: path.dirname(pythonScript),
  stdio: 'inherit',
  env: { ...process.env }
});

pythonProcess.on('error', (error) => {
  console.error(`Error running Zenn publisher: ${error.message}`);
  console.error('Make sure Python and required dependencies are installed:');
  console.error('  pip install -r requirements.txt');
  process.exit(1);
});

pythonProcess.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ Successfully published to Zenn');
  } else {
    console.error('❌ Failed to publish to Zenn');
  }
  process.exit(code || 0);
});