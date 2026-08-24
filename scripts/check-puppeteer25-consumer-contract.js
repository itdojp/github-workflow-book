#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { generatePDFWithPuppeteer } = require('./build-pdf');
const { AccessibilityTester } = require('./accessibility-test');

function assertFlow(label, actual, expected) {
  assert.deepEqual(actual, expected, `${label} did not execute the required Puppeteer consumer flow`);
}

async function runPdfConsumer(temporaryDirectory) {
  const events = [];
  const inputPath = path.join(temporaryDirectory, 'input.md');
  const outputPath = path.join(temporaryDirectory, 'output.pdf');
  fs.writeFileSync(inputPath, '# Contract fixture\n', 'utf8');

  const page = {
    async setContent(html) {
      events.push('setContent');
      assert.match(html, /<h1>Contract fixture<\/h1>/);
      assert.match(html, /<title>Contract book<\/title>/);
    },
    async pdf(options) {
      events.push('pdf');
      assert.equal(options.path, outputPath);
      assert.equal(options.format, 'A4');
      assert.equal(options.printBackground, true);
    },
    async close() {
      events.push('page.close');
    },
  };
  const browser = {
    async newPage() {
      events.push('newPage');
      return page;
    },
    async close() {
      events.push('browser.close');
    },
  };
  const puppeteer = {
    async launch() {
      events.push('launch');
      return browser;
    },
  };
  const marked = {
    parse(markdown) {
      assert.equal(markdown, '# Contract fixture\n');
      return '<h1>Contract fixture</h1>';
    },
  };
  const config = {
    book: { title: 'Contract book' },
    pdf: { paperSize: 'A4', margin: '2cm', fontFamily: 'sans-serif', fontSize: '11pt' },
  };

  await generatePDFWithPuppeteer(inputPath, outputPath, config, { puppeteer, marked });
  assertFlow('scripts/build-pdf.js', events, [
    'launch',
    'newPage',
    'setContent',
    'pdf',
    'page.close',
    'browser.close',
  ]);
}

async function runAccessibilityConsumer(temporaryDirectory) {
  const events = [];
  const htmlPath = path.join(temporaryDirectory, 'fixture.html');
  fs.writeFileSync(htmlPath, '<!doctype html><title>fixture</title>', 'utf8');

  const page = {
    async goto(url) {
      events.push('goto');
      assert.equal(url, `file://${path.resolve(htmlPath)}`);
    },
    async close() {
      events.push('page.close');
    },
  };
  const browser = {
    async newPage() {
      events.push('newPage');
      return page;
    },
    async close() {
      events.push('browser.close');
    },
  };
  const puppeteer = {
    async launch(options) {
      events.push('launch');
      assert.equal(options.headless, true);
      assert.deepEqual(options.args, ['--no-sandbox', '--disable-setuid-sandbox']);
      return browser;
    },
  };
  class MockAxePuppeteer {
    constructor(receivedPage) {
      events.push('axe.constructor');
      assert.equal(receivedPage, page);
    }

    withTags(tags) {
      events.push('axe.withTags');
      assert.deepEqual(tags, ['wcag2a', 'wcag2aa', 'wcag21aa']);
      return this;
    }

    async analyze() {
      events.push('axe.analyze');
      return { violations: [] };
    }
  }

  const tester = new AccessibilityTester({
    puppeteer,
    AxePuppeteer: MockAxePuppeteer,
    glob: { sync: () => { throw new Error('directory scan is outside this bounded test'); } },
  });
  await tester.init();
  await tester.testFile(htmlPath);
  await tester.cleanup();

  assert.deepEqual(tester.results.passed, [htmlPath]);
  assertFlow('scripts/accessibility-test.js', events, [
    'launch',
    'newPage',
    'goto',
    'axe.constructor',
    'axe.withTags',
    'axe.analyze',
    'page.close',
    'browser.close',
  ]);
}

function runNegativeControls() {
  const commentOnlyEvents = [];
  const commentOnlyConsumer = () => {
    // await puppeteer.launch(); await browser.newPage(); await page.setContent();
    // await page.pdf(); await page.close(); await browser.close();
  };
  commentOnlyConsumer();
  assert.throws(
    () => assertFlow('comment-only consumer', commentOnlyEvents, ['launch', 'newPage', 'pdf', 'browser.close']),
    /required Puppeteer consumer flow/,
  );

  assert.throws(
    () => assertFlow('wrong-order consumer', ['launch', 'pdf', 'newPage', 'browser.close'], ['launch', 'newPage', 'pdf', 'browser.close']),
    /required Puppeteer consumer flow/,
  );
}

async function main() {
  const temporaryDirectory = fs.mkdtempSync(path.resolve('.puppeteer25-consumer-contract-'));
  try {
    await runPdfConsumer(temporaryDirectory);
    await runAccessibilityConsumer(temporaryDirectory);
    if (process.argv.includes('--self-test')) runNegativeControls();
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }

  const suffix = process.argv.includes('--self-test')
    ? '; comment-only and wrong-order negative controls rejected'
    : '';
  console.log(`Puppeteer 25 mock-consumer contract passed${suffix}.`);
}

main().catch((error) => {
  console.error(`Puppeteer 25 mock-consumer contract failed: ${error.stack || error.message}`);
  process.exit(1);
});
