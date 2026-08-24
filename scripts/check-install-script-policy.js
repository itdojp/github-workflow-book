#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const acorn = require('acorn');
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
  // This existing benchmark is not parseable by Acorn at its trailing class
  // boundary. Its dynamic child-process command is limited to statically
  // declared Node build scripts, so it is inventoried rather than skipped.
  'scripts/benchmark.js': 'reviewed-non-install-executable-parse-exception',
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
const BENCHMARK_PARSE_EXCEPTION_SHA256 = '14a93540cb05c0e1af7446f8bf19c80626788efb6d81a058192fd56b51cf7420';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function splitShellSegments(command) {
  const segments = [];
  let current = '';
  let quote = null;
  let escaped = false;
  const flush = () => {
    const segment = current.trim();
    if (segment) segments.push(segment);
    current = '';
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      current += character;
      quote = character;
      continue;
    }
    if (character === ';' || character === '\n' || character === '|' || character === '&') {
      flush();
      if ((character === '|' && command[index + 1] === '|')
        || (character === '&' && command[index + 1] === '&')) index += 1;
      continue;
    }
    current += character;
  }
  flush();
  return segments;
}

function operationalShellSegments(command) {
  return normalize(command)
    .split('\n')
    .map(stripShellComment)
    .flatMap(splitShellSegments)
    .filter(Boolean);
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
  const installSegments = operationalShellSegments(command).filter(containsInstallIntent);
  for (const [index, segment] of installSegments.entries()) {
    const segmentLabel = installSegments.length > 1 ? `${label} segment ${index + 1}` : label;
    if (!/(?:^|\s)--ignore-scripts(?=\s|$)/.test(segment)
      || /(?:^|\s)(?:--ignore-scripts=false|--no-ignore-scripts)(?=\s|$)/.test(segment)) {
      errors.push(`${segmentLabel} install command must use --ignore-scripts`);
    }
    const hasInlineDownloadGuard = /(?:^|\s)PUPPETEER_SKIP_DOWNLOAD=true(?=\s|$)/.test(segment);
    const hasUnsafeInlineOverride = /(?:^|\s)PUPPETEER_SKIP_DOWNLOAD=(?!true(?:\s|$))[^\s]+/.test(segment);
    if (requireEnvironment && (hasUnsafeInlineOverride
      || (!hasInlineDownloadGuard && environmentSource !== 'INSTALL_ENVIRONMENT'))) {
      errors.push(`${segmentLabel} install command must disable Puppeteer browser downloads`);
    }
  }
}

function validateOperationalDocumentation(errors, file, source, includeInline = true) {
  const commands = extractOperationalDocumentationCommands(source, includeInline);
  if (!commands.length) errors.push(`${file} must document a guarded npm install command`);
  commands.forEach((command) => validateGuardedCommand(errors, file, command));
}

function walkAst(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value)) {
      value.forEach((child) => walkAst(child, visit));
    } else if (value && typeof value.type === 'string') {
      walkAst(value, visit);
    }
  }
}

function parseExecutableSource(source, file = '') {
  return acorn.parse(source, {
    ecmaVersion: 'latest',
    sourceType: file.endsWith('.mjs') ? 'module' : 'script',
    allowHashBang: true,
    locations: true,
  });
}

function collectBindings(ast) {
  const bindings = new Map();
  walkAst(ast, (node) => {
    if (node.type !== 'VariableDeclaration') return;
    for (const declaration of node.declarations) {
      if (declaration.id.type !== 'Identifier') continue;
      if (bindings.has(declaration.id.name) || node.kind !== 'const') {
        bindings.set(declaration.id.name, null);
      } else {
        bindings.set(declaration.id.name, declaration.init);
      }
    }
  });

  const rootIdentifier = (node) => {
    let current = node;
    while (current?.type === 'MemberExpression') current = current.object;
    return current?.type === 'Identifier' ? current.name : null;
  };
  const invalidate = (name) => {
    if (name && bindings.has(name)) bindings.set(name, null);
  };
  const mutatingMethods = new Set([
    'copyWithin', 'fill', 'pop', 'push', 'reverse', 'set', 'shift', 'sort', 'splice', 'unshift',
  ]);
  walkAst(ast, (node) => {
    if (node.type === 'AssignmentExpression') invalidate(rootIdentifier(node.left));
    if (node.type === 'UpdateExpression') invalidate(rootIdentifier(node.argument));
    if (node.type === 'UnaryExpression' && node.operator === 'delete') {
      invalidate(rootIdentifier(node.argument));
    }
    if (node.type !== 'CallExpression') return;
    if (node.callee.type === 'MemberExpression' && !node.callee.computed
      && mutatingMethods.has(node.callee.property.name)) {
      invalidate(rootIdentifier(node.callee.object));
    }
    if (node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.object.name === 'Object' && node.callee.property.name === 'assign') {
      invalidate(rootIdentifier(node.arguments[0]));
    }
    if (node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.object.name === 'Object'
      && ['defineProperties', 'defineProperty', 'setPrototypeOf'].includes(node.callee.property.name)) {
      invalidate(rootIdentifier(node.arguments[0]));
    }
    if (node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.object.name === 'Reflect'
      && ['defineProperty', 'deleteProperty', 'set', 'setPrototypeOf'].includes(node.callee.property.name)) {
      invalidate(rootIdentifier(node.arguments[0]));
    }
  });
  return bindings;
}

