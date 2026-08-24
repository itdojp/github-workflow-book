#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const yamlParser = require('js-yaml');

const sourcePath = 'src/chapters/chapter08/index.md';
const publicPath = 'docs/chapters/chapter08/index.md';
const sectionStart = '#### 実行可能なCodeQL scanワークフロー';
const sectionEnd = '### 修正の検証';

function normalize(value) {
  return value.replace(/\r\n?/g, '\n');
}

function extractSection(content, file) {
  const normalized = normalize(content);
  const start = normalized.indexOf(sectionStart);
  const end = normalized.indexOf(sectionEnd, start + sectionStart.length);
  if (start === -1 || end === -1) {
    throw new Error(`${file}: CodeQL contract section is missing`);
  }
  return normalized.slice(start, end).trim();
}

function extractYaml(section) {
  const start = section.indexOf('```yaml\n');
  const end = section.indexOf('\n```', start + 8);
  if (start === -1 || end === -1) return '';
  return section.slice(start + 8, end);
}

function parseWorkflowYaml(yaml) {
  try {
    const workflow = yamlParser.load(yaml);
    if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
      return { workflow: null, error: 'YAMLのトップレベルはmappingである必要があります' };
    }
    return { workflow, error: null };
  } catch (error) {
    return { workflow: null, error: `YAMLとしてparseできません: ${error.message.split('\n')[0]}` };
  }
}

function actionIndex(steps, action) {
  return steps.findIndex((step) => step && typeof step === 'object' && step.uses === action);
}

function validateContract(section) {
  const errors = [];
  const yaml = extractYaml(section);
  if (!yaml) return ['実行可能なCodeQL YAML例がありません'];

  const parsed = parseWorkflowYaml(yaml);
  if (parsed.error) return [parsed.error];
  const workflow = parsed.workflow;

  const trigger = workflow.on;
  if (!trigger || typeof trigger !== 'object' || !Object.hasOwn(trigger, 'pull_request')) {
    errors.push('fork PRをscanするpull_request triggerがありません');
  }

  const permissions = workflow.permissions;
  const permissionKeys = permissions && typeof permissions === 'object' && !Array.isArray(permissions)
    ? Object.keys(permissions).sort()
    : [];
  if (
    permissionKeys.join(',') !== 'contents,security-events'
    || permissions.contents !== 'read'
    || permissions['security-events'] !== 'write'
  ) {
    errors.push('permissionsはcontents: readとsecurity-events: writeへ限定する必要があります');
  }

  const steps = workflow.jobs?.analyze?.steps;
  if (!Array.isArray(steps)) {
    errors.push('jobs.analyze.stepsがありません');
  } else {
    const checkoutIndex = actionIndex(steps, 'actions/checkout@v4');
    const initIndex = actionIndex(steps, 'github/codeql-action/init@v4');
    const analyzeIndex = actionIndex(steps, 'github/codeql-action/analyze@v4');
    for (const [index, action] of [
      [checkoutIndex, 'actions/checkout@v4'],
      [initIndex, 'github/codeql-action/init@v4'],
      [analyzeIndex, 'github/codeql-action/analyze@v4'],
    ]) {
      if (index === -1) errors.push(`YAMLに${action}がありません`);
    }
    if ([checkoutIndex, initIndex, analyzeIndex].every((index) => index >= 0)
      && !(checkoutIndex < initIndex && initIndex < analyzeIndex)) {
      errors.push('CodeQL actionの順序はcheckout → init → languageに応じたbuild → analyzeである必要があります');
    }

    const initStep = initIndex >= 0 ? steps[initIndex] : null;
    if (initStep?.with?.languages !== 'javascript-typescript' || initStep?.with?.['build-mode'] !== 'none') {
      errors.push('JavaScript / TypeScript例はlanguagesとbuild-mode: noneを明示する必要があります');
    }
    const autobuildIndex = actionIndex(steps, 'github/codeql-action/autobuild@v4');
    if (autobuildIndex !== -1) {
      errors.push('build-mode: noneのJavaScript / TypeScript例へautobuild stepを追加してはいけません');
    }
    if (steps.some((step) => /copilot-security-fix|create-pull-request/.test(String(step?.uses ?? '')))) {
      errors.push('scan jobにAI修正またはPull Request write処理を混在させてはいけません');
    }
  }

  const markers = [
    'checkout → init → languageに応じたbuild → analyze',
    'JavaScript / TypeScriptではbuildは不要',
    '`build-mode: none`',
    'compiled language',
    '`build-mode: autobuild`',
    '`build-mode: manual`',
    'untrustedなPR code',
    'scan対象',
    '同じjobで実行しない',
    'AI/Autofixは分析後の別工程',
    '人間レビュー',
    'PR codeや未検証artifactをprivileged contextで実行しません',
    'https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options',
    'https://docs.github.com/en/code-security/tutorials/customize-code-scanning/prepare-code-for-analysis',
  ];
  for (const marker of markers) {
    if (!section.includes(marker)) errors.push(`説明に必須markerがありません: ${marker}`);
  }
  return errors;
}

