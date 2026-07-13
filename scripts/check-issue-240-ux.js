#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const errors = [];
const routes = ['/appendices/checklist-pack/', '/appendices/figure-index/'];
const figures = [
  ['chapter01', 'figure-chapter01-repository-sync', '図1.1：ローカルとリモートの同期'],
  ['chapter05', 'figure-chapter05-repository-visibility', '図5.1：Public / Privateリポジトリの判断フロー'],
  ['chapter07', 'figure-chapter07-hybrid-review-flow', '図7.1：ハイブリッドレビューワークフロー'],
  ['chapter09', 'figure-chapter09-permission-inheritance', '図9.1：組織からリポジトリへの権限継承'],
  ['chapter12', 'figure-chapter12-ml-git-flow', '図12.1：ML開発向けGit Flow']
];

const read = (file) => {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (error) { errors.push(`${file}: read failed (${error.message})`); return ''; }
};
const expect = (condition, message) => { if (!condition) errors.push(message); };
const normalize = (content) => content.replace(/\r\n/g, '\n');
const stripFrontMatter = (content) => normalize(content).replace(/^---\n[\s\S]*?\n---\n/, '');

let config = {};
try {
  config = JSON.parse(read('book-config.json'));
} catch (error) {
  errors.push(`book-config.json: JSON parse failed (${error.message})`);
}
expect(config.ux?.modules?.checklistPack === true, 'book-config.json: checklistPack must be true');
expect(config.ux?.modules?.figureIndex === true, 'book-config.json: figureIndex must be true');

const navigation = read('docs/_data/navigation.yml');
const top = read('docs/index.md');
for (const route of routes) {
  expect(fs.existsSync(path.join('docs', route.slice(1), 'index.md')), `missing public canonical route ${route}`);
  expect(fs.existsSync(path.join('src', route.slice(1), 'index.md')), `missing source canonical route ${route}`);
  expect(navigation.includes(`path: ${route}`), `navigation is missing ${route}`);
  expect(top.includes(`](${route.slice(1)})`), `top page is missing ${route}`);
}
const appendixG = navigation.indexOf('path: /appendices/appendix-g/');
const checklist = navigation.indexOf('path: /appendices/checklist-pack/');
const figureIndexRoute = navigation.indexOf('path: /appendices/figure-index/');
const afterword = navigation.indexOf('afterword:');
expect(appendixG >= 0 && appendixG < checklist && checklist < figureIndexRoute && figureIndexRoute < afterword,
  'new routes must follow appendix G and precede afterword');
expect((navigation.match(/path: \/appendices\/checklist-pack\//g) || []).length === 1,
  'checklist-pack route must occur exactly once in navigation');
expect((navigation.match(/path: \/appendices\/figure-index\//g) || []).length === 1,
  'figure-index route must occur exactly once in navigation');

const publicFigureIndex = read('docs/appendices/figure-index/index.md');
const sourceFigureIndex = read('src/appendices/figure-index/index.md');
expect(stripFrontMatter(publicFigureIndex) === stripFrontMatter(sourceFigureIndex),
  'source and public figure indexes must have matching bodies');
const expectedIndexEntries = figures.map(([chapter, id, title], index) =>
  `${index + 1}. [${title}](../../chapters/${chapter}/#${id})`);
const actualIndexEntries = publicFigureIndex.match(/^\d+\. \[[^\]]+\]\([^)]+\).*$/gm) || [];
expect(JSON.stringify(actualIndexEntries.map((line) => line.split(' — ')[0])) === JSON.stringify(expectedIndexEntries),
  'figure index must contain the exact five entries in source order with contracted deep links');
expect(!/(?:favicon|badge|logo|screenshot)/i.test(actualIndexEntries.join('\n')),
  'figure index must not include UI assets or screenshot examples');

const allPublicMarkdown = [];
for (const [chapter, id] of figures) {
  const publicFile = `docs/chapters/${chapter}/index.md`;
  const sourceFile = `src/chapters/${chapter}/index.md`;
  const publicContent = read(publicFile);
  const sourceContent = read(sourceFile);
  allPublicMarkdown.push(publicContent);
  const pattern = new RegExp(`<figure id="${id}"[\\s\\S]*?<\\/figure>`);
  const publicMatch = publicContent.match(pattern);
  const sourceMatch = sourceContent.match(pattern);
  expect(Boolean(publicMatch), `${publicFile}: missing stable figure ${id}`);
  expect(Boolean(sourceMatch), `${sourceFile}: missing stable figure ${id}`);
  expect(Boolean(publicMatch && sourceMatch) && normalize(publicMatch[0]) === normalize(sourceMatch[0]),
    `${chapter}: source/public figure blocks must match`);
  if (publicMatch) {
    for (const value of ['<svg ', 'viewBox=', 'max-width: 100%', 'role="img"', '<title ', '<desc ', '<figcaption>']) {
      expect(publicMatch[0].includes(value), `${publicFile}: ${id} lacks ${value}`);
    }
  }
  expect(!publicContent.includes('```mermaid'), `${publicFile}: Mermaid must be removed`);
  expect(!sourceContent.includes('```mermaid'), `${sourceFile}: Mermaid must be removed`);
}
const publicFigureIds = allPublicMarkdown.join('\n').match(/<figure id="figure-chapter[^\"]+"/g) || [];
expect(publicFigureIds.length === 5, 'the five target chapters must publish exactly five contracted figures');

const publicChecklist = read('docs/appendices/checklist-pack/index.md');
const sourceChecklist = read('src/appendices/checklist-pack/index.md');
expect(stripFrontMatter(publicChecklist) === stripFrontMatter(sourceChecklist),
  'source and public checklist packs must have matching bodies');
for (const section of ['準備', 'Issue と計画', 'ブランチとコミット', 'Pull Request とレビュー', 'CI/CD', 'セキュリティ', '組織・大規模運用']) {
  expect(publicChecklist.includes(`## ${section}`), `checklist pack is missing section: ${section}`);
}
const checklistItems = publicChecklist.match(/^- \[ \] .+$/gm) || [];
expect(checklistItems.length >= 21, 'checklist pack must contain at least 21 actionable checks');
expect(checklistItems.every((item) => item.includes('根拠:') && /\.\.\/\.\.\/chapters\/chapter\d{2}\//.test(item)),
  'every checklist item must link to at least one grounding chapter');
expect(publicChecklist.includes('実施済み項目ではありません'),
  'checklist pack must distinguish repository examples from completed checks');

const hasMobileFigureCss = (content) =>
  content.includes('.book-figure:not(.book-figure--narrow)') && content.includes('min-width: 720px');
const publicCss = read('docs/assets/css/main.css');
const sourceCss = read('templates/styles/main.css');
expect(hasMobileFigureCss(publicCss),
  'public mobile figure CSS must preserve text readability with a horizontal scroll viewport');
expect(hasMobileFigureCss(sourceCss),
  'generated stylesheet source must preserve the mobile figure horizontal scroll contract');
const workflow = read('.github/workflows/book-qa.yml');
expect(workflow.includes('node scripts/check-issue-240-ux.js'),
  'Book QA must execute the Issue #240 UX contract');

if (errors.length) {
  console.error('Issue #240 UX contract failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Issue #240 UX contract passed.');