function renderExpression(node, bindings, seen = new Set()) {
  if (!node) return { text: '<dynamic>', dynamic: true };
  if (node.type === 'Literal') return { text: String(node.value), dynamic: false };
  if (node.type === 'TemplateLiteral') {
    let text = node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
    let dynamic = false;
    node.expressions.forEach((expression, index) => {
      const rendered = renderExpression(expression, bindings, seen);
      text += rendered.text;
      text += node.quasis[index + 1].value.cooked ?? node.quasis[index + 1].value.raw;
      dynamic ||= rendered.dynamic;
    });
    return { text, dynamic };
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = renderExpression(node.left, bindings, seen);
    const right = renderExpression(node.right, bindings, seen);
    return { text: left.text + right.text, dynamic: left.dynamic || right.dynamic };
  }
  if (node.type === 'Identifier') {
    if (seen.has(node.name) || !bindings.has(node.name) || !bindings.get(node.name)) {
      return { text: '<dynamic>', dynamic: true };
    }
    const nextSeen = new Set(seen);
    nextSeen.add(node.name);
    return renderExpression(bindings.get(node.name), bindings, nextSeen);
  }
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
    && !node.callee.computed && node.callee.property.name === 'join') {
    const values = renderArray(node.callee.object, bindings, seen);
    const delimiter = renderExpression(node.arguments[0] ?? { type: 'Literal', value: ',' }, bindings, seen);
    return {
      text: values.items.map((item) => item.text).join(delimiter.text),
      dynamic: values.dynamic || delimiter.dynamic,
    };
  }
  return { text: '<dynamic>', dynamic: true };
}

function renderArray(node, bindings, seen = new Set()) {
  if (!node) return { items: [{ text: '<dynamic>', dynamic: true }], dynamic: true };
  if (node.type === 'Identifier') {
    if (seen.has(node.name) || !bindings.has(node.name) || !bindings.get(node.name)) {
      return { items: [{ text: '<dynamic>', dynamic: true }], dynamic: true };
    }
    const nextSeen = new Set(seen);
    nextSeen.add(node.name);
    return renderArray(bindings.get(node.name), bindings, nextSeen);
  }
  if (node.type !== 'ArrayExpression') {
    const rendered = renderExpression(node, bindings, seen);
    return { items: [rendered], dynamic: rendered.dynamic };
  }

  const items = [];
  let dynamic = false;
  for (const element of node.elements) {
    if (!element) continue;
    if (element.type === 'SpreadElement') {
      const spread = renderArray(element.argument, bindings, seen);
      items.push(...spread.items);
      dynamic ||= spread.dynamic;
    } else {
      const rendered = renderExpression(element, bindings, seen);
      items.push(rendered);
      dynamic ||= rendered.dynamic;
    }
  }
  return { items, dynamic };
}

function unwrapBoundExpression(node, bindings, seen = new Set()) {
  if (!node) return null;
  if (node.type === 'Identifier') {
    if (seen.has(node.name) || !bindings.has(node.name) || !bindings.get(node.name)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(node.name);
    return unwrapBoundExpression(bindings.get(node.name), bindings, nextSeen);
  }
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
    && !node.callee.computed && node.callee.object.name === 'Object'
    && node.callee.property.name === 'freeze') {
    return unwrapBoundExpression(node.arguments[0], bindings, seen);
  }
  return node;
}

function objectProperty(node, name, bindings) {
  const object = unwrapBoundExpression(node, bindings);
  if (object?.type !== 'ObjectExpression') return null;
  let value = null;
  for (const entry of object.properties) {
    if (entry.type === 'SpreadElement' || (entry.type === 'Property' && entry.computed)) {
      value = null;
    } else if (entry.type === 'Property' && (entry.key.name === name || entry.key.value === name)) {
      value = entry.value;
    }
  }
  return value;
}

function hasSafeInstallEnvironment(optionsNode, bindings) {
  if (optionsNode?.type !== 'ObjectExpression') return false;
  const environment = objectProperty(optionsNode, 'env', bindings);
  if (environment?.type === 'Identifier') {
    const initializer = bindings.get(environment.name);
    const frozen = initializer?.type === 'CallExpression'
      && initializer.callee.type === 'MemberExpression'
      && !initializer.callee.computed
      && initializer.callee.object.name === 'Object'
      && initializer.callee.property.name === 'freeze';
    if (!frozen) return false;
  }
  const skipDownload = objectProperty(environment, 'PUPPETEER_SKIP_DOWNLOAD', bindings);
  const rendered = renderExpression(skipDownload, bindings);
  return !rendered.dynamic && rendered.text === 'true';
}

function isChildProcessRequire(node) {
  return node?.type === 'CallExpression'
    && node.callee.type === 'Identifier'
    && node.callee.name === 'require'
    && /^(?:node:)?child_process$/.test(node.arguments[0]?.value);
}

