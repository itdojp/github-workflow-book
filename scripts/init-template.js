#!/usr/bin/env node

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function prompt(question, defaultValue = '') {
  return new Promise((resolve) => {
    const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(q, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

async function promptYesNo(question, defaultValue = true) {
  const answer = await prompt(`${question} (y/n)`, defaultValue ? 'y' : 'n');
  return answer.toLowerCase() === 'y';
}

function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dashes
    .replace(/-+/g, '-')          // Replace multiple consecutive dashes with single dash
    .replace(/^-|-$/g, '');       // Remove leading and trailing dashes
}

function createPrivateRepoName(publicRepoName) {
  if (publicRepoName.endsWith('-public')) {
    return publicRepoName.replace('-public', '-private');
  } else if (publicRepoName.endsWith('public')) {
    return publicRepoName.replace('public', '-private');
  } else {
    return publicRepoName + '-private';
  }
}

// プレースホルダーを実際の値に置換する関数
function replacePlaceholders(content, config) {
  const privateRepoName = createPrivateRepoName(config.publicRepoName);
  
  return content
    .replace(/\{\{BOOK_TITLE\}\}/g, config.bookTitle)
    .replace(/\{\{BOOK_DESCRIPTION\}\}/g, config.bookDescription)
    .replace(/\{\{AUTHOR_NAME\}\}/g, config.authorName)
    .replace(/\{\{AUTHOR_EMAIL\}\}/g, config.authorEmail)
    .replace(/\{\{GITHUB_USERNAME\}\}/g, config.githubUsername)
    .replace(/\{\{PUBLIC_REPO_NAME\}\}/g, config.publicRepoName)
    .replace(/\{\{PRIVATE_REPO_NAME\}\}/g, privateRepoName)
    .replace(/\{\{REPO_NAME\}\}/g, privateRepoName); // Generic repo name defaults to private
}

// ファイル内のプレースホルダーを置換
async function processTemplateFile(filePath, config) {
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    const processedContent = replacePlaceholders(content, config);
    
    if (content !== processedContent) {
      await fsPromises.writeFile(filePath, processedContent, 'utf-8');
      return true;
    }
    return false;
  } catch (error) {
    console.log(`⚠️  Warning: Could not process ${filePath}: ${error.message}`);
    return false;
  }
}

async function initTemplate() {
  console.log('📚 書籍テンプレートの初期化を開始します...\n');
  console.log('質問に答えて、あなたの書籍プロジェクトをセットアップしましょう。\n');

  // 設定情報の収集
  const config = {
    bookTitle: await prompt('書籍のタイトル', 'My Technical Book'),
    bookDescription: await prompt('書籍の説明', 'A comprehensive guide to...'),
    authorName: await prompt('著者名', 'Author Name'),
    authorEmail: await prompt('メールアドレス', 'author@example.com'),
    githubUsername: await prompt('GitHubユーザー名'),
    publicRepoName: await prompt('公開リポジトリ名', 'my-book-public'),
    language: await prompt('言語 (ja/en)', 'ja'),
    features: {
      math: await promptYesNo('数式サポートを有効にしますか？', true),
      mermaid: await promptYesNo('Mermaidダイアグラムを有効にしますか？', true),
      zenn: await promptYesNo('Zenn連携を有効にしますか？', false),
      kindle: await promptYesNo('Kindle出版サポートを有効にしますか？', false)
    }
  };

  console.log('\n設定を適用しています...\n');

  // テンプレートファイルの置換
  const templateFiles = [
    'package.json',
    '_config.yml',
    'README.md',
    'index.md',
    'template-quickstart.md',
    'create-template-repository.md',
    'deployment-guide.md',
    'template-structure.md',
    'scripts/deploy.sh'
  ];

  let processedFiles = 0;
  for (const filePath of templateFiles) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      const wasProcessed = await processTemplateFile(fullPath, config);
      if (wasProcessed) {
        processedFiles++;
      }
    }
  }

  if (processedFiles > 0) {
    console.log(`✓ ${processedFiles}個のテンプレートファイルを更新しました`);
  }

  // package.jsonの更新
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.name = createSlug(config.bookTitle);
    packageJson.description = config.bookDescription;
    packageJson.author = `${config.authorName} <${config.authorEmail}>`;
    // Generate private repo name based on public repo name for consistency
    const privateRepoName = createPrivateRepoName(config.publicRepoName);
    packageJson.repository = {
      type: 'git',
      url: `git+https://github.com/${config.githubUsername}/${privateRepoName}.git`
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✓ package.json を更新しました');
  }

  // _config.ymlの更新
  const configYmlPath = path.join(process.cwd(), '_config.yml');
  if (fs.existsSync(configYmlPath)) {
    let configYml = fs.readFileSync(configYmlPath, 'utf8');
    configYml = configYml.replace(/title: .+/, `title: ${config.bookTitle}`);
    configYml = configYml.replace(/description: .+/, `description: ${config.bookDescription}`);
    
    // Update author section
    configYml = configYml.replace(/(author:\s*\n\s*)name: .+/, `$1name: ${config.authorName}`);
    configYml = configYml.replace(/(author:\s*[\s\S]*?\n\s*)github: .+/, `$1github: ${config.githubUsername}`);
    configYml = configYml.replace(/(author:\s*[\s\S]*?\n\s*)email: .+/, `$1email: ${config.authorEmail}`);
    
    // Update repository section
    configYml = configYml.replace(/(repository:\s*\n\s*)github: .+/, `$1github: ${config.githubUsername}/${config.publicRepoName}`);
    
    configYml = configYml.replace(/baseurl: .+/, `baseurl: "/${config.publicRepoName}"`);
    configYml = configYml.replace(/url: .+/, `url: "https://${config.githubUsername}.github.io"`);
    configYml = configYml.replace(/lang: .+/, `lang: ${config.language}`);
    fs.writeFileSync(configYmlPath, configYml);
    console.log('✓ _config.yml を更新しました');
  }

  // deploy.shの更新
  const deployScriptPath = path.join(process.cwd(), 'scripts', 'deploy.sh');
  if (fs.existsSync(deployScriptPath)) {
    let deployScript = fs.readFileSync(deployScriptPath, 'utf8');
    
    // PUBLIC_REPOとGITHUB_USERの設定を探して更新
    if (deployScript.includes('PUBLIC_REPO=')) {
      deployScript = deployScript.replace(/PUBLIC_REPO=["']?[^"'\n]+["']?/, `PUBLIC_REPO="${config.publicRepoName}"`);
    } else {
      // 設定が見つからない場合は先頭に追加
      deployScript = `PUBLIC_REPO="${config.publicRepoName}"\n` + deployScript;
    }
    
    if (deployScript.includes('GITHUB_USER=')) {
      deployScript = deployScript.replace(/GITHUB_USER=["']?[^"'\n]+["']?/, `GITHUB_USER="${config.githubUsername}"`);
    } else {
      deployScript = `GITHUB_USER="${config.githubUsername}"\n` + deployScript;
    }
    
    fs.writeFileSync(deployScriptPath, deployScript);
    console.log('✓ deploy.sh を更新しました');
  }

  // index.mdの作成/更新
  const indexMdPath = path.join(process.cwd(), 'index.md');
  const indexContent = `# ${config.bookTitle}

${config.bookDescription}

## 目次

- [第1章 はじめに](src/chapters/chapter01/)

## 著者について

${config.authorName}

## ライセンス

この書籍は [MIT License](LICENSE) の下で公開されています。

---

${config.language === 'ja' ? 'この書籍は' : 'This book is'} [GitHub Pages](https://${config.githubUsername}.github.io/${config.publicRepoName}/) ${config.language === 'ja' ? 'で公開されています。' : 'is published on.'}
`;
  fs.writeFileSync(indexMdPath, indexContent);
  console.log('✓ index.md を作成しました');

  // サンプル章の作成
  const chapter01Dir = path.join(process.cwd(), 'src', 'chapters', 'chapter01');
  if (!fs.existsSync(chapter01Dir)) {
    fs.mkdirSync(chapter01Dir, { recursive: true });
  }
  
  const chapter01Content = `# 第1章 はじめに

## 1.1 本書の目的

${config.bookDescription}

## 1.2 対象読者

本書は以下の方を対象としています：

- 技術書籍の執筆に興味がある方
- GitHubを使った出版システムを構築したい方
- Markdownで書籍を執筆したい方

## 1.3 本書の構成

各章では以下の内容を扱います：

1. **第1章 はじめに** - 本書の概要と使い方
2. **第2章 [タイトル]** - [内容の説明]
3. **第3章 [タイトル]** - [内容の説明]

## まとめ

この章では、本書の目的と構成について説明しました。次章では、[次の内容]について詳しく見ていきます。
`;
  fs.writeFileSync(path.join(chapter01Dir, 'index.md'), chapter01Content);
  console.log('✓ サンプル章を作成しました');

  // Zenn設定の作成（オプション）
  if (config.features.zenn) {
    const zennConfig = {
      title: config.bookTitle,
      summary: config.bookDescription,
      topics: ["technical-writing", "github", "markdown"],
      published: false,
      price: 0,
      chapters: [
        {
          filename: "00-introduction",
          title: "はじめに"
        },
        {
          filename: "01-chapter1", 
          title: "第1章"
        }
      ]
    };
    fs.writeFileSync('zenn-book-config.json', JSON.stringify(zennConfig, null, 2) + '\n');
    
    // Zennチャプターディレクトリの作成
    const zennDir = path.join(process.cwd(), 'zenn-chapters');
    if (!fs.existsSync(zennDir)) {
      fs.mkdirSync(zennDir);
    }
    console.log('✓ Zenn設定を作成しました');
  }

  // README.mdの更新
  const readmeContent = `# ${config.bookTitle} (Private Repository)

${config.bookDescription}

## 🚀 クイックスタート

\`\`\`bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# プレビュー
npm run preview

# デプロイ
npm run deploy
\`\`\`

## 📝 執筆ガイド

### 新しい章の追加

1. \`src/chapters/chapter02/\` ディレクトリを作成
2. \`index.md\` に章の内容を記述
3. \`draft.md\` に下書きを保存（公開されません）
4. \`notes.md\` に執筆メモを記録（公開されません）

### プライベートコンテンツ

以下のコメントは公開版で自動的に削除されます：

\`\`\`markdown
<!-- TODO: タスク -->
<!-- PRIVATE: 内部メモ -->
<!-- INSTRUCTOR: 講師向け情報 -->
\`\`\`

## 🛠️ ビルドシステム

- **通常ビルド**: \`npm run build\`
- **インクリメンタルビルド**: \`npm run build:incremental\`
- **フルデプロイ**: \`npm run deploy:full\`

## 📚 プロジェクト構造

\`\`\`
${path.basename(process.cwd())}/
├── src/chapters/     # 章のソースファイル
├── scripts/          # ビルドスクリプト
├── _layouts/         # HTMLテンプレート
├── assets/          # 画像・リソース
└── public/          # ビルド出力（gitignore）
\`\`\`

## 🔗 関連リンク

- [公開版](https://${config.githubUsername}.github.io/${config.publicRepoName}/)
- [GitHubリポジトリ](https://github.com/${config.githubUsername}/${config.publicRepoName})

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。
`;
  fs.writeFileSync('README.md', readmeContent);
  console.log('✓ README.md を作成しました');

  // 設定の保存
  fs.writeFileSync('template-config.json', JSON.stringify(config, null, 2) + '\n');
  console.log('✓ 設定を保存しました');

  console.log('\n✅ テンプレートの初期化が完了しました！\n');
  console.log('📋 次のステップ:');
  // Generate private repo name based on public repo name for consistency
  const privateRepoName = createPrivateRepoName(config.publicRepoName);
  
  console.log('1. GitHubで以下のリポジトリを作成してください:');
  console.log(`   - プライベート: https://github.com/${config.githubUsername}/${privateRepoName}`);
  console.log(`   - パブリック: https://github.com/${config.githubUsername}/${config.publicRepoName}`);
  console.log('\n2. デプロイトークンの設定:');
  console.log('   🚀 簡単セットアップウィザードを使用:');
  console.log('   npm run setup-token');
  console.log('');
  console.log('   または手動設定:');
  console.log('   - https://github.com/settings/tokens/new');
  console.log('   - 必須スコープ: repo (Full control of private repositories)');
  console.log('   - 推奨スコープ: workflow (GitHub Actions使用時)');
  console.log('   - 組織の場合: admin:org, read:org も必要な場合があります');
  console.log('   - 詳細は docs/token-setup-guide.md を参照');
  console.log('   - プライベートリポジトリの Settings → Secrets → New repository secret');
  console.log('   - Name: DEPLOY_TOKEN, Value: 生成したトークン');
  console.log('\n3. 初回コミット:');
  console.log('   git add .');
  console.log('   git commit -m "Initial commit"');
  console.log(`   git remote add origin https://github.com/${config.githubUsername}/${privateRepoName}.git`);
  console.log('   git push -u origin main');
  console.log('\n4. GitHub Pagesの設定 (パブリックリポジトリ):');
  console.log('   - Settings → Pages → Source: Deploy from a branch');
  console.log('   - Branch: gh-pages / (root)');
  console.log('\n5. 初回デプロイ:');
  console.log('   npm run deploy:full');

  rl.close();
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('\n❌ エラーが発生しました:', error.message);
  process.exit(1);
});

// メイン実行
if (require.main === module) {
  initTemplate().catch((error) => {
    console.error('\n❌ エラー:', error);
    rl.close();
    process.exit(1);
  });
}

module.exports = { initTemplate };