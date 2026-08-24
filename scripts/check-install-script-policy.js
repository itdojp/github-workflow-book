#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const EXPECTED = Object.freeze({
  sharpRange: '^0.35.3',
  sharpVersion: '0.35.3',
  puppeteerRange: '^25.8.0',
  nodeRange: '^22.22.2 || ^24.15.0 || >=26.0.0',
  packageManager: 'npm@12.0.1',
  defaultPdfEngine: 'pandoc',
});

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateDocumentedInstallCommands(errors, file, source) {
  const commands = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\bnpm\s+(?:ci|install)\b/.test(line) && !/\bexecSync\s*\(/.test(line));

  if (!commands.length) {
    errors.push(`${file} must document a guarded npm install command`);
    return;
  }

  commands.forEach((command) => {
    if (!command.includes('PUPPETEER_SKIP_DOWNLOAD=true')) {
      errors.push(`${file} install command must disable Puppeteer browser downloads`);
    }
    if (!command.includes('--ignore-scripts')) {
      errors.push(`${file} install command must use --ignore-scripts`);
    }
  });
}

function findExecutableInstallCalls(source) {
  const calls = [];
  const pattern = /execSync\(\s*([`'"])([\s\S]*?)\1/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (!/\bnpm\s+(?:ci|install)\b/.test(match[2])) continue;
    const callEnd = source.indexOf(');', pattern.lastIndex);
    calls.push({
      command: match[2],
      source: source.slice(match.index, callEnd === -1 ? pattern.lastIndex : callEnd + 2),
    });
  }
  return calls;
}

function validateExecutableInstallCommands(errors, file, source) {
  const calls = findExecutableInstallCalls(source);
  if (!calls.length) {
    errors.push(`${file} must retain its guarded executable npm install path`);
    return;
  }

  if (!/const INSTALL_ENVIRONMENT = Object\.freeze\(\{[\s\S]*?\.\.\.process\.env,[\s\S]*?PUPPETEER_SKIP_DOWNLOAD: 'true'[\s\S]*?\}\);/.test(source)) {
    errors.push(`${file} must define the no-browser-download install environment`);
  }
  calls.forEach(({ command, source: callSource }) => {
    if (!command.includes('--ignore-scripts')) {
      errors.push(`${file} executable install command must use --ignore-scripts`);
    }
    if (!/env:\s*INSTALL_ENVIRONMENT/.test(callSource)) {
      errors.push(`${file} executable install command must use the no-browser-download environment`);
    }
  });
}

function validate(state) {
  const errors = [];
  const {
    pkg,
    lock,
    config,
    buildSource,
    imageOptimizerSource,
    pdfSource,
    readme,
    agentGuide,
    setupGuide,
    easySetupSource,
    cacheManagerSource,
    errorRecoverySource,
    initTemplateSource,
  } = state;
  const sharp = lock.packages?.['node_modules/sharp'];
  const puppeteer = lock.packages?.['node_modules/puppeteer'];
  const installScriptPackages = Object.entries(lock.packages ?? {})
    .filter(([, metadata]) => metadata.hasInstallScript === true)
    .map(([path, metadata]) => `${path}@${metadata.version}`)
    .sort();

  if (pkg.optionalDependencies?.sharp !== EXPECTED.sharpRange) {
    errors.push(`optionalDependencies.sharp must be ${EXPECTED.sharpRange}`);
  }
  if (pkg.optionalDependencies?.puppeteer !== EXPECTED.puppeteerRange) {
    errors.push(`optionalDependencies.puppeteer must be ${EXPECTED.puppeteerRange}`);
  }
  if (pkg.engines?.node !== EXPECTED.nodeRange) {
    errors.push(`engines.node must be ${EXPECTED.nodeRange}`);
  }
  if (pkg.packageManager !== EXPECTED.packageManager) {
    errors.push(`packageManager must be ${EXPECTED.packageManager}`);
  }
  if (pkg.allowScripts?.puppeteer !== false) {
    errors.push('allowScripts must explicitly deny the Puppeteer download script');
  }
  const unexpectedApprovals = Object.entries(pkg.allowScripts ?? {})
    .filter(([, allowed]) => allowed === true)
    .map(([name]) => name)
    .filter(Boolean);
  if (unexpectedApprovals.length) {
    errors.push(`unexpected install-script approvals: ${unexpectedApprovals.join(', ')}`);
  }
  if (sharp?.version !== EXPECTED.sharpVersion || sharp?.hasInstallScript === true) {
    errors.push(`lockfile must resolve script-free sharp@${EXPECTED.sharpVersion}`);
  }
  if (puppeteer?.version !== '25.8.0' || puppeteer?.hasInstallScript !== true) {
    errors.push('lockfile must resolve install-script-bearing puppeteer@25.8.0');
  }
  const expectedInstallScripts = ['node_modules/puppeteer@25.8.0'];
  if (JSON.stringify(installScriptPackages) !== JSON.stringify(expectedInstallScripts)) {
    errors.push(`unexpected install-script package set: ${JSON.stringify(installScriptPackages)}`);
  }
  if (!buildSource.includes("require('./image-optimizer')")) {
    errors.push('build:full must retain the active image optimizer');
  }
  if (!imageOptimizerSource.includes("require('sharp')")) {
    errors.push('the script-free Sharp dependency must retain an active consumer');
  }
  if (!pdfSource.includes("require('puppeteer')")) {
    errors.push('the denied Puppeteer package must remain an explicit optional consumer');
  }
  if (config.pdf?.engine !== EXPECTED.defaultPdfEngine) {
    errors.push(`default PDF engine must remain ${EXPECTED.defaultPdfEngine}`);
  }
  for (const [file, source] of [
    ['README.md', readme],
    ['AGENTS.md', agentGuide],
    ['SETUP_V2.md', setupGuide],
    ['easy-setup.js generated README', easySetupSource],
    ['scripts/error-recovery.js recovery guidance', errorRecoverySource],
    ['scripts/init-template.js generated README', initTemplateSource],
  ]) {
    validateDocumentedInstallCommands(errors, file, source);
  }
  for (const [file, source] of [
    ['easy-setup.js', easySetupSource],
    ['scripts/cache-manager.js', cacheManagerSource],
  ]) {
    validateExecutableInstallCommands(errors, file, source);
  }
  if (!easySetupSource.includes(`const REQUIRED_NODE_RANGE = '${EXPECTED.nodeRange}';`)
    || !easySetupSource.includes('isSupportedNodeVersion(nodeVersion)')) {
    errors.push('easy-setup.js Node validation must match package.json engines.node');
  }
  const expectedNpmVersion = EXPECTED.packageManager.slice('npm@'.length);
  if (!easySetupSource.includes(`const REQUIRED_NPM_VERSION = '${expectedNpmVersion}';`)
    || !easySetupSource.includes('npmVersion !== REQUIRED_NPM_VERSION')) {
    errors.push('easy-setup.js npm validation must match package.json packageManager');
  }
  for (const command of [
    'npm run check:install-script-policy',
    'npm run check:install-script-policy:self-test',
  ]) {
    if (!pkg.scripts?.['test:light']?.includes(command)) {
      errors.push(`test:light must run ${command}`);
    }
  }
  return errors;
}

function loadState() {
  return {
    pkg: readJson('package.json'),
    lock: readJson('package-lock.json'),
    config: readJson('book-config.json'),
    buildSource: fs.readFileSync('scripts/build.js', 'utf8'),
    imageOptimizerSource: fs.readFileSync('scripts/image-optimizer.js', 'utf8'),
    pdfSource: fs.readFileSync('scripts/build-pdf.js', 'utf8'),
    readme: fs.readFileSync('README.md', 'utf8'),
    agentGuide: fs.readFileSync('AGENTS.md', 'utf8'),
    setupGuide: fs.readFileSync('SETUP_V2.md', 'utf8'),
    easySetupSource: fs.readFileSync('easy-setup.js', 'utf8'),
    cacheManagerSource: fs.readFileSync('scripts/cache-manager.js', 'utf8'),
    errorRecoverySource: fs.readFileSync('scripts/error-recovery.js', 'utf8'),
    initTemplateSource: fs.readFileSync('scripts/init-template.js', 'utf8'),
  };
}

function expectRejected(base, name, mutate, marker) {
  const state = clone(base);
  mutate(state);
  const errors = validate(state);
  if (!errors.some((error) => error.includes(marker))) {
    throw new Error(`self-test ${name}: mutation was not rejected (${errors.join('; ')})`);
  }
}

const state = loadState();
const errors = validate(state);
if (errors.length) {
  console.error('Install-script policy check failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

if (process.argv.includes('--self-test')) {
  const cases = [
    ['unnecessary Sharp approval', (s) => { s.pkg.allowScripts.sharp = true; }, 'unexpected install-script approvals'],
    ['Puppeteer approval', (s) => { s.pkg.allowScripts.puppeteer = true; }, 'explicitly deny'],
    ['blanket extra approval', (s) => { s.pkg.allowScripts['unknown@1.0.0'] = true; }, 'unexpected install-script approvals'],
    ['Node floor drift', (s) => { s.pkg.engines.node = '>=22'; }, 'engines.node'],
    ['npm version drift', (s) => { s.pkg.packageManager = 'npm@11.0.0'; }, 'packageManager'],
    ['Sharp install script returns', (s) => { s.lock.packages['node_modules/sharp'].hasInstallScript = true; }, 'script-free'],
    ['new unreviewed install script', (s) => { s.lock.packages['node_modules/unreviewed'] = { version: '1.0.0', hasInstallScript: true }; }, 'install-script package set'],
    ['Sharp version drift', (s) => { s.lock.packages['node_modules/sharp'].version = '0.35.2'; }, `sharp@${EXPECTED.sharpVersion}`],
    ['missing Sharp consumer', (s) => { s.imageOptimizerSource = s.imageOptimizerSource.replace("require('sharp')", "require('not-sharp')"); }, 'active consumer'],
    ['Puppeteer becomes default', (s) => { s.config.pdf.engine = 'puppeteer'; }, 'default PDF engine'],
    ['README script guard removed', (s) => { s.readme = s.readme.replace(' --ignore-scripts', ''); }, 'README.md install command'],
    ['agent guide script guard removed', (s) => { s.agentGuide = s.agentGuide.replace(' --ignore-scripts', ''); }, 'AGENTS.md install command'],
    ['setup download guard removed', (s) => { s.setupGuide = s.setupGuide.replace('PUPPETEER_SKIP_DOWNLOAD=true ', ''); }, 'SETUP_V2.md install command'],
    ['generated README guard removed', (s) => { s.easySetupSource = s.easySetupSource.replace('PUPPETEER_SKIP_DOWNLOAD=true npm install --ignore-scripts', 'npm install'); }, 'generated README install command'],
    ['recovery guidance guard removed', (s) => { s.errorRecoverySource = s.errorRecoverySource.replace('PUPPETEER_SKIP_DOWNLOAD=true npm install --ignore-scripts', 'npm install'); }, 'recovery guidance install command'],
    ['template README guard removed', (s) => { s.initTemplateSource = s.initTemplateSource.replace('PUPPETEER_SKIP_DOWNLOAD=true npm install --ignore-scripts', 'npm install'); }, 'generated README install command'],
    ['easy setup script guard removed', (s) => { s.easySetupSource = s.easySetupSource.replace('npm install --ignore-scripts ${essentialDeps', 'npm install ${essentialDeps'); }, 'easy-setup.js executable install command'],
    ['easy setup download environment bypassed', (s) => { s.easySetupSource = s.easySetupSource.replace('env: INSTALL_ENVIRONMENT', 'env: process.env'); }, 'easy-setup.js executable install command'],
    ['cache manager script guard removed', (s) => { s.cacheManagerSource = s.cacheManagerSource.replace('npm ci --ignore-scripts', 'npm ci'); }, 'cache-manager.js executable install command'],
    ['cache manager download environment bypassed', (s) => { s.cacheManagerSource = s.cacheManagerSource.replace('env: INSTALL_ENVIRONMENT', 'env: process.env'); }, 'cache-manager.js executable install command'],
    ['additional unsafe executable path', (s) => { s.cacheManagerSource += "\nexecSync('npm ci');\n"; }, 'cache-manager.js executable install command'],
    ['easy setup Node validation drift', (s) => { s.easySetupSource = s.easySetupSource.replace(EXPECTED.nodeRange, '>=22'); }, 'Node validation'],
    ['easy setup npm validation drift', (s) => { s.easySetupSource = s.easySetupSource.replace('12.0.1', '11.0.0'); }, 'npm validation'],
  ];
  cases.forEach(([name, mutate, marker]) => expectRejected(state, name, mutate, marker));
  console.log(`Install-script policy self-test passed: ${cases.length} negative mutations rejected.`);
} else {
  console.log(`Install-script policy passed: sharp@${EXPECTED.sharpVersion} is script-free; Puppeteer download denied.`);
}
