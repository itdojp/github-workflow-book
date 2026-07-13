#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const EXPECTED = {
  repo: 'itdojp/github-workflow-book',
  repoUrl: 'https://github.com/itdojp/github-workflow-book',
  repoGitUrl: 'https://github.com/itdojp/github-workflow-book.git',
  pagesUrl: 'https://itdojp.github.io/github-workflow-book/',
  packageName: 'github-workflow-book',
  version: '1.1.0',
  title: 'AI開発のためのGitHubワークフロー実践ガイド',
  description: 'ChatGPT/GitHub Copilot/Claude等のAI開発者ツールとGitHubを統合した開発手法を体系的に解説。AI時代のソフトウェア開発に必要なワークフロー、セキュリティ、ガバナンス、大規模開発の実践的ノウハウを網羅。',
  authorName: '太田和彦',
  authorOrganization: '株式会社アイティードゥ',
  authorEmail: 'knowledge@itdo.jp',
  packageLicense: 'CC-BY-NC-SA-4.0',
  bookLicense: 'CC BY-NC-SA 4.0',
  baseurl: '/github-workflow-book',
  siteUrl: 'https://itdojp.github.io'
};

const EXPECTED_NAV = {
  introduction: ['/introduction/'],
  chapters: Array.from({ length: 17 }, (_, i) => `/chapters/chapter${String(i + 1).padStart(2, '0')}/`),
  appendices: [
    ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((letter) => `/appendices/appendix-${letter}/`),
    '/appendices/checklist-pack/',
    '/appendices/figure-index/'
  ],
  afterword: ['/afterword/']
};

const errors = [];

function fail(message) {
  errors.push(message);
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`${file}: failed to read (${error.message})`);
    return '';
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    fail(`${file}: invalid JSON (${error.message})`);
    return {};
  }
}

function normalizeScalar(value) {
  if (value === undefined || value === null) return value;
  let s = String(value).trim();
  const commentIndex = s.search(/\s+#/);
  if (commentIndex >= 0) s = s.slice(0, commentIndex).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
}

function parseTopLevelYaml(file) {
  const data = {};
  for (const line of readText(file).split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) data[match[1]] = normalizeScalar(match[2]);
  }
  return data;
}

function parseFrontMatter(file) {
  const text = readText(file);
  if (!text.startsWith('---')) {
    fail(`${file}: missing YAML front matter`);
    return { data: {}, body: text };
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) {
    fail(`${file}: missing closing YAML front matter delimiter`);
    return { data: {}, body: text };
  }
  const raw = text.slice(3, end);
  const data = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) data[match[1]] = normalizeScalar(match[2]);
  }
  return { data, body: text.slice(end + 4) };
}

function parseNavigation(file) {
  const nav = {};
  let current = null;
  for (const line of readText(file).split(/\r?\n/)) {
    const section = line.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (section) {
      current = section[1];
      nav[current] = nav[current] || [];
      continue;
    }
    const pathMatch = line.match(/^\s*path:\s*(.+?)\s*$/);
    if (current && pathMatch) {
      nav[current].push(normalizeScalar(pathMatch[1]));
    }
  }
  return nav;
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectArrayEqual(label, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    fail(`${label}: expected ${expectedJson}, got ${actualJson}`);
  }
}

function expectFileExists(label, file) {
  if (!fs.existsSync(file)) {
    fail(`${label}: missing ${file}`);
  }
}

function trimTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function validatePackage() {
  const pkg = readJson('package.json');
  expectEqual('package.json name', pkg.name, EXPECTED.packageName);
  expectEqual('package.json version', pkg.version, EXPECTED.version);
  expectEqual('package.json description', pkg.description, EXPECTED.description);
  expectEqual('package.json author', pkg.author, `${EXPECTED.authorName}（${EXPECTED.authorOrganization}） <${EXPECTED.authorEmail}>`);
  expectEqual('package.json license', pkg.license, EXPECTED.packageLicense);
  expectEqual('package.json repository.type', pkg.repository && pkg.repository.type, 'git');
  expectEqual('package.json repository.url', pkg.repository && pkg.repository.url, EXPECTED.repoGitUrl);
  expectEqual('package.json homepage', pkg.homepage, EXPECTED.pagesUrl);
  expectEqual('package.json bugs.url', pkg.bugs && pkg.bugs.url, `${EXPECTED.repoUrl}/issues`);
  if (!pkg.scripts || !pkg.scripts['check:metadata']) {
    fail('package.json scripts.check:metadata: missing');
  }

  const lock = readJson('package-lock.json');
  expectEqual('package-lock.json name', lock.name, EXPECTED.packageName);
  expectEqual('package-lock.json version', lock.version, EXPECTED.version);
  const root = lock.packages && lock.packages[''];
  if (!root) {
    fail('package-lock.json packages[""]: missing root package metadata');
  } else {
    expectEqual('package-lock.json packages[""].name', root.name, EXPECTED.packageName);
    expectEqual('package-lock.json packages[""].version', root.version, EXPECTED.version);
    expectEqual('package-lock.json packages[""].license', root.license, EXPECTED.packageLicense);
  }
}