function collectChildProcessBindings(ast) {
  const supported = new Set(['exec', 'execSync', 'spawn', 'spawnSync', 'execFile', 'execFileSync']);
  const functions = new Map([...supported].map((name) => [name, name]));
  const modules = new Set(['childProcess', 'cp']);
  walkAst(ast, (node) => {
    if (node.type === 'ImportDeclaration' && /^(?:node:)?child_process$/.test(node.source.value)) {
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier') modules.add(specifier.local.name);
        if (specifier.type === 'ImportSpecifier' && supported.has(specifier.imported.name)) {
          functions.set(specifier.local.name, specifier.imported.name);
        }
      }
    }
    if (node.type !== 'VariableDeclarator') return;
    if (node.id.type === 'Identifier' && isChildProcessRequire(node.init)) modules.add(node.id.name);
    if (node.id.type === 'ObjectPattern' && isChildProcessRequire(node.init)) {
      for (const property of node.id.properties) {
        if (property.type === 'Property' && supported.has(property.key.name)
          && property.value.type === 'Identifier') {
          functions.set(property.value.name, property.key.name);
        }
      }
    }
  });
  let addedAlias = true;
  while (addedAlias) {
    addedAlias = false;
    walkAst(ast, (node) => {
      if (node.type !== 'VariableDeclarator' || node.id.type !== 'Identifier'
        || node.init?.type !== 'Identifier' || !functions.has(node.init.name)
        || functions.has(node.id.name)) return;
      functions.set(node.id.name, functions.get(node.init.name));
      addedAlias = true;
    });
  }
  walkAst(ast, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id.type !== 'Identifier'
      || node.init?.type !== 'MemberExpression' || node.init.computed
      || !supported.has(node.init.property.name)) return;
    if ((node.init.object.type === 'Identifier' && modules.has(node.init.object.name))
      || isChildProcessRequire(node.init.object)) {
      functions.set(node.id.name, node.init.property.name);
    }
  });
  walkAst(ast, (node) => {
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') {
      functions.delete(node.left.name);
      modules.delete(node.left.name);
    }
  });
  return { functions, modules, supported };
}

function childProcessFunctionName(callee, childProcessBindings) {
  const { functions, modules, supported } = childProcessBindings;
  if (callee.type === 'Identifier' && functions.has(callee.name)) return functions.get(callee.name);
  if (callee.type !== 'MemberExpression' || callee.computed) return null;
  if (!supported.has(callee.property.name)) return null;
  if (callee.object.type === 'Identifier' && modules.has(callee.object.name)) {
    return callee.property.name;
  }
  if (isChildProcessRequire(callee.object)) {
    return callee.property.name;
  }
  return null;
}

function findExecutableCalls(source, file = '') {
  const ast = parseExecutableSource(source, file);
  const bindings = collectBindings(ast);
  const childProcessBindings = collectChildProcessBindings(ast);
  const calls = [];
  walkAst(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    const functionName = childProcessFunctionName(node.callee, childProcessBindings);
    if (functionName) calls.push({ functionName, node, bindings });
  });
  return calls;
}

