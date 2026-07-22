#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const EXPECTED = Object.freeze({
  sharpRange: '^0.35.3',
  sharpVersion: '0.35.3',
  puppeteerRange: '^24.43.1',
  nodeRange: '^20.9.0 || >=22',
  defaultPdfEngine: 'pandoc',
});

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validate(state) {
  const errors = [];
  const { pkg, lock, config, buildSource, imageOptimizerSource, pdfSource, readme } = state;
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
  if (puppeteer?.version !== '24.43.1' || puppeteer?.hasInstallScript !== true) {
    errors.push('lockfile must resolve install-script-bearing puppeteer@24.43.1');
  }
  const expectedInstallScripts = ['node_modules/puppeteer@24.43.1'];
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
  if (!readme.includes('PUPPETEER_SKIP_DOWNLOAD=true npm ci')) {
    errors.push('README must retain the no-browser-download installation path');
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
    ['Node floor drift', (s) => { s.pkg.engines.node = '20 || >=22'; }, 'engines.node'],
    ['Sharp install script returns', (s) => { s.lock.packages['node_modules/sharp'].hasInstallScript = true; }, 'script-free'],
    ['new unreviewed install script', (s) => { s.lock.packages['node_modules/unreviewed'] = { version: '1.0.0', hasInstallScript: true }; }, 'install-script package set'],
    ['Sharp version drift', (s) => { s.lock.packages['node_modules/sharp'].version = '0.35.2'; }, `sharp@${EXPECTED.sharpVersion}`],
    ['missing Sharp consumer', (s) => { s.imageOptimizerSource = s.imageOptimizerSource.replace("require('sharp')", "require('not-sharp')"); }, 'active consumer'],
    ['Puppeteer becomes default', (s) => { s.config.pdf.engine = 'puppeteer'; }, 'default PDF engine'],
    ['download guard removed', (s) => { s.readme = s.readme.replace('PUPPETEER_SKIP_DOWNLOAD=true npm ci', 'npm ci'); }, 'no-browser-download'],
  ];
  cases.forEach(([name, mutate, marker]) => expectRejected(state, name, mutate, marker));
  console.log(`Install-script policy self-test passed: ${cases.length} negative mutations rejected.`);
} else {
  console.log(`Install-script policy passed: sharp@${EXPECTED.sharpVersion} is script-free; Puppeteer download denied.`);
}
