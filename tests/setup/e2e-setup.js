// E2E Test Setup
const { spawn } = require('child_process');

// Global setup for E2E tests
beforeAll(async () => {
  // Ensure build is ready
  console.log('Setting up E2E tests...');
  
  // Clean and build
  await new Promise((resolve, reject) => {
    const clean = spawn('npm', ['run', 'clean'], { stdio: 'inherit' });
    clean.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Clean failed with code ${code}`));
    });
  });
  
  await new Promise((resolve, reject) => {
    const build = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
    build.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with code ${code}`));
    });
  });
}, 60000);

// Global teardown
afterAll(async () => {
  console.log('Cleaning up E2E tests...');
});
