#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yamlParser = require('js-yaml');

const EXPECTED = Object.freeze({
  sharpRange: '^0.35.3',
  sharpVersion: '0.35.3',
  puppeteerRange: '^25.8.0',
  puppeteerVersion: '25.8.0',
  nodeRange: '^22.22.2 || ^24.15.0 || >=26.0.0',
  packageManager: 'npm@12.0.1',
  defaultPdfEngine: 'pandoc',
});

// Install command locations are deliberately classified. Published book text,
// generic examples, issue templates and disabled workflows are inventoried but
// excluded from this operational dependency-install safety contract.
const INSTALL_SURFACE_RULES = Object.freeze({
  'README.md': 'documentation',
  'AGENTS.md': 'documentation',
  'SETUP_V2.md': 'documentation',
  'DEVELOPMENT.md': 'documentation',
  'ZENN_BOOK_CONFIG.md': 'documentation',
  '.github/workflows/book-qa.yml': 'active-workflow',
  'easy-setup.js': 'executable-and-generated-guidance',
  'scripts/cache-manager.js': 'executable-javascript',
  'scripts/error-recovery.js': 'generated-guidance',
  'scripts/init-template.js': 'generated-guidance',
  'scripts/publication_manager.py': 'publication-guidance-no-install',
  'scripts/check-install-script-policy.js': 'contract-self-test-fixtures',
});