function validateBookConfig() {
  const cfg = readJson('book-config.json');
  const book = cfg.book || {};
  expectEqual('book-config.json book.title', book.title, EXPECTED.title);
  expectEqual('book-config.json book.version', book.version, EXPECTED.version);
  expectEqual('book-config.json book.description', book.description, EXPECTED.description);
  expectEqual('book-config.json book.author.name', book.author && book.author.name, EXPECTED.authorName);
  expectEqual('book-config.json book.author.email', book.author && book.author.email, EXPECTED.authorEmail);
  expectEqual('book-config.json book.author.organization', book.author && book.author.organization, EXPECTED.authorOrganization);
  expectEqual('book-config.json book.license', book.license, EXPECTED.bookLicense);
  expectEqual('book-config.json book.repository.url', book.repository && book.repository.url, EXPECTED.repoUrl);
  expectEqual('book-config.json deployment.sourceFolder', cfg.deployment && cfg.deployment.sourceFolder, 'docs');
  expectEqual('book-config.json deployment.siteUrl', cfg.deployment && cfg.deployment.siteUrl, EXPECTED.pagesUrl);
}

function validateJekyllConfig() {
  const cfg = parseTopLevelYaml('docs/_config.yml');
  expectEqual('docs/_config.yml title', cfg.title, EXPECTED.title);
  expectEqual('docs/_config.yml version', cfg.version, EXPECTED.version);
  expectEqual('docs/_config.yml description', cfg.description, EXPECTED.description);
  expectEqual('docs/_config.yml author', cfg.author, EXPECTED.authorName);
  expectEqual('docs/_config.yml baseurl', cfg.baseurl, EXPECTED.baseurl);
  expectEqual('docs/_config.yml url', trimTrailingSlash(cfg.url), EXPECTED.siteUrl);
  expectEqual('docs/_config.yml repository', cfg.repository, EXPECTED.repoUrl);
}

function validateIndex() {
  const { data, body } = parseFrontMatter('docs/index.md');
  expectEqual('docs/index.md front matter title', data.title, EXPECTED.title);
  expectEqual('docs/index.md front matter author', data.author, EXPECTED.authorName);
  expectEqual('docs/index.md front matter version', data.version, EXPECTED.version);
  expectEqual('docs/index.md front matter permalink', data.permalink, '/');
  expectEqual('docs/index.md contains book description', body.includes(EXPECTED.description), true);

  const allPaths = Object.values(EXPECTED_NAV).flat();
  for (const navPath of allPaths) {
    const relative = navPath.replace(/^\//, '');
    if (!body.includes(`](${relative})`)) {
      fail(`docs/index.md ToC: missing link target ${relative}`);
    }
  }
}

function validateNavigation() {
  const nav = parseNavigation('docs/_data/navigation.yml');
  for (const [section, expected] of Object.entries(EXPECTED_NAV)) {
    expectArrayEqual(`docs/_data/navigation.yml ${section} paths`, nav[section] || [], expected);
  }

  const allPaths = Object.values(nav).flat();
  const duplicates = allPaths.filter((item, idx) => allPaths.indexOf(item) !== idx);
  if (duplicates.length) {
    fail(`docs/_data/navigation.yml duplicate paths: ${JSON.stringify([...new Set(duplicates)])}`);
  }

  for (const navPath of Object.values(EXPECTED_NAV).flat()) {
    const file = path.join('docs', navPath.replace(/^\//, ''), 'index.md');
    expectFileExists(`navigation path ${navPath}`, file);
  }
}

validatePackage();
validateBookConfig();
validateJekyllConfig();
validateIndex();
validateNavigation();

if (errors.length) {
  console.error('Metadata consistency check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Metadata consistency check passed.');