function validateShellExpression(errors, label, expression, optionsNode, bindings) {
  const rendered = renderExpression(expression, bindings);
  const installIntent = operationalShellSegments(rendered.text).some(containsInstallIntent);
  if (rendered.dynamic) {
    errors.push(`${label} dynamic shell command expression is not allowed; use argv form`);
  }
  if (installIntent && /`|\$\(/.test(rendered.text)) {
    errors.push(`${label} nested shell install expression is not allowed`);
  }
  if (!installIntent) return false;

  const environmentSource = hasSafeInstallEnvironment(optionsNode, bindings)
    ? 'INSTALL_ENVIRONMENT'
    : null;
  validateGuardedCommand(errors, label, rendered.text, environmentSource);
  return true;
}

function validateArgvExpression(errors, label, call, bindings) {
  const executable = renderExpression(call.arguments[0], bindings);
  if (call.arguments[1]?.type !== 'ArrayExpression') {
    if (executable.dynamic
      || ['npm', 'npm.cmd', 'npx', 'npx.cmd', 'sh', 'bash', '/bin/sh', '/bin/bash'].includes(executable.text)) {
      errors.push(`${label} dynamic install argv is not allowed`);
      return true;
    }
    return false;
  }
  const argv = renderArray(call.arguments[1], bindings);
  const args = argv.items.map((item) => item.text);
  const optionsNode = call.arguments[2];

  if (['sh', 'bash', '/bin/sh', '/bin/bash'].includes(executable.text)) {
    const commandIndex = args.indexOf('-c');
    if (commandIndex >= 0) {
      const commandNode = unwrapBoundExpression(call.arguments[1], bindings)?.elements?.[commandIndex + 1];
      return validateShellExpression(errors, `${label} shell`, commandNode, optionsNode, bindings);
    }
  }

  let verbIndex = 0;
  let npmExecutable = executable.text === 'npm' || executable.text === 'npm.cmd';
  if (executable.text === 'npx' || executable.text === 'npx.cmd') {
    verbIndex = args.findIndex((argument) => /^npm@[^\s]+$/.test(argument)) + 1;
    npmExecutable = verbIndex > 0;
  }
  const verb = args[verbIndex];
  const possibleInstall = ['ci', 'install'].includes(verb);
  const dynamicInstall = executable.dynamic
    || (npmExecutable && (verb === '<dynamic>' || argv.items[verbIndex]?.dynamic));
  if (dynamicInstall && (possibleInstall || npmExecutable || executable.text === '<dynamic>')) {
    errors.push(`${label} dynamic install executable or verb is not allowed`);
    return possibleInstall || npmExecutable;
  }
  if (!npmExecutable || !possibleInstall) return false;

  const command = `npm ${args.slice(verbIndex).join(' ')}`;
  const shellNode = objectProperty(optionsNode, 'shell', bindings);
  if (shellNode) {
    const shell = unwrapBoundExpression(shellNode, bindings);
    if (shell?.type !== 'Literal' || shell.value !== false) {
      errors.push(`${label} npm argv install must not enable a dynamic shell`);
    }
  }
  const environmentSource = hasSafeInstallEnvironment(optionsNode, bindings)
    ? 'INSTALL_ENVIRONMENT'
    : null;
  validateGuardedCommand(errors, label, command, environmentSource);
  return true;
}

function validateOperationalExecutable(errors, file, source) {
  let calls;
  try {
    calls = findExecutableCalls(source, file);
  } catch (error) {
    errors.push(`${file} must be parseable for deterministic install auditing: ${error.message}`);
    return;
  }

  let installCallCount = 0;
  for (const { functionName, node, bindings } of calls) {
    const label = `${file} ${functionName} line ${node.loc.start.line}`;
    if (functionName === 'exec' || functionName === 'execSync') {
      if (validateShellExpression(errors, label, node.arguments[0], node.arguments[1], bindings)) {
        installCallCount += 1;
      }
    } else if (validateArgvExpression(errors, label, node, bindings)) {
      installCallCount += 1;
    }
  }
  if (!installCallCount) errors.push(`${file} must retain its guarded executable npm install path`);
}

function containsExecutableInstallIntent(file, source) {
  try {
    return findExecutableCalls(source, file).some(({ functionName, node, bindings }) => {
      if (functionName === 'exec' || functionName === 'execSync') {
        const rendered = renderExpression(node.arguments[0], bindings);
        return operationalShellSegments(rendered.text).some(containsInstallIntent)
          || (rendered.dynamic && (/(?:^|\s)npm(?:@|\s)/.test(rendered.text)
            || /<dynamic>\s+(?:ci|install)(?=\s|$)/.test(rendered.text)));
      }
      const executable = renderExpression(node.arguments[0], bindings);
      const argv = renderArray(node.arguments[1], bindings);
      const args = argv.items.map((item) => item.text);
      return ((executable.text === 'npm' || executable.text === 'npm.cmd')
          && ['ci', 'install'].includes(args[0]))
        || ((executable.text === 'npx' || executable.text === 'npx.cmd')
          && args.some((argument, index) => /^npm@[^\s]+$/.test(argument)
            && ['ci', 'install'].includes(args[index + 1])))
        || (executable.dynamic && args.some((argument) => ['ci', 'install'].includes(argument)));
    });
  } catch {
    return true;
  }
}

function containsSurfaceInstallIntent(file, source) {
  return containsInstallIntent(source)
    || (/\.(?:c?js|mjs)$/.test(file) && containsExecutableInstallIntent(file, source));
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
    if (containsSurfaceInstallIntent(file, source) && !classifyInstallSurface(file)) {
      errors.push(`unclassified npm install surface: ${file}`);
    }
  }
}

function validateBenchmarkParseException(errors, source) {
  const digest = crypto.createHash('sha256').update(source).digest('hex');
  if (digest !== BENCHMARK_PARSE_EXCEPTION_SHA256) {
    errors.push('scripts/benchmark.js parse exception changed and requires explicit install-surface review');
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
    if (containsSurfaceInstallIntent(file, source) || Object.hasOwn(INSTALL_SURFACE_RULES, file)) {
      surfaces[file] = source;
    }
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

function validatePuppeteerApiContract(errors, lock, pkg) {
  if (lock.packages?.['node_modules/puppeteer-core']?.version !== EXPECTED.puppeteerVersion) {
    errors.push(`lockfile must resolve puppeteer-core@${EXPECTED.puppeteerVersion}`);
  }
  try {
    const puppeteer = require(path.resolve('node_modules/puppeteer'));
    if (typeof puppeteer.launch !== 'function') errors.push('installed Puppeteer 25 must expose launch()');
  } catch (error) {
    errors.push(`installed Puppeteer 25 static smoke failed: ${error.message}`);
  }
  const scriptContracts = {
    'check:puppeteer25-consumer': 'node scripts/check-puppeteer25-consumer-contract.js',
    'check:puppeteer25-consumer:self-test': 'node scripts/check-puppeteer25-consumer-contract.js --self-test',
  };
  for (const [name, command] of Object.entries(scriptContracts)) {
    if (pkg.scripts?.[name] !== command) errors.push(`package.json must retain ${name}`);
    if (!pkg.scripts?.['test:light']?.includes(`npm run ${name}`)) {
      errors.push(`test:light must run npm run ${name}`);
    }
  }
}

function resolveBootstrapNpmCli() {
  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    return process.env.npm_execpath;
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const globalRoot = spawnSync(npm, ['root', '--global'], { encoding: 'utf8' });
  if (globalRoot.error || globalRoot.status !== 0) return null;
  const candidate = path.join(globalRoot.stdout.trim(), 'npm', 'bin', 'npm-cli.js');
  return fs.existsSync(candidate) ? candidate : null;
}

function runLifecycleIsolationIntegration() {
  const versions = ['10.9.7', '12.0.1'];
  const bootstrapNpmCli = resolveBootstrapNpmCli();
  if (!bootstrapNpmCli) {
    throw new Error('could not locate the administrator-provided npm CLI for lifecycle test preparation');
  }
  for (const version of versions) {
    const temporaryRoot = fs.mkdtempSync(path.resolve(`.install-policy-lifecycle-npm-${version}-`));
    const cacheDirectory = path.join(temporaryRoot, 'empty-npm-cache');
    const cliDirectory = path.join(temporaryRoot, 'npm-cli');
    const fixtureDirectory = path.join(temporaryRoot, 'fixture');
    const markerPath = path.join(fixtureDirectory, 'side-effect-marker');
    const environment = {
      ...process.env,
      npm_config_cache: cacheDirectory,
      npm_config_ignore_scripts: 'true',
      PUPPETEER_SKIP_DOWNLOAD: 'true',
    };
    try {
      fs.mkdirSync(cacheDirectory);
      if (fs.readdirSync(cacheDirectory).length !== 0) {
        throw new Error(`npm ${version} preparation cache was not empty`);
      }
      const preparation = spawnSync(
        process.execPath,
        [
          bootstrapNpmCli,
          'install',
          '--prefix', cliDirectory,
          '--no-save',
          '--package-lock=false',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--cache', cacheDirectory,
          `npm@${version}`,
        ],
        {
          cwd: temporaryRoot,
          encoding: 'utf8',
          env: environment,
        },
      );
      if (preparation.error || preparation.status !== 0) {
        throw new Error(`npm ${version} clean-cache preparation failed: ${preparation.error?.message ?? preparation.stderr}`);
      }

      const npmCliPath = path.join(cliDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js');
      const npmPackagePath = path.join(cliDirectory, 'node_modules', 'npm', 'package.json');
      if (!fs.existsSync(npmCliPath) || !fs.existsSync(npmPackagePath)
        || readJson(npmPackagePath).version !== version) {
        throw new Error(`npm ${version} clean-cache preparation did not produce an exact pinned CLI`);
      }

      fs.cpSync(LIFECYCLE_FIXTURE, fixtureDirectory, { recursive: true });
      const fixtureEnvironment = {
        ...process.env,
        npm_config_cache: cacheDirectory,
        PUPPETEER_SKIP_DOWNLOAD: 'true',
      };
      for (const key of Object.keys(fixtureEnvironment)) {
        if (key.toLowerCase() === 'npm_config_ignore_scripts') delete fixtureEnvironment[key];
      }
      const result = spawnSync(
        process.execPath,
        [
          npmCliPath,
          'ci',
          '--ignore-scripts',
          '--offline',
          '--no-audit',
          '--no-fund',
        ],
        {
          cwd: fixtureDirectory,
          encoding: 'utf8',
          env: fixtureEnvironment,
        },
      );
      if (result.error || result.status !== 0) {
        throw new Error(`npm ${version} clean-cache local lifecycle fixture failed: ${result.error?.message ?? result.stderr}`);
      }
      if (!fs.existsSync(path.join(fixtureDirectory, 'node_modules/lifecycle-side-effect/package.json'))) {
        throw new Error(`npm ${version} did not install the local lifecycle fixture`);
      }
      if (fs.existsSync(markerPath)) {
        throw new Error(`npm ${version} executed a local lifecycle script despite --ignore-scripts`);
      }
    } finally {
      fs.rmSync(temporaryRoot, { force: true, recursive: true });
    }
  }
  return versions;
}

function validatePublicationManagerSource(errors, source) {
  if (containsInstallIntent(source)) {
    errors.push('scripts/publication_manager.py must not direct users to an undeclared zenn/ npm install path');
  }
  if (/with\s+open\s*\(\s*zenn_dir\s*\/\s*["']package\.json["']/.test(source)
    || /["']zenn-cli["']\s*:/.test(source)) {
    errors.push('scripts/publication_manager.py must not generate a Zenn package manifest or dependency');
  }
  if (!source.includes('legacy_manifest = zenn_dir / "package.json"')
    || !source.includes('if legacy_manifest.exists():')) {
    errors.push('scripts/publication_manager.py must reject a legacy zenn/package.json manifest');
  }
}

function runPublicationManagerIntegration() {
  const temporaryDirectory = fs.mkdtempSync(path.resolve('.publication-manager-zenn-contract-'));
  try {
    const result = spawnSync(
      'python3',
      [
        '-S',
        '-c',
        [
          'import sys',
          'import types',
          'from pathlib import Path',
          'yaml = types.ModuleType("yaml")',
          'yaml.dump = lambda data, stream, **kwargs: stream.write("contract: true\\n")',
          'sys.modules["yaml"] = yaml',
          'from scripts.publication_manager import PublicationManager',
          'root = Path(sys.argv[1])',
          'PublicationManager(str(root))._prepare_zenn()',
          'assert (root / "zenn/books/github-workflow-ai/config.yaml").is_file()',
          'assert not (root / "zenn/package.json").exists()',
          '(root / "zenn/package.json").write_text("{}", encoding="utf-8")',
          'try:',
          '    PublicationManager(str(root))._prepare_zenn()',
          'except RuntimeError:',
          '    pass',
          'else:',
          '    raise AssertionError("legacy Zenn manifest was not rejected")',
        ].join('\n'),
        temporaryDirectory,
      ],
      { cwd: path.resolve('.'), encoding: 'utf8' },
    );
    if (result.error || result.status !== 0) {
      throw new Error(`publication manager Zenn manifest isolation failed: ${result.error?.message ?? result.stderr}`);
    }
  } finally {
    fs.rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function runCacheKeyPatternIntegration() {
  const temporaryDirectory = fs.mkdtempSync(path.resolve('.cache-manager-pattern-contract-'));
  try {
    const nestedDirectory = path.join(temporaryDirectory, 'src', 'chapters', 'chapter01');
    fs.mkdirSync(nestedDirectory, { recursive: true });
    const fixturePath = path.join(nestedDirectory, 'index.md');
    fs.writeFileSync(fixturePath, '# First\n');

    const cacheManagerPath = path.resolve('scripts/cache-manager.js');
    const probe = spawnSync(
      process.execPath,
      [
        '-e',
        [
          "const fs = require('node:fs');",
          'process.chdir(process.argv[1]);',
          'const { generateCacheKey } = require(process.argv[2]);',
          '(async () => {',
          "  const first = await generateCacheKey(['src/**/*.md']);",
          "  fs.writeFileSync('src/chapters/chapter01/index.md', '# Second\\n');",
          "  const second = await generateCacheKey(['src/**/*.md']);",
          '  console.log(JSON.stringify({ first, second }));',
          '})().catch((error) => { console.error(error); process.exit(1); });',
        ].join('\n'),
        temporaryDirectory,
        cacheManagerPath,
      ],
      { encoding: 'utf8' },
    );
    if (probe.error || probe.status !== 0) {
      throw new Error(`cache-key glob integration failed: ${probe.error?.message ?? probe.stderr}`);
    }
    const result = JSON.parse(probe.stdout.trim());
    if (result.first === 'd41d8cd98f00b204' || result.first === result.second) {
      throw new Error('cache-key glob integration did not hash nested Markdown content deterministically');
    }
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
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
  validateBenchmarkParseException(errors, surfaces['scripts/benchmark.js'] ?? '');
  for (const file of ['README.md', 'AGENTS.md', 'SETUP_V2.md', 'DEVELOPMENT.md', 'ZENN_BOOK_CONFIG.md']) {
    validateOperationalDocumentation(errors, file, surfaces[file] ?? '');
  }
  validateWorkflowInstallCommands(errors, surfaces['.github/workflows/book-qa.yml'] ?? '');
  validateOperationalExecutable(errors, 'easy-setup.js', surfaces['easy-setup.js'] ?? '');
  validateOperationalDocumentation(errors, 'easy-setup.js generated README', surfaces['easy-setup.js'] ?? '', false);
  validateOperationalExecutable(errors, 'scripts/cache-manager.js', surfaces['scripts/cache-manager.js'] ?? '');
  validateGeneratedGuidance(errors, 'scripts/error-recovery.js', surfaces['scripts/error-recovery.js'] ?? '');
  validateOperationalDocumentation(errors, 'scripts/init-template.js generated README', surfaces['scripts/init-template.js'] ?? '', false);
  validatePublicationManagerSource(errors, surfaces['scripts/publication_manager.py'] ?? '');
  validateNodeRuntimeContract(errors, surfaces['easy-setup.js'] ?? '');
  validatePuppeteerApiContract(errors, lock, pkg);
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
    ['easy setup script guard removed', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('npm install --ignore-scripts ${essentialDeps', 'npm install ${essentialDeps'); }, 'must use --ignore-scripts'],
    ['easy setup download environment bypassed', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('env: INSTALL_ENVIRONMENT', 'env: process.env'); }, 'Puppeteer browser downloads'],
    ['false Puppeteer environment', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace("PUPPETEER_SKIP_DOWNLOAD: 'true'", "PUPPETEER_SKIP_DOWNLOAD: 'false'"); }, 'Puppeteer browser downloads'],
    ['late false Puppeteer environment override', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace("PUPPETEER_SKIP_DOWNLOAD: 'true'\n", "PUPPETEER_SKIP_DOWNLOAD: 'true',\n  PUPPETEER_SKIP_DOWNLOAD: 'false'\n"); }, 'Puppeteer browser downloads'],
    ['cache manager script guard removed', (s) => { s.surfaces['scripts/cache-manager.js'] = s.surfaces['scripts/cache-manager.js'].replace('npm ci --ignore-scripts', 'npm ci'); }, 'must use --ignore-scripts'],
    ['explicit ignore-scripts false override', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecSync('npm ci --ignore-scripts --ignore-scripts=false', { env: INSTALL_ENVIRONMENT });\n"; }, 'must use --ignore-scripts'],
    ['inline false download override', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecSync('PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_DOWNLOAD=false npm ci --ignore-scripts', { env: INSTALL_ENVIRONMENT });\n"; }, 'Puppeteer browser downloads'],
    ['cache manager comment-only guard', (s) => { s.surfaces['scripts/cache-manager.js'] = s.surfaces['scripts/cache-manager.js'].replace("execSync('npm ci --ignore-scripts'", "execSync('npm ci' /* --ignore-scripts */"); }, 'must use --ignore-scripts'],
    ['shell comment-only guard', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecSync('# npm ci --ignore-scripts\\nnpm ci', { env: INSTALL_ENVIRONMENT });\n"; }, 'must use --ignore-scripts'],
    ['guarded then unguarded compound exec', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecSync('npm ci --ignore-scripts && npm install', { env: INSTALL_ENVIRONMENT });\n"; }, 'segment 2 install command must use --ignore-scripts'],
    ['nested shell install expression', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecSync('npm ci --ignore-scripts && $(npm install --ignore-scripts)', { env: INSTALL_ENVIRONMENT });\n"; }, 'nested shell install expression is not allowed'],
    ['dynamic exec install command', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nconst reviewerCommand = process.env.INSTALL_COMMAND; execSync(reviewerCommand, { env: INSTALL_ENVIRONMENT });\n"; }, 'dynamic shell command expression is not allowed'],
    ['dynamic non-install shell command', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecSync(`echo ${process.env.REVIEW_COMMAND}`);\n"; }, 'dynamic shell command expression is not allowed'],
    ['reassigned install command binding', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nlet reassignedCommand = 'npm ci --ignore-scripts'; reassignedCommand = 'npm ci'; execSync(reassignedCommand, { env: INSTALL_ENVIRONMENT });\n"; }, 'dynamic shell command expression is not allowed'],
    ['mutated install options binding', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nconst reviewerOptions = { env: INSTALL_ENVIRONMENT }; reviewerOptions.env = process.env; execSync('npm ci --ignore-scripts', reviewerOptions);\n"; }, 'Puppeteer browser downloads'],
    ['deleted install options environment', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nconst deletedOptions = { env: INSTALL_ENVIRONMENT }; delete deletedOptions.env; execSync('npm ci --ignore-scripts', deletedOptions);\n"; }, 'Puppeteer browser downloads'],
    ['dynamic spawn executable', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nspawnSync(process.env.NPM_EXECUTABLE, ['install', '--ignore-scripts'], { env: INSTALL_ENVIRONMENT });\n"; }, 'dynamic install executable or verb'],
    ['dynamic execFile argv', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecFileSync('npm', process.env.NPM_ARGUMENTS, { env: INSTALL_ENVIRONMENT });\n"; }, 'dynamic install argv'],
    ['mutated spawn argv binding', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nconst reviewerArgs = ['ci', '--ignore-scripts']; reviewerArgs.splice(0, 2, 'ci'); spawnSync('npm', reviewerArgs, { env: INSTALL_ENVIRONMENT });\n"; }, 'dynamic install argv'],
    ['additional unsafe exec path', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nexecSync('npm ci');\n"; }, 'must use --ignore-scripts'],
    ['additional unsafe spawn path', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nspawnSync('npm', ['ci'], { env: INSTALL_ENVIRONMENT });\n"; }, 'must use --ignore-scripts'],
    ['spawn install with shell enabled', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nspawnSync('npm', ['ci', '--ignore-scripts'], { env: INSTALL_ENVIRONMENT, shell: true });\n"; }, 'must not enable a dynamic shell'],
    ['spawn install with shell path enabled', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nspawnSync('npm', ['ci', '--ignore-scripts', process.env.EXTRA], { env: INSTALL_ENVIRONMENT, shell: '/bin/sh' });\n"; }, 'must not enable a dynamic shell'],
    ['spawn install with shell string false', (s) => { s.surfaces['scripts/cache-manager.js'] += "\nspawnSync('npm', ['ci', '--ignore-scripts'], { env: INSTALL_ENVIRONMENT, shell: 'false' });\n"; }, 'must not enable a dynamic shell'],
    ['new unclassified operational path', (s) => { s.surfaces['scripts/new-installer.js'] = "spawnSync('npm', ['ci', '--ignore-scripts']);\n"; }, 'unclassified npm install surface'],
    ['new indirect unclassified operational path', (s) => { s.surfaces['scripts/new-indirect-installer.js'] = "const command = ['npm', 'install'].join(' '); execSync(command);\n"; }, 'unclassified npm install surface'],
    ['new CommonJS indirect unclassified path', (s) => { s.surfaces['scripts/new-installer.cjs'] = "with ({}) {}\nconst command = ['npm', 'install'].join(' '); require('node:child_process').execSync(command);\n"; }, 'unclassified npm install surface'],
    ['new Windows npm.cmd unclassified path', (s) => { s.surfaces['scripts/new-windows-installer.js'] = "spawnSync('npm.cmd', ['ci', '--ignore-scripts']);\n"; }, 'unclassified npm install surface'],
    ['new child-process alias unclassified path', (s) => { s.surfaces['scripts/new-alias-installer.js'] = "const { spawnSync } = require('node:child_process'); const run = spawnSync; run('npm', ['ci', '--ignore-scripts']);\n"; }, 'unclassified npm install surface'],
    ['benchmark parse exception changed', (s) => { s.surfaces['scripts/benchmark.js'] += "\nexecSync('npm install');\n"; }, 'parse exception changed'],
    ['required path removed', (s) => { delete s.surfaces['DEVELOPMENT.md']; }, 'required install surface is missing'],
    ['legacy zenn install guidance restored', (s) => { s.surfaces['scripts/publication_manager.py'] += '\ncd zenn && npm install\n'; }, 'undeclared zenn/'],
    ['floating Zenn manifest generator restored', (s) => { s.surfaces['scripts/publication_manager.py'] += '\nwith open(zenn_dir / "package.json", "w") as f:\n    f.write("\\\"zenn-cli\\\": \\\"^0.1.147\\\"")\n'; }, 'must not generate a Zenn package manifest'],
    ['legacy Zenn manifest rejection removed', (s) => { s.surfaces['scripts/publication_manager.py'] = s.surfaces['scripts/publication_manager.py'].replace('if legacy_manifest.exists():', 'if False:'); }, 'must reject a legacy zenn/package.json manifest'],
    ['workflow root script guard removed', (s) => { s.surfaces['.github/workflows/book-qa.yml'] = s.surfaces['.github/workflows/book-qa.yml'].replace('ci --ignore-scripts', 'ci'); }, 'Book QA root step'],
    ['workflow formatter script guard removed', (s) => { s.surfaces['.github/workflows/book-qa.yml'] = s.surfaces['.github/workflows/book-qa.yml'].replace('npm ci --ignore-scripts', 'npm ci'); }, 'formatter-checkout'],
    ['workflow comment-only guard', (s) => { s.surfaces['.github/workflows/book-qa.yml'] = s.surfaces['.github/workflows/book-qa.yml'].replace('run: npx --yes npm@12.0.1 ci --ignore-scripts', 'run: |\n          # PUPPETEER_SKIP_DOWNLOAD=true npx --yes npm@12.0.1 ci --ignore-scripts\n          npx --yes npm@12.0.1 ci'); }, 'Book QA root step'],
    ['workflow guarded then unguarded compound', (s) => { s.surfaces['.github/workflows/book-qa.yml'] = s.surfaces['.github/workflows/book-qa.yml'].replace('run: npx --yes npm@12.0.1 ci --ignore-scripts', 'run: npx --yes npm@12.0.1 ci --ignore-scripts && npm install'); }, 'segment 2 install command must use --ignore-scripts'],
    ['workflow false download environment', (s) => { s.surfaces['.github/workflows/book-qa.yml'] = s.surfaces['.github/workflows/book-qa.yml'].replace("PUPPETEER_SKIP_DOWNLOAD: 'true'", "PUPPETEER_SKIP_DOWNLOAD: 'false'"); }, 'Puppeteer browser downloads'],
    ['easy setup Node validation drift', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace(EXPECTED.nodeRange, '>=22'); }, 'Node validation/export'],
    ['easy setup Node export removed', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('module.exports.isSupportedNodeVersion = isSupportedNodeVersion;', ''); }, 'Node validation/export'],
    ['easy setup npm validation drift', (s) => { s.surfaces['easy-setup.js'] = s.surfaces['easy-setup.js'].replace('12.0.1', '11.0.0'); }, 'npm validation'],
    ['Puppeteer mock consumer script removed', (s) => { delete s.pkg.scripts['check:puppeteer25-consumer']; }, 'package.json must retain check:puppeteer25-consumer'],
    ['Puppeteer mock consumer self-test removed', (s) => { delete s.pkg.scripts['check:puppeteer25-consumer:self-test']; }, 'package.json must retain check:puppeteer25-consumer:self-test'],
  ];
  cases.forEach(([name, mutate, marker]) => expectRejected(state, name, mutate, marker));
  runPublicationManagerIntegration();
  runCacheKeyPatternIntegration();
  const npmVersions = runLifecycleIsolationIntegration();
  console.log(`Install-script policy self-test passed: ${cases.length} negative mutations rejected; publication manager created no Zenn manifest and rejected a legacy manifest; cache-key glob hashed nested Markdown; clean-cache local lifecycle fixture isolated with npm ${npmVersions.join(' and npm ')}.`);
} else {
  const classifiedCount = Object.entries(state.surfaces)
    .filter(([file, source]) => containsSurfaceInstallIntent(file, source))
    .filter(([file]) => classifyInstallSurface(file)).length;
  console.log(`Install-script policy passed: ${classifiedCount} install surfaces classified; AST executable audit and Puppeteer 25 package smoke passed.`);
}