function expectMutationRejected(section, name, mutate, expected) {
  const mutated = mutate(section);
  if (mutated === section) throw new Error(`self-test ${name}: mutation対象がありません`);
  const errors = validateContract(mutated);
  if (!errors.some((error) => error.includes(expected))) {
    throw new Error(`self-test ${name}: 契約違反を拒否できません (${errors.join('; ')})`);
  }
}

function expectMutationAccepted(section, name, mutate) {
  const mutated = mutate(section);
  if (mutated === section) throw new Error(`self-test ${name}: mutation対象がありません`);
  const errors = validateContract(mutated);
  if (errors.length) {
    throw new Error(`self-test ${name}: 意味的に同値なYAMLを許容できません (${errors.join('; ')})`);
  }
}

const sourceSection = extractSection(fs.readFileSync(sourcePath, 'utf8'), sourcePath);
const publicSection = extractSection(fs.readFileSync(publicPath, 'utf8'), publicPath);
const errors = [
  ...validateContract(sourceSection).map((error) => `${sourcePath}: ${error}`),
  ...validateContract(publicSection).map((error) => `${publicPath}: ${error}`),
];
if (sourceSection !== publicSection) errors.push('CodeQL contract section must match between src and docs');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const required of ['npm run check:chapter08-codeql', 'npm run check:chapter08-codeql:self-test']) {
  if (!packageJson.scripts?.['test:light']?.includes(required)) errors.push(`test:light must run ${required}`);
}
if (packageJson.devDependencies?.['js-yaml'] !== '4.3.1') {
  errors.push('js-yaml 4.3.1 must be a direct, exact devDependency');
}
const workflow = normalize(fs.readFileSync('.github/workflows/book-qa.yml', 'utf8'));
for (const command of [
  'node scripts/check-chapter08-codeql-contract.js',
  'node scripts/check-chapter08-codeql-contract.js --self-test',
]) {
  if (!workflow.includes(command)) errors.push(`Book QA must run ${command}`);
}

if (errors.length) {
  console.error('Chapter 8 CodeQL contract failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

if (process.argv.includes('--self-test')) {
  expectMutationRejected(sourceSection, 'malformed YAML', (value) => value.replace('jobs:', 'jobs'), 'parseできません');
  expectMutationRejected(sourceSection, 'missing init', (value) => value.replace('github/codeql-action/init@v4', 'missing-init'), 'init@v4');
  expectMutationRejected(sourceSection, 'missing analyze', (value) => value.replace('github/codeql-action/analyze@v4', 'missing-analyze'), 'analyze@v4');
  expectMutationRejected(
    sourceSection,
    'reversed order',
    (value) => value
      .replace('github/codeql-action/init@v4', 'ORDER_PLACEHOLDER')
      .replace('github/codeql-action/analyze@v4', 'github/codeql-action/init@v4')
      .replace('ORDER_PLACEHOLDER', 'github/codeql-action/analyze@v4'),
    '順序',
  );
  expectMutationRejected(sourceSection, 'broad write', (value) => value.replace('contents: read', 'contents: write'), 'permissions');
  expectMutationRejected(
    sourceSection,
    'stale AI action',
    (value) => value.replace('github/codeql-action/analyze@v4', 'github/codeql-action/analyze@v4\n      - uses: github/copilot-security-fix@v1'),
    '混在',
  );
  expectMutationRejected(sourceSection, 'missing trust boundary', (value) => value.replaceAll('untrustedなPR code', 'PR code'), 'untrustedなPR code');
  expectMutationAccepted(
    sourceSection,
    'inline permissions map',
    (value) => value.replace('permissions:\n  contents: read\n  security-events: write', 'permissions: { contents: read, security-events: write }'),
  );
  console.log('Chapter 8 CodeQL contract self-test passed.');
} else {
  console.log('Chapter 8 CodeQL contract passed: valid YAML, init/language-dependent build/analyze order, minimum permissions, and trust boundary.');
}