const EXCLUDED_INSTALL_SURFACES = Object.freeze([
  ['book-content', /^(?:docs|src|github-workflow-book)\//],
  ['generic-example', /^examples\//],
  ['issue-template-example', /^\.github\/ISSUE_TEMPLATE\//],
  ['disabled-workflow', /^\.github\/workflows\/.*\.disabled$/],
  ['historical-project-record', /^(?:project-management|release-notes)\//],
]);

const TEXT_INSTALL_PATTERN = /\bnpm\s+(?:ci|install)(?=\s|$)|\bnpx(?:\s+--[^\s]+)*\s+npm@[^\s]+\s+(?:ci|install)(?=\s|$)/m;
const SPAWN_INSTALL_PATTERN = /\b(?:spawn|spawnSync|execFile|execFileSync)\s*\(\s*(['\"]?)npm\1\s*,\s*\[\s*(['\"])(?:ci|install)\2/m;
const LIFECYCLE_FIXTURE = path.resolve('tests/fixtures/install-script-policy');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(source) {
  return source.replace(/\r\n?/g, '\n');
}

function containsInstallIntent(source) {
  return TEXT_INSTALL_PATTERN.test(source) || SPAWN_INSTALL_PATTERN.test(source);
}

function stripShellComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '#' && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index).trim();
    }
  }
  return line.trim();
}

function extractInstallCommand(line) {
  const command = stripShellComment(line);
  return containsInstallIntent(command) ? command : null;
}

function extractOperationalDocumentationCommands(source, includeInline = true) {
  const normalized = normalize(source).replaceAll('\\`', '`');
  const commands = [];
  let shellFence = false;
  for (const line of normalized.split('\n')) {
    const fence = /^\s*```\s*([^\s`]*)/.exec(line);
    if (fence) {
      shellFence = shellFence ? false : /^(?:bash|sh|shell|console)$/.test(fence[1]);
      continue;
    }
    if (shellFence) {
      const command = extractInstallCommand(line);
      if (command) commands.push(command);
    }
    if (!includeInline) continue;
    const inlinePattern = /`([^`\n]+)`/g;
    let match;
    while ((match = inlinePattern.exec(line)) !== null) {
      const command = extractInstallCommand(match[1]);
      if (command) commands.push(command);
    }
  }
  return [...new Set(commands)];
}

function validateGuardedCommand(errors, label, command, environmentSource = null, requireEnvironment = true) {
  if (!/(?:^|\s)--ignore-scripts(?=\s|$)/.test(command)) {
    errors.push(`${label} install command must use --ignore-scripts`);
  }
  if (requireEnvironment
    && !/(?:^|\s)PUPPETEER_SKIP_DOWNLOAD=true(?=\s|$)/.test(command)
    && environmentSource !== 'INSTALL_ENVIRONMENT') {
    errors.push(`${label} install command must disable Puppeteer browser downloads`);
  }
}

function validateOperationalDocumentation(errors, file, source, includeInline = true) {
  const commands = extractOperationalDocumentationCommands(source, includeInline);
  if (!commands.length) errors.push(`${file} must document a guarded npm install command`);
  commands.forEach((command) => validateGuardedCommand(errors, file, command));
}

function findOperationalExecutableCalls(source) {
  const calls = [];
  const shellPattern = /\b(execSync|exec)\s*\(\s*([`'\"])([\s\S]*?)\2\s*(?:,\s*(\{[\s\S]*?\}))?\s*\)/g;
  let match;
  while ((match = shellPattern.exec(source)) !== null) {
    if (containsInstallIntent(match[3])) {
      calls.push({ functionName: match[1], command: match[3], options: match[4] });
    }
  }
  const argvPattern = /\b(spawnSync|spawn|execFileSync|execFile)\s*\(\s*(['\"])npm\2\s*,\s*\[([\s\S]*?)\]\s*(?:,\s*(\{[\s\S]*?\}))?\s*\)/g;
  while ((match = argvPattern.exec(source)) !== null) {
    const args = [...match[3].matchAll(/(['\"])(.*?)\1/g)].map((entry) => entry[2]);
    if (['ci', 'install'].includes(args[0])) {
      calls.push({ functionName: match[1], command: `npm ${args.join(' ')}`, options: match[4] });
    }
  }
  return calls;
}

function validateOperationalExecutable(errors, file, source) {
  const calls = findOperationalExecutableCalls(source);
  if (!calls.length) {
    errors.push(`${file} must retain its guarded executable npm install path`);
    return;
  }
  calls.forEach(({ functionName, command, options }) => {
    const environmentSource = /env\s*:\s*INSTALL_ENVIRONMENT/.test(options ?? '')
      ? 'INSTALL_ENVIRONMENT'
      : null;
    validateGuardedCommand(errors, `${file} ${functionName}`, command, environmentSource);
  });
}

function validateGeneratedGuidance(errors, file, source) {
  const commands = [];
  const pattern = /([`'\"])([^\r\n]*?\bnpm\s+(?:ci|install)(?=\s|$)[^\r\n]*?)\1/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    if (!source.slice(lineStart, match.index).trimStart().startsWith('//')) commands.push(match[2]);
  }
  if (!commands.length) errors.push(`${file} must retain guarded generated install guidance`);
  commands.forEach((command) => validateGuardedCommand(errors, file, command));
}

function validateWorkflowInstallCommands(errors, source) {
  let workflow;
  try {
    workflow = yamlParser.load(source);
  } catch (error) {
    errors.push(`.github/workflows/book-qa.yml must be valid YAML: ${error.message.split('\n')[0]}`);
    return;
  }
  const root = [];
  const formatter = [];
  for (const [jobName, job] of Object.entries(workflow?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      if (typeof step?.run !== 'string') continue;
      const commands = normalize(step.run).split('\n').map(extractInstallCommand).filter(Boolean);
      for (const command of commands) {
        const workingDirectory = step['working-directory'] ?? job.defaults?.run?.['working-directory'] ?? '.';
        if (workingDirectory === 'book-formatter') {
          formatter.push(command);
          validateGuardedCommand(errors, `Book QA formatter-checkout step ${step.name}`, command, null, false);
        } else if (workingDirectory === '.') {
          root.push(command);
          const environment = { ...(workflow.env ?? {}), ...(job.env ?? {}), ...(step.env ?? {}) };
          const environmentSource = String(environment.PUPPETEER_SKIP_DOWNLOAD) === 'true'
            ? 'INSTALL_ENVIRONMENT'
            : null;
          validateGuardedCommand(errors, `Book QA root step ${step.name}`, command, environmentSource);
        } else {
          errors.push(`Book QA install step has unclassified working-directory: ${jobName}/${step.name}/${workingDirectory}`);
        }
      }
    }
  }
  if (root.length !== 1) errors.push(`Book QA must have one classified root install command (found ${root.length})`);
  if (formatter.length !== 1) errors.push(`Book QA must have one formatter-checkout install command (found ${formatter.length})`);
}

function classifyInstallSurface(file) {
  if (Object.hasOwn(INSTALL_SURFACE_RULES, file)) return INSTALL_SURFACE_RULES[file];
  return EXCLUDED_INSTALL_SURFACES.find(([, pattern]) => pattern.test(file))?.[0] ?? null;
}

function validateInstallSurfaceInventory(errors, surfaces) {
  for (const file of Object.keys(INSTALL_SURFACE_RULES)) {
    if (!Object.hasOwn(surfaces, file)) errors.push(`required install surface is missing: ${file}`);
  }
  for (const [file, source] of Object.entries(surfaces)) {
    if (containsInstallIntent(source) && !classifyInstallSurface(file)) {
      errors.push(`unclassified npm install surface: ${file}`);
    }
  }
}

function listTrackedInstallSurfaces() {
  const result = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`could not enumerate tracked install surfaces: ${result.error?.message ?? result.stderr}`);
  }
  const surfaces = {};
  for (const file of result.stdout.split('\0').filter(Boolean).sort()) {
    if (!/\.(?:c?js|mjs|py|sh|md|ya?ml|disabled)$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (containsInstallIntent(source) || Object.hasOwn(INSTALL_SURFACE_RULES, file)) surfaces[file] = source;
  }
  for (const file of Object.keys(INSTALL_SURFACE_RULES)) {
    if (!Object.hasOwn(surfaces, file)) surfaces[file] = fs.readFileSync(file, 'utf8');
  }
  return surfaces;
}

function validateNodeRuntimeContract(errors, easySetupSource) {
  if (!easySetupSource.includes(`const REQUIRED_NODE_RANGE = '${EXPECTED.nodeRange}';`)
    || !easySetupSource.includes('isSupportedNodeVersion(nodeVersion)')
    || !easySetupSource.includes('module.exports.isSupportedNodeVersion = isSupportedNodeVersion;')) {
    errors.push('easy-setup.js Node validation/export must match package.json engines.node');
    return;
  }
  const EasySetup = require(path.resolve('easy-setup.js'));
  const isSupported = EasySetup.isSupportedNodeVersion;
  for (const version of ['22.22.1', '23.0.0', '24.14.0', '25.0.0']) {
    if (isSupported(version) !== false) errors.push(`easy-setup.js must reject Node ${version} at runtime`);
  }
  for (const version of ['22.22.2', '24.15.0', '26.0.0', '27.1.0']) {
    if (isSupported(version) !== true) errors.push(`easy-setup.js must accept Node ${version} at runtime`);
  }
}

function validatePuppeteerApiContract(errors, surfaces, lock) {
  const markerContracts = [
    ['scripts/build-pdf.js', "require('puppeteer')"],
    ['scripts/build-pdf.js', 'await puppeteer.launch('],
    ['scripts/build-pdf.js', 'await browser.newPage('],
    ['scripts/build-pdf.js', 'await page.setContent('],
    ['scripts/build-pdf.js', 'await page.pdf('],
    ['scripts/build-pdf.js', 'await browser.close('],
    ['scripts/accessibility-test.js', "require('puppeteer')"],
    ['scripts/accessibility-test.js', 'await puppeteer.launch('],
    ['scripts/accessibility-test.js', 'await this.browser.newPage('],
    ['scripts/accessibility-test.js', 'await page.goto('],
    ['scripts/accessibility-test.js', 'await page.close('],
    ['scripts/accessibility-test.js', 'await this.browser.close('],
  ];
  for (const [file, marker] of markerContracts) {
    if (!surfaces[file]?.includes(marker)) errors.push(`${file} must retain Puppeteer 25 API use: ${marker}`);
  }
  if (lock.packages?.['node_modules/puppeteer-core']?.version !== EXPECTED.puppeteerVersion) {
    errors.push(`lockfile must resolve puppeteer-core@${EXPECTED.puppeteerVersion}`);
  }
  try {
    const puppeteer = require(path.resolve('node_modules/puppeteer'));
    if (typeof puppeteer.launch !== 'function') errors.push('installed Puppeteer 25 must expose launch()');
  } catch (error) {
    errors.push(`installed Puppeteer 25 static smoke failed: ${error.message}`);
  }
}

function runLifecycleIsolationIntegration() {
  const versions = ['10.9.7', '12.0.1'];
  for (const version of versions) {
    const temporaryDirectory = fs.mkdtempSync(path.resolve(`.install-policy-lifecycle-npm-${version}-`));
    const markerPath = path.join(temporaryDirectory, 'side-effect-marker');
    try {
      fs.cpSync(LIFECYCLE_FIXTURE, temporaryDirectory, { recursive: true });
      const result = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['--yes', `npm@${version}`, 'ci', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'],
        {
          cwd: temporaryDirectory,
          encoding: 'utf8',
          env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true' },
        },
      );
      if (result.error || result.status !== 0) {
        throw new Error(`npm ${version} local lifecycle fixture failed: ${result.error?.message ?? result.stderr}`);
      }
      if (!fs.existsSync(path.join(temporaryDirectory, 'node_modules/lifecycle-side-effect/package.json'))) {
        throw new Error(`npm ${version} did not install the local lifecycle fixture`);
      }
      if (fs.existsSync(markerPath)) {
        throw new Error(`npm ${version} executed a local lifecycle script despite --ignore-scripts`);
      }
    } finally {
      fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  }
  return versions;
}

function validate(state) {
  const errors = [];
  const {
    pkg,
    lock,
    config,
    buildSource,
    imageOptimizerSource,
    surfaces,
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
  if (puppeteer?.version !== EXPECTED.puppeteerVersion || puppeteer?.hasInstallScript !== true) {
    errors.push(`lockfile must resolve install-script-bearing puppeteer@${EXPECTED.puppeteerVersion}`);
  }
  const expectedInstallScripts = [`node_modules/puppeteer@${EXPECTED.puppeteerVersion}`];
  if (JSON.stringify(installScriptPackages) !== JSON.stringify(expectedInstallScripts)) {
    errors.push(`unexpected install-script package set: ${JSON.stringify(installScriptPackages)}`);
  }
  if (!buildSource.includes("require('./image-optimizer')")) {
    errors.push('build:full must retain the active image optimizer');
  }
  if (!imageOptimizerSource.includes("require('sharp')")) {
    errors.push('the script-free Sharp dependency must retain an active consumer');
  }
  if (config.pdf?.engine !== EXPECTED.defaultPdfEngine) {
    errors.push(`default PDF engine must remain ${EXPECTED.defaultPdfEngine}`);
  }
  validateInstallSurfaceInventory(errors, surfaces);
  for (const file of ['README.md', 'AGENTS.md', 'SETUP_V2.md', 'DEVELOPMENT.md', 'ZENN_BOOK_CONFIG.md']) {
    validateOperationalDocumentation(errors, file, surfaces[file] ?? '');
  }
  validateWorkflowInstallCommands(errors, surfaces['.github/workflows/book-qa.yml'] ?? '');
  validateOperationalExecutable(errors, 'easy-setup.js', surfaces['easy-setup.js'] ?? '');
  validateOperationalDocumentation(errors, 'easy-setup.js generated README', surfaces['easy-setup.js'] ?? '', false);
  validateOperationalExecutable(errors, 'scripts/cache-manager.js', surfaces['scripts/cache-manager.js'] ?? '');
  validateGeneratedGuidance(errors, 'scripts/error-recovery.js', surfaces['scripts/error-recovery.js'] ?? '');
  validateOperationalDocumentation(errors, 'scripts/init-template.js generated README', surfaces['scripts/init-template.js'] ?? '', false);
  if (containsInstallIntent(surfaces['scripts/publication_manager.py'] ?? '')) {
    errors.push('scripts/publication_manager.py must not direct users to an undeclared zenn/ npm install path');
  }
  validateNodeRuntimeContract(errors, surfaces['easy-setup.js'] ?? '');
  validatePuppeteerApiContract(errors, surfaces, lock);
  const expectedNpmVersion = EXPECTED.packageManager.slice('npm@'.length);
  if (!(surfaces['easy-setup.js'] ?? '').includes(`const REQUIRED_NPM_VERSION = '${expectedNpmVersion}';`)
    || !(surfaces['easy-setup.js'] ?? '').includes('npmVersion !== REQUIRED_NPM_VERSION')) {
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
  const surfaces = listTrackedInstallSurfaces();
  surfaces['scripts/build-pdf.js'] = fs.readFileSync('scripts/build-pdf.js', 'utf8');
  surfaces['scripts/accessibility-test.js'] = fs.readFileSync('scripts/accessibility-test.js', 'utf8');
  return {
    pkg: readJson('package.json'),
    lock: readJson('package-lock.json'),
    config: readJson('book-config.json'),
    buildSource: fs.readFileSync('scripts/build.js', 'utf8'),
    imageOptimizerSource: fs.readFileSync('scripts/image-optimizer.js', 'utf8'),
    surfaces,
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
    ['README script guard removed', (s) => { s.surfaces['README.md'] = s.surfaces['README.md'].replace(' --ignore-scripts', ''); }, 'README.md install command'],
    ['README comment-only guard', (s) => { s.surfaces['README.md'] = s.surfaces['README.md'].replace('PUPPETEER_SKIP_DOWNLOAD=true npm ci --ignore-scripts', '# PUPPETEER_SKIP_DOWNLOAD=true npm ci --ignore-scripts\nnpm ci'); }, 'README.md install command'],
    ['agent guide script guard removed', (s) => { s.surfaces['AGENTS.md'] = s.surfaces['AGENTS.md'].replace(' --ignore-scripts', ''); }, 'AGENTS.md install command'],
    ['setup download guard removed', (s) => { s.surfaces['SETUP_V2.md'] = s.surfaces['SETUP_V2.md'].replace('PUPPETEER_SKIP_DOWNLOAD=true ', ''); }, 'SETUP_V2.md install command'],
    ['development download guard removed', (s) => { s.surfaces['DEVELOPMENT.md'] = s.surfaces['DEVELOPMENT.md'].replace('PUPPETEER_SKIP_DOWNLOAD=true ', ''); }, 'DEVELOPMENT.md install command'],
    ['Zenn script guard removed', (s) => { s.surfaces['ZENN_BOOK_CONFIG.md'] = s.surfaces['ZENN_BOOK_CONFIG.md'].replace(' --ignore-scripts', ''); }, 'ZENN_BOOK_CONFIG.md install command'],
    ['generated README guard removed', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('PUPPETEER_SKIP_DOWNLOAD=true npm install --ignore-scripts', 'npm install'); }, 'generated README install command'],
    ['recovery guidance guard removed', (s) => { s.surfaces['scripts/error-recovery.js'] = s.surfaces['scripts/error-recovery.js'].replaceAll('PUPPETEER_SKIP_DOWNLOAD=true npm install --ignore-scripts', 'npm install'); }, 'scripts/error-recovery.js install command'],
    ['template README guard removed', (s) => { s.surfaces['scripts/init-template.js'] = s.surfaces['scripts/init-template.js'].replace('PUPPETEER_SKIP_DOWNLOAD=true npm install --ignore-scripts', 'npm install'); }, 'scripts/init-template.js generated README install command'],
    ['easy setup script guard removed', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('npm install --ignore-scripts ${essentialDeps', 'npm install ${essentialDeps'); }, 'easy-setup.js execSync install command'],
    ['easy setup download environment bypassed', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('env: INSTALL_ENVIRONMENT', 'env: process.env'); }, 'Puppeteer browser downloads'],
    ['cache manager script guard removed', (s) => { s.surfaces['scripts/cache-manager.js'] = s.surfaces['scripts/cache-manager.js'].replace('npm ci --ignore-scripts', 'npm ci'); }, 'cache-manager.js execSync install command'],
    ['cache manager comment-only guard', (s) => { s.surfaces['scripts/cache-manager.js'] = s.surfaces['scripts/cache-manager.js'].replace("execSync('npm ci --ignore-scripts'", "execSync('npm ci' /* --ignore-scripts */"); }, 'guarded executable npm install path'],
    ['additional unsafe exec path', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecSync('npm ci');\n"; }, 'cache-manager.js execSync install command'],
    ['additional unsafe spawn path', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nspawnSync('npm', ['ci'], { env: INSTALL_ENVIRONMENT });\n"; }, 'cache-manager.js spawnSync install command'],
    ['new unclassified operational path', (s) => { s.surfaces['scripts/new-installer.js'] = "spawnSync('npm', ['ci', '--ignore-scripts']);\n"; }, 'unclassified npm install surface'],
    ['required path removed', (s) => { delete s.surfaces['DEVELOPMENT.md']; }, 'required install surface is missing'],
    ['legacy zenn install guidance restored', (s) => { s.surfaces['scripts/publication_manager.py'] += '\ncd zenn && npm install\n'; }, 'undeclared zenn/'],
    ['workflow root script guard removed', (s) => { s.surfaces['.github/workflows/book-qa.yml'] = s.surfaces['.github/workflows/book-qa.yml'].replace('ci --ignore-scripts', 'ci'); }, 'Book QA root step'],
    ['workflow formatter script guard removed', (s) => { s.surfaces['.github/workflows/book-qa.yml'] = s.surfaces['.github/workflows/book-qa.yml'].replace('npm ci --ignore-scripts', 'npm ci'); }, 'formatter-checkout'],
    ['workflow comment-only guard', (s) => { s.surfaces['.github/workflows/book-qa.yml'] = s.surfaces['.github/workflows/book-qa.yml'].replace('run: npx --yes npm@12.0.1 ci --ignore-scripts', 'run: |\n          # PUPPETEER_SKIP_DOWNLOAD=true npx --yes npm@12.0.1 ci --ignore-scripts\n          npx --yes npm@12.0.1 ci'); }, 'Book QA root step'],
    ['easy setup Node validation drift', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace(EXPECTED.nodeRange, '>=22'); }, 'Node validation/export'],
    ['easy setup Node export removed', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('module.exports.isSupportedNodeVersion = isSupportedNodeVersion;', ''); }, 'Node validation/export'],
    ['easy setup npm validation drift', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('12.0.1', '11.0.0'); }, 'npm validation'],
    ['Puppeteer PDF API drift', (s) => { s.surfaces['scripts/build-pdf.js'] = s.surfaces['scripts/build-pdf.js'].replace('await page.pdf(', 'await page.renderPdf('); }, 'Puppeteer 25 API use'],
    ['Puppeteer accessibility API drift', (s) => { s.surfaces['scripts/accessibility-test.js'] = s.surfaces['scripts/accessibility-test.js'].replace('await page.goto(', 'await page.navigate('); }, 'Puppeteer 25 API use'],
  ];
  cases.forEach(([name, mutate, marker]) => expectRejected(state, name, mutate, marker));
  const npmVersions = runLifecycleIsolationIntegration();
  console.log(`Install-script policy self-test passed: ${cases.length} negative mutations rejected; local lifecycle fixture isolated with npm ${npmVersions.join(' and npm ')}.`);
} else {
  const classifiedCount = Object.entries(state.surfaces)
    .filter(([, source]) => containsInstallIntent(source))
    .filter(([file]) => classifyInstallSurface(file)).length;
  console.log(`Install-script policy passed: ${classifiedCount} install surfaces classified; Puppeteer 25 static API smoke passed.`);
}
