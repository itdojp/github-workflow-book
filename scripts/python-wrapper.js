#!/usr/bin/env node

/**
 * Wrapper for Python scripts to integrate with npm workflow
 */

const { spawn } = require('child_process');
const path = require('path');

// Get the Python script name from command line arguments
const args = process.argv.slice(2);
const scriptName = args[0];
const scriptArgs = args.slice(1);

if (!scriptName) {
  console.error('Error: Please specify a Python script name');
  console.error('Usage: node python-wrapper.js <script-name> [args...]');
  console.error('Available scripts:');
  console.error('  - build_book.py');
  console.error('  - publication_manager.py');
  console.error('  - validate_links.py');
  console.error('  - ai_metrics_calculator.py');
  process.exit(1);
}

const pythonScript = path.join(__dirname, scriptName);

// Check if the script exists
const fs = require('fs');
if (!fs.existsSync(pythonScript)) {
  console.error(`Error: Python script not found: ${pythonScript}`);
  process.exit(1);
}

// Run the Python script
const pythonProcess = spawn('python', [pythonScript, ...scriptArgs], {
  cwd: path.dirname(pythonScript),
  stdio: 'inherit',
  env: { ...process.env }
});

pythonProcess.on('error', (error) => {
  console.error(`Error running Python script: ${error.message}`);
  process.exit(1);
});

pythonProcess.on('exit', (code) => {
  process.exit(code || 0);
});