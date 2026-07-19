#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const yamlParser = require('js-yaml');

const sourcePath = 'src/chapters/chapter08/index.md';
const publicPath = 'docs/chapters/chapter08/index.md';
const sectionStart = '### Dependency reviewワークフロー';
const sectionEnd = '### ライセンスコンプライアンス';

function normalize(value) {
  return value.replace(/\r\n?/g, '\n');
}

function readRequired(file) {
  try {
    return normalize(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Chapter 8 dependency review contract failed: ${file}を読み込めません (${error.code ?? error.message})`);
    process.exit(1);
  }
}

function extractSection(content, file) {
  const start = content.indexOf(sectionStart);
  const end = content.indexOf(sectionEnd, start + sectionStart.length);
  if (start === -1 || end === -1) throw new Error(`${file}: dependency review section is missing`);
  return content.slice(start, end).trim();
}

function extractYaml(section) {
  const match = section.match(/```yaml\n([\s\S]*?)\n```/);
  return match?.[1] ?? '';
}

function validate(section) {
  const errors = [];
  const yaml = extractYaml(section);
  if (!yaml) return ['dependency review YAML例がありません'];

  let workflow;
  try {
    workflow = yamlParser.load(yaml);
  } catch (error) {
    return [`YAMLとしてparseできません: ${error.message.split('\n')[0]}`];
  }
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return ['YAMLのトップレベルはmappingである必要があります'];
  }

  const trigger = workflow.on;
  if (!trigger || typeof trigger !== 'object' || !Object.hasOwn(trigger, 'pull_request')) {
    errors.push('pull_request triggerがありません');
  } else {
    const pullRequest = trigger.pull_request;
    if (pullRequest && typeof pullRequest === 'object'
      && ['paths', 'paths-ignore'].some((key) => Object.hasOwn(pullRequest, key))) {
      errors.push('required checkをskipさせるpull_requestのpath filterは使用できません');
    }
  }
  if (!trigger || typeof trigger !== 'object' || !Object.hasOwn(trigger, 'merge_group')) {
    errors.push('merge_group triggerがありません');
  } else {
    const types = trigger.merge_group?.types;
    if (!Array.isArray(types) || types.length !== 1 || types[0] !== 'checks_requested') {
      errors.push('merge_groupはchecks_requestedだけを購読する必要があります');
    }
    if (['paths', 'paths-ignore'].some((key) => Object.hasOwn(trigger.merge_group ?? {}, key))) {
      errors.push('required checkをskipさせるmerge_groupのpath filterは使用できません');
    }
  }

  const permissions = workflow.permissions;
  if (!permissions || typeof permissions !== 'object'
    || Object.keys(permissions).length !== 1 || permissions.contents !== 'read') {
    errors.push('permissionsはcontents: readだけへ限定する必要があります');
  }

  const job = workflow.jobs?.['dependency-review'];
  if (!job) {
    errors.push('dependency-review jobがありません');
  } else {
    if (job.name !== 'Dependency Review') errors.push('required check用job名はDependency Reviewへ固定する必要があります');
    if (Object.hasOwn(job, 'permissions')) errors.push('job-level permissionsで最小権限を上書きできません');
    if (Object.hasOwn(job, 'if')) errors.push('merge_groupでjobをskipし得るjob-level ifは使用できません');
    const steps = Array.isArray(job.steps) ? job.steps : [];
    const uses = steps.map((step) => step?.uses).filter(Boolean);
    for (const action of ['actions/checkout@v4', 'actions/dependency-review-action@v4']) {
      if (!uses.includes(action)) errors.push(`${action}がありません`);
    }
    const dependencyReviewStep = steps.find((step) => step?.uses === 'actions/dependency-review-action@v4');
    if (dependencyReviewStep && Object.hasOwn(dependencyReviewStep, 'if')) {
      errors.push('merge_groupでDependency Review actionをskipし得るstep-level ifは使用できません');
    }
  }

  for (const marker of [
    'temporary merge group commit',
    '`checks_requested`',
    '同じ`Dependency Review` check',
    'required status checkの識別にはjob名が使われる',
    '`paths`または`paths-ignore` filter',
    'merge queueを使わないrepositoryでは`merge_group` eventが発火しない',
    '[第13章のmerge queue節]',
    'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue',
    'https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#merge_group',
    'https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks',
  ]) {
    if (!section.includes(marker)) errors.push(`説明に必須markerがありません: ${marker}`);
  }
  return errors;
}

function expectRejected(section, name, mutate, expected) {
  const mutated = mutate(section);
  if (mutated === section) throw new Error(`self-test ${name}: mutation対象がありません`);
  const errors = validate(mutated);
  if (!errors.some((error) => error.includes(expected))) {
    throw new Error(`self-test ${name}: 契約違反を拒否できません (${errors.join('; ')})`);
  }
}

const sourceSection = extractSection(readRequired(sourcePath), sourcePath);
const publicSection = extractSection(readRequired(publicPath), publicPath);
const errors = [
  ...validate(sourceSection).map((error) => `${sourcePath}: ${error}`),
  ...validate(publicSection).map((error) => `${publicPath}: ${error}`),
];
if (sourceSection !== publicSection) errors.push('dependency review section must match between src and docs');

const packageJson = JSON.parse(readRequired('package.json'));
for (const command of ['npm run check:chapter08-dependency-review', 'npm run check:chapter08-dependency-review:self-test']) {
  if (!packageJson.scripts?.['test:light']?.includes(command)) errors.push(`test:light must run ${command}`);
}
const workflow = readRequired('.github/workflows/book-qa.yml');
for (const command of [
  'node scripts/check-chapter08-dependency-review-contract.js',
  'node scripts/check-chapter08-dependency-review-contract.js --self-test',
]) {
  if (!workflow.includes(command)) errors.push(`Book QA must run ${command}`);
}

if (errors.length) {
  console.error('Chapter 8 dependency review contract failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

if (process.argv.includes('--self-test')) {
  expectRejected(sourceSection, 'malformed YAML', (value) => value.replace('jobs:', 'jobs'), 'parseできません');
  expectRejected(sourceSection, 'missing pull_request', (value) => value.replace('  pull_request:\n', ''), 'pull_request');
  expectRejected(sourceSection, 'missing merge_group', (value) => value.replace('  merge_group:\n    types: [checks_requested]\n', ''), 'merge_group');
  expectRejected(sourceSection, 'wrong merge_group type', (value) => value.replace('types: [checks_requested]', 'types: [push]'), 'checks_requested');
  expectRejected(sourceSection, 'pull_request path filter', (value) => value.replace('  pull_request:\n', '  pull_request:\n    paths: ["package-lock.json"]\n'), 'path filter');
  expectRejected(sourceSection, 'merge_group path filter', (value) => value.replace('    types: [checks_requested]', '    types: [checks_requested]\n    paths-ignore: ["docs/**"]'), 'path filter');
  expectRejected(sourceSection, 'job name drift', (value) => value.replace('    name: Dependency Review', '    name: Dependency Review Queue'), 'job名');
  expectRejected(sourceSection, 'broad permission', (value) => value.replace('contents: read', 'contents: write'), 'permissions');
  expectRejected(sourceSection, 'job permission override', (value) => value.replace('    runs-on: ubuntu-latest', '    permissions:\n      contents: write\n    runs-on: ubuntu-latest'), 'job-level permissions');
  expectRejected(sourceSection, 'job event condition', (value) => value.replace('    runs-on: ubuntu-latest', "    if: github.event_name == 'pull_request'\n    runs-on: ubuntu-latest"), 'job-level if');
  expectRejected(sourceSection, 'dependency review event condition', (value) => value.replace('        uses: actions/dependency-review-action@v4', "        if: github.event_name == 'pull_request'\n        uses: actions/dependency-review-action@v4"), 'step-level if');
  expectRejected(sourceSection, 'missing action', (value) => value.replace('actions/dependency-review-action@v4', 'missing-dependency-review-action'), 'dependency-review-action@v4');
  console.log('Chapter 8 dependency review contract self-test passed.');
} else {
  console.log('Chapter 8 dependency review contract passed: pull_request/merge_group, stable job check name, no path filters, and minimum permissions.');
}
