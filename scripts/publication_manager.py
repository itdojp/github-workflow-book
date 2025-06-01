#!/usr/bin/env python3
"""
Publication Manager for AI GitHub Workflow Book
Converts markdown files for different publishing platforms
"""

import os
import re
import yaml
from pathlib import Path
from typing import Dict, List, Tuple
import argparse

class PublicationManager:
    def __init__(self, source_dir: str = "."):
        self.source_dir = Path(source_dir)
        self.platforms = {
            "github_pages": self._prepare_github_pages,
            "kindle": self._prepare_kindle,
            "zenn": self._prepare_zenn
        }
        
    def prepare_all_platforms(self):
        """全プラットフォーム向けにファイルを準備"""
        print("📚 AI GitHub Workflow Book - Publication Manager")
        print("=" * 50)
        
        for platform, handler in self.platforms.items():
            print(f"\n🔄 {platform.replace('_', ' ').title()} の準備中...")
            handler()
            print(f"✅ {platform.replace('_', ' ').title()} 準備完了")
            
        print("\n🎉 全プラットフォームの準備が完了しました！")
        self._show_publication_guide()
    
    def _prepare_github_pages(self):
        """GitHub Pages用の準備"""
        pages_dir = self.source_dir / "docs"
        pages_dir.mkdir(exist_ok=True)
        
        # _config.ymlが既に存在することを確認
        config_file = self.source_dir / "_config.yml"
        if not config_file.exists():
            print("⚠️  _config.yml が見つかりません")
            return
            
        # index.htmlの作成
        index_content = """---
layout: default
title: "AI開発のためのGitHubワークフロー実践ガイド"
---

{% include_relative README.md %}
"""
        with open(pages_dir / "index.html", "w", encoding="utf-8") as f:
            f.write(index_content)
            
        # ナビゲーション用の_includes作成
        includes_dir = pages_dir / "_includes"
        includes_dir.mkdir(exist_ok=True)
        
        nav_content = self._generate_navigation()
        with open(includes_dir / "navigation.html", "w", encoding="utf-8") as f:
            f.write(nav_content)
    
    def _prepare_kindle(self):
        """Kindle用の準備"""
        kindle_dir = self.source_dir / "kindle"
        kindle_dir.mkdir(exist_ok=True)
        
        # 全章を統合したファイルの作成
        complete_content = self._merge_all_chapters()
        
        with open(kindle_dir / "complete_book.md", "w", encoding="utf-8") as f:
            f.write(complete_content)
            
        # Kindlegenの設定ファイル
        opf_content = self._generate_kindle_opf()
        with open(kindle_dir / "book.opf", "w", encoding="utf-8") as f:
            f.write(opf_content)
            
        # 変換スクリプト
        script_content = self._generate_kindle_script()
        script_file = kindle_dir / "convert_to_kindle.sh"
        with open(script_file, "w", encoding="utf-8") as f:
            f.write(script_content)
        os.chmod(script_file, 0o755)
    
    def _prepare_zenn(self):
        """Zenn用の準備"""
        zenn_dir = self.source_dir / "zenn"
        zenn_dir.mkdir(exist_ok=True)
        
        book_dir = zenn_dir / "books" / "github-workflow-ai"
        book_dir.mkdir(parents=True, exist_ok=True)
        
        chapters_dir = book_dir / "chapters"
        chapters_dir.mkdir(exist_ok=True)
        
        # config.yamlの作成
        config = self._generate_zenn_config()
        with open(book_dir / "config.yaml", "w", encoding="utf-8") as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False)
            
        # 各章をZenn形式に変換
        self._convert_chapters_to_zenn(chapters_dir)
        
        # package.jsonの作成
        package_json = {
            "name": "github-workflow-ai-zenn",
            "version": "1.0.0",
            "description": "AI開発のためのGitHubワークフロー実践ガイド - Zenn版",
            "scripts": {
                "preview": "zenn preview",
                "new:article": "zenn new:article",
                "new:book": "zenn new:book"
            },
            "devDependencies": {
                "zenn-cli": "^0.1.147"
            }
        }
        
        with open(zenn_dir / "package.json", "w", encoding="utf-8") as f:
            import json
            json.dump(package_json, f, indent=2, ensure_ascii=False)
    
    def _generate_navigation(self) -> str:
        """ナビゲーションHTMLを生成"""
        chapters = self._get_chapter_list()
        
        nav_html = """
<nav class="book-navigation">
  <h3>📚 目次</h3>
  <ul class="chapter-list">
"""
        
        current_part = None
        for chapter in chapters:
            # 部の区切りを検出
            if "第1部" in chapter["title"]:
                current_part = "第1部：AI協働時代の基礎編"
            elif "第2部" in chapter["title"]:
                current_part = "第2部：AIツール活用編"
            elif "第3部" in chapter["title"]:
                current_part = "第3部：セキュリティと権限管理編"
            elif "第4部" in chapter["title"]:
                current_part = "第4部：実践編（チーム開発）"
            elif "第5部" in chapter["title"]:
                current_part = "第5部：発展編（エンタープライズ対応）"
                
            if current_part and "第" in chapter["title"] and "章" in chapter["title"]:
                special_mark = " ⭐" if "第2章" in chapter["title"] else ""
                nav_html += f"""
    <li class="chapter-item">
      <a href="{chapter['file']}" class="chapter-link">
        {chapter['title']}{special_mark}
      </a>
    </li>"""
        
        nav_html += """
  </ul>
</nav>

<style>
.book-navigation {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.chapter-list {
  list-style: none;
  padding: 0;
}

.chapter-item {
  margin: 0.5rem 0;
}

.chapter-link {
  text-decoration: none;
  color: #0366d6;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  display: block;
}

.chapter-link:hover {
  background: #e1f5fe;
}
</style>
"""
        return nav_html
    
    def _merge_all_chapters(self) -> str:
        """全章を統合してKindle用のファイルを作成"""
        content = """# AI開発のためのGitHubワークフロー実践ガイド

**著者**: [Your Name]  
**発行年**: 2024年  

---

"""
        
        # 目次の追加
        content += self._generate_toc() + "\n\n---\n\n"
        
        # 各章の内容を統合
        chapters = self._get_chapter_list()
        for chapter in chapters:
            file_path = self.source_dir / chapter["file"]
            if file_path.exists():
                with open(file_path, "r", encoding="utf-8") as f:
                    chapter_content = f.read()
                    
                # Kindle用に調整
                chapter_content = self._adjust_for_kindle(chapter_content)
                content += chapter_content + "\n\n---\n\n"
        
        return content
    
    def _adjust_for_kindle(self, content: str) -> str:
        """Kindle用にコンテンツを調整"""
        # 相対リンクを削除
        content = re.sub(r'\[([^\]]+)\]\([^)]+\.md\)', r'\1', content)
        
        # 画像パスを調整
        content = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', 
                        r'![Kindle Image: \1]', content)
        
        # ページ区切りを追加
        content = content.replace('# 第', '\n\n<div style="page-break-before: always;"></div>\n\n# 第')
        
        return content
    
    def _convert_chapters_to_zenn(self, chapters_dir: Path):
        """章をZenn形式に変換"""
        chapters = self._get_chapter_list()
        
        for i, chapter in enumerate(chapters, 1):
            source_file = self.source_dir / chapter["file"]
            if not source_file.exists():
                continue
                
            with open(source_file, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Zenn形式に変換
            zenn_content = self._convert_to_zenn_format(content, chapter["title"])
            
            # ファイル名を生成
            chapter_num = f"{i:02d}"
            filename = f"{chapter_num}-{chapter['file'].replace('.md', '').replace('chapter-', '').replace('appendix-', '')}.md"
            
            with open(chapters_dir / filename, "w", encoding="utf-8") as f:
                f.write(zenn_content)
    
    def _convert_to_zenn_format(self, content: str, title: str) -> str:
        """コンテンツをZenn形式に変換"""
        # Front matterを追加
        zenn_content = f"""---
title: "{title}"
---

"""
        
        # Zenn用の装飾を追加
        if "第2章" in title:
            zenn_content += """:::message
**🎯 この章の重要度: ★★★★★**

この章は本書の核心です。AI協働の基礎となるCLEARフレームワークを確実に習得してください。
:::

"""
        
        # コンテンツを調整
        content = re.sub(r'^# (.+)$', r'# \1', content, flags=re.MULTILINE)
        
        # コードブロックの言語指定を確認
        content = re.sub(r'```(\w+)', lambda m: f'```{m.group(1)}', content)
        
        # Zenn特有の記法に変換
        content = re.sub(r'> \*\*(.+?)\*\*', r':::message alert\n\1\n:::', content)
        
        zenn_content += content
        
        return zenn_content
    
    def _get_chapter_list(self) -> List[Dict[str, str]]:
        """章のリストを取得"""
        chapters = []
        
        # README.mdから章の情報を抽出
        readme_path = self.source_dir / "README.md"
        if readme_path.exists():
            with open(readme_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            # マークダウンリンクを抽出
            links = re.findall(r'\[([^\]]+)\]\(([^)]+\.md)\)', content)
            for title, file in links:
                if any(keyword in file for keyword in ['chapter-', 'appendix-']):
                    chapters.append({"title": title, "file": file})
        
        return chapters
    
    def _generate_toc(self) -> str:
        """目次を生成"""
        chapters = self._get_chapter_list()
        toc = "## 目次\n\n"
        
        for chapter in chapters:
            if "章" in chapter["title"] or "付録" in chapter["title"]:
                anchor = chapter["title"].lower().replace("：", "-").replace(" ", "-")
                toc += f"- [{chapter['title']}](#{anchor})\n"
        
        return toc
    
    def _generate_kindle_opf(self) -> str:
        """Kindle用OPFファイルを生成"""
        return """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>AI開発のためのGitHubワークフロー実践ガイド</dc:title>
    <dc:creator>Your Name</dc:creator>
    <dc:language>ja</dc:language>
    <dc:identifier id="BookId">github-workflow-ai-guide</dc:identifier>
    <dc:subject>プログラミング</dc:subject>
    <dc:subject>GitHub</dc:subject>
    <dc:subject>AI</dc:subject>
    <dc:description>AI協働時代に対応した実践的GitHubワークフローガイド</dc:description>
  </metadata>
  <manifest>
    <item id="content" href="complete_book.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>"""
    
    def _generate_kindle_script(self) -> str:
        """Kindle変換スクリプトを生成"""
        return """#!/bin/bash
# Kindle形式への変換スクリプト

echo "📚 Kindle形式への変換を開始します..."

# Pandocを使用してHTMLに変換
if command -v pandoc &> /dev/null; then
    echo "📄 HTMLファイルを生成中..."
    pandoc complete_book.md -o complete_book.html \\
        --metadata title="AI開発のためのGitHubワークフロー実践ガイド" \\
        --css="../styles/kindle.css" \\
        --toc \\
        --toc-depth=2
    
    echo "✅ HTMLファイルが生成されました"
else
    echo "❌ Pandocがインストールされていません"
    echo "   brew install pandoc (macOS)"
    echo "   sudo apt install pandoc (Ubuntu)"
    exit 1
fi

# Kindlegenを使用してMOBIに変換（オプション）
if command -v kindlegen &> /dev/null; then
    echo "📱 MOBI形式に変換中..."
    kindlegen book.opf
    echo "✅ MOBI形式への変換が完了しました"
else
    echo "ℹ️  Kindlegen がインストールされていません（オプション）"
    echo "   Amazon Kindle Publishing Guidelines からダウンロード可能です"
fi

echo "🎉 Kindle用ファイルの準備が完了しました！"
echo "📁 ファイル: complete_book.html"
"""
    
    def _generate_zenn_config(self) -> Dict:
        """Zenn用設定を生成"""
        return {
            "title": "AI開発のためのGitHubワークフロー実践ガイド",
            "summary": "AI協働時代に対応した実践的GitHubワークフローガイド。ChatGPT、GitHub Copilot、Claudeなどを活用してチーム開発の生産性を飛躍的に向上させる方法を体系的に学べます。",
            "topics": ["github", "ai", "copilot", "workflow", "devops"],
            "published": True,
            "price": 1980,
            "cover": "./images/cover.png"
        }
    
    def _show_publication_guide(self):
        """公開ガイドを表示"""
        guide = """
📖 公開ガイド
============

🌐 GitHub Pages
---------------
1. Settings → Pages → Source: Deploy from a branch
2. Branch: main, Folder: / (root)
3. URL: https://yourusername.github.io/github-workflow-book

📱 Kindle
----------
1. kindle/complete_book.html を確認
2. kindle/convert_to_kindle.sh を実行
3. Amazon KDP (Kindle Direct Publishing) にアップロード

📝 Zenn
--------
1. cd zenn && npm install
2. npx zenn preview でプレビュー確認
3. npx zenn publish book github-workflow-ai で公開

🔗 便利なリンク
---------------
- GitHub Pages設定: https://pages.github.com/
- Kindle Direct Publishing: https://kdp.amazon.com/
- Zenn Books: https://zenn.dev/books

💡 Tips
--------
- 各プラットフォームで読者に最適化された体験を提供
- 定期的な更新とフィードバック対応
- クロスプラットフォームでの一貫性維持
"""
        print(guide)

def main():
    parser = argparse.ArgumentParser(description="AI GitHub Workflow Book Publication Manager")
    parser.add_argument("--platform", choices=["github_pages", "kindle", "zenn", "all"], 
                       default="all", help="Target platform")
    parser.add_argument("--source", default=".", help="Source directory")
    
    args = parser.parse_args()
    
    manager = PublicationManager(args.source)
    
    if args.platform == "all":
        manager.prepare_all_platforms()
    else:
        print(f"🔄 {args.platform.replace('_', ' ').title()} の準備中...")
        manager.platforms[args.platform]()
        print(f"✅ {args.platform.replace('_', ' ').title()} 準備完了")

if __name__ == "__main__":
    main()