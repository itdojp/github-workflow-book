#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const yamlParser = require('js-yaml');

const actionSha = '52fe01ec70a42f454c9d2ebd47598f9fd6893d56';
const actionRef = `openai/codex-action@${actionSha}`;
const codexVersion = '0.144.6';
const examplePath = 'examples/workflows/codex-pr-review-comment.yml';
const sourcePath = 'src/chapters/chapter13/index.md';
const publicPath = 'docs/chapters/chapter13/index.md';
const sectionStart = '### 13.4.1 Codex GitHub Action';
const sectionEnd = '### 13.4.2 注意：Secrets/権限/外部送信の線引き';

function normalize(value) {
  return value.replace(/\r\n?/g, '\n');
}

function readRequired(file) {
  try {
    return normalize(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Chapter 13 Codex Action contract failed: ${file}を読み込めません (${error.code ?? error.message})`);
    process.exit(1);
  }
}

function collectReferenceFiles() {
  const files = [];
  const allowedExtensions = new Set(['.md', '.yml', '.yaml']);
  const excludedDirectories = new Set(['.git', '_site', 'node_modules']);

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!excludedDirectories.has(entry.name)) walk(`${directory}/${entry.name}`);
      } else if (entry.isFile() && allowedExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
        const path = `${directory}/${entry.name}`;
        files.push({ path, content: readRequired(path) });
      }
    }
  }

  for (const root of ['.github/workflows', 'examples', 'src', 'docs']) walk(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function validateRepositoryActionReferences(files) {
  const errors = [];
  const usesPattern = /^\s*(?:-\s*)?uses\s*:\s*["']?openai\/codex-action@([^\s#"']+)/gm;
  for (const file of files) {
    for (const match of file.content.matchAll(usesPattern)) {
      if (match[1] !== actionSha) {
        errors.push(`${file.path}: Codex Action ref ${match[1]} は監査済みfull SHAではありません`);
      }
    }
  }
  return errors;
}

function extractSection(content, file) {
  const start = content.indexOf(sectionStart);
  const end = content.indexOf(sectionEnd, start + sectionStart.length);
  if (start === -1 || end === -1) throw new Error(`${file}: Codex Action section is missing`);
  return content.slice(start, end).trim();
}

function extractYaml(section) {
  const match = section.match(/```yaml\n([\s\S]*?)\n```/);
  return match?.[1] ?? '';
}

function exactPermissions(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, permission]) => value[key] === permission);
}

function validateWorkflowYaml(yaml, label) {
  const errors = [];
  let workflow;
  try {
    workflow = yamlParser.load(yaml);
  } catch (error) {
    return [`${label}: YAMLとしてparseできません: ${error.message.split('\n')[0]}`];
  }
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return [`${label}: YAMLのトップレベルはmappingである必要があります`];
  }

  const pullRequestTypes = workflow.on?.pull_request?.types;
  if (!Array.isArray(pullRequestTypes) || pullRequestTypes.length !== 1 || pullRequestTypes[0] !== 'labeled') {
    errors.push(`${label}: pull_requestはlabeledだけを購読する必要があります`);
  }

  const codexJob = workflow.jobs?.codex_review;
  if (!codexJob) {
    errors.push(`${label}: codex_review jobがありません`);
  } else {
    if (codexJob.if !== "github.event.label.name == 'codex-review'") {
      errors.push(`${label}: codex-review label gateが固定されていません`);
    }
    if (!exactPermissions(codexJob.permissions, { contents: 'read' })) {
      errors.push(`${label}: codex_review permissionsはcontents: readだけへ限定する必要があります`);
    }
    const steps = Array.isArray(codexJob.steps) ? codexJob.steps : [];
    const checkout = steps.find((step) => step?.uses === 'actions/checkout@v4');
    if (!checkout) {
      errors.push(`${label}: actions/checkout@v4がありません`);
    } else {
      if (checkout.with?.ref !== 'refs/pull/${{ github.event.pull_request.number }}/merge') errors.push(`${label}: checkoutはPR merge refへ固定する必要があります`);
      if (checkout.with?.['fetch-depth'] !== 0) errors.push(`${label}: private repositoryでもcheckout認証中に履歴を取得するためfetch-depth: 0が必要です`);
      if (checkout.with?.['persist-credentials'] !== false) errors.push(`${label}: checkoutはpersist-credentials: falseが必要です`);
    }
    const codexSteps = steps.filter((step) => step?.uses?.startsWith('openai/codex-action@'));
    if (!codexSteps.length) {
      errors.push(`${label}: openai/codex-action stepがありません`);
    } else {
      if (codexSteps.length !== 1) errors.push(`${label}: Codex Actionは既知制約により1 job 1 stepへ限定する必要があります`);
      codexSteps.forEach((codexStep, index) => {
        const stepLabel = `${label}: Codex Action step ${index + 1}`;
        if (codexStep.uses !== actionRef) errors.push(`${stepLabel}は監査済みfull SHAへpinする必要があります`);
        if (String(codexStep.with?.['codex-version']) !== codexVersion) errors.push(`${stepLabel}のcodex-versionは${codexVersion}へ固定する必要があります`);
        if (codexStep.with?.['permission-profile'] !== ':read-only') errors.push(`${stepLabel}のpermission-profileは:read-onlyが必要です`);
        if (Object.hasOwn(codexStep.with ?? {}, 'sandbox')) errors.push(`${stepLabel}はlegacy sandboxとpermission-profileを併用できません`);
        if (codexStep.with?.['safety-strategy'] !== 'drop-sudo') errors.push(`${stepLabel}のsafety-strategyはdrop-sudoが必要です`);
        if (codexStep.with?.['openai-api-key'] !== '${{ secrets.OPENAI_API_KEY }}') errors.push(`${stepLabel}のOPENAI_API_KEYのSecrets境界が変わっています`);
      });
    }
  }

  const postJob = workflow.jobs?.post_comment;
  if (!postJob || !exactPermissions(postJob.permissions, { issues: 'write', 'pull-requests': 'write' })) {
    errors.push(`${label}: post_commentだけにissues/pull-requests writeを限定する必要があります`);
  }

  if (!yaml.includes(`${actionRef} # v1.11`)) errors.push(`${label}: human-readable version comment # v1.11がありません`);
  return errors;
}

function validateGuidance(section) {
  const errors = [];
  for (const marker of [
    '監査済みfull-length commit SHA',
    '`codex-version`のexact version',
    '#### pin更新手順',
    'annotated tagならtarget commitまでdereference',
    '`action.yml`、`dist/`、依存lockfile、CHANGELOG、open security issue',
    '`persist-credentials: false`',
    '`pnpm audit`が10件（high 3 / moderate 5 / low 2）を指摘',
    '公開Security Advisoryは確認できず',
    '到達可能性は未評価',
    'self-hosted/ARC',
    'https://docs.github.com/en/actions/reference/security/secure-use',
    `https://github.com/openai/codex-action/commit/${actionSha}`,
    `https://github.com/openai/codex-action/blob/${actionSha}/docs/security.md`,
    'https://github.com/openai/codex-action/security/advisories',
  ]) {
    if (!section.includes(marker)) errors.push(`Chapter 13説明に必須markerがありません: ${marker}`);
  }
  return errors;
}

function expectRejected(yaml, name, mutate, expected) {
  const mutated = mutate(yaml);
  if (mutated === yaml) throw new Error(`self-test ${name}: mutation対象がありません`);
  const errors = validateWorkflowYaml(mutated, `self-test ${name}`);
  if (!errors.some((error) => error.includes(expected))) {
    throw new Error(`self-test ${name}: 契約違反を拒否できません (${errors.join('; ')})`);
  }
}

const exampleYaml = readRequired(examplePath);
const sourceSection = extractSection(readRequired(sourcePath), sourcePath);
const publicSection = extractSection(readRequired(publicPath), publicPath);
const chapterYaml = extractYaml(sourceSection);
const errors = [
  ...validateWorkflowYaml(exampleYaml, examplePath),
  ...validateWorkflowYaml(chapterYaml, sourcePath),
  ...validateGuidance(sourceSection).map((error) => `${sourcePath}: ${error}`),
];
if (sourceSection !== publicSection) errors.push('Codex Action section must match between src and docs');

const targetContents = [exampleYaml, sourceSection, publicSection];
const pinnedCount = targetContents.reduce((count, content) => count + content.split(actionRef).length - 1, 0);
if (pinnedCount !== 3) errors.push(`監査済みCodex Action pinは3件必要です (actual=${pinnedCount})`);
const referenceFiles = collectReferenceFiles();
errors.push(...validateRepositoryActionReferences(referenceFiles));

const packageJson = JSON.parse(readRequired('package.json'));
for (const command of ['npm run check:chapter13-codex-action', 'npm run check:chapter13-codex-action:self-test']) {
  if (!packageJson.scripts?.['test:light']?.includes(command)) errors.push(`test:light must run ${command}`);
}
const bookQa = readRequired('.github/workflows/book-qa.yml');
for (const command of [
  'node scripts/check-chapter13-codex-action-contract.js',
  'node scripts/check-chapter13-codex-action-contract.js --self-test',
]) {
  if (!bookQa.includes(command)) errors.push(`Book QA must run ${command}`);
}

if (errors.length) {
  console.error('Chapter 13 Codex Action contract failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

if (process.argv.includes('--self-test')) {
  expectRejected(chapterYaml, 'malformed YAML', (value) => value.replace('jobs:', 'jobs'), 'parseできません');
  expectRejected(chapterYaml, 'mutable action tag', (value) => value.replace(`${actionRef} # v1.11`, 'openai/codex-action@v1 # v1'), 'full SHA');
  expectRejected(chapterYaml, 'short action SHA', (value) => value.replace(`${actionRef} # v1.11`, 'openai/codex-action@52fe01e # v1.11'), 'full SHA');
  expectRejected(chapterYaml, 'additional mutable action step', (value) => value.replace('      - name: Run Codex (read-only)', '      - uses: openai/codex-action@main\n\n      - name: Run Codex (read-only)'), 'full SHA');
  expectRejected(chapterYaml, 'missing version comment', (value) => value.replace(`${actionRef} # v1.11`, actionRef), 'version comment');
  expectRejected(chapterYaml, 'floating Codex CLI', (value) => value.replace(`codex-version: ${codexVersion}`, 'codex-version: latest'), 'codex-version');
  expectRejected(chapterYaml, 'broad permission', (value) => value.replace('contents: read', 'contents: write'), 'permissions');
  expectRejected(chapterYaml, 'missing label gate', (value) => value.replace("if: github.event.label.name == 'codex-review'", 'if: always()'), 'label gate');
  expectRejected(chapterYaml, 'persisted credentials', (value) => value.replace('persist-credentials: false', 'persist-credentials: true'), 'persist-credentials');
  expectRejected(chapterYaml, 'shallow checkout', (value) => value.replace('fetch-depth: 0', 'fetch-depth: 1'), 'fetch-depth');
  expectRejected(chapterYaml, 'workspace permission', (value) => value.replace('permission-profile: ":read-only"', 'permission-profile: ":workspace"'), 'permission-profile');
  expectRejected(chapterYaml, 'legacy sandbox', (value) => value.replace('permission-profile: ":read-only"', 'permission-profile: ":read-only"\n          sandbox: read-only'), 'legacy sandbox');
  expectRejected(chapterYaml, 'unsafe strategy', (value) => value.replace('safety-strategy: drop-sudo', 'safety-strategy: unsafe'), 'drop-sudo');
  for (const [name, uses] of [
    ['repository-wide mutable ref', 'uses: openai/codex-action@main'],
    ['repository-wide double-quoted mutable ref', 'uses: "openai/codex-action@main"'],
    ["repository-wide single-quoted mutable ref", "uses: 'openai/codex-action@main'"],
    ['repository-wide unapproved SHA', 'uses: openai/codex-action@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
  ]) {
    const scanErrors = validateRepositoryActionReferences([
      ...referenceFiles,
      { path: `examples/workflows/self-test-${name}.yml`, content: `steps:\n  - ${uses}\n` },
    ]);
    if (!scanErrors.some((error) => error.includes('監査済みfull SHAではありません'))) {
      throw new Error(`self-test ${name}: repository-wide ref違反を拒否できません`);
    }
  }
  console.log('Chapter 13 Codex Action contract self-test passed.');
} else {
  console.log(`Chapter 13 Codex Action contract passed: ${actionSha} (v1.11), Codex ${codexVersion}, label gate, read-only profile, and minimum permissions.`);
}
