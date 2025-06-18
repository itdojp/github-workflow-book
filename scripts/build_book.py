#!/usr/bin/env python3
"""
Build script for the book project.
Combines all chapters into various output formats.
"""

import os
import re
import sys
from pathlib import Path
import json
from datetime import datetime

class BookBuilder:
    def __init__(self, root_path='.'):
        self.root_path = Path(root_path).absolute()
        self.output_dir = self.root_path / 'build'
        
    def ensure_output_dir(self):
        """Create output directory if it doesn't exist."""
        self.output_dir.mkdir(exist_ok=True)
        
    def get_chapter_files(self):
        """Get all chapter files in order."""
        chapter_files = []
        
        # Main chapters
        for i in range(1, 17):  # 16 chapters
            pattern = f"chapter-{i:02d}-*.md"
            files = list(self.root_path.glob(pattern))
            if files:
                chapter_files.append(files[0])
                
        # Appendices
        for letter in 'abcdefg':
            pattern = f"appendix-{letter}-*.md"
            files = list(self.root_path.glob(pattern))
            if files:
                chapter_files.append(files[0])
                
        return chapter_files
    
    def build_single_file(self):
        """Build a single Markdown file containing all chapters."""
        print("📚 Building single file version...")
        
        output_file = self.output_dir / 'complete-book.md'
        
        with open(output_file, 'w', encoding='utf-8') as outfile:
            # Write header
            outfile.write("# AI開発のためのGitHubワークフロー実践ガイド\n\n")
            outfile.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            outfile.write("---\n\n")
            
            # Add introduction if exists
            intro_file = self.root_path / 'introduction.md'
            if intro_file.exists():
                print(f"  Adding: {intro_file.name}")
                with open(intro_file, 'r', encoding='utf-8') as f:
                    outfile.write(f.read())
                    outfile.write("\n\n---\n\n")
                    
            # Add all chapters
            chapter_files = self.get_chapter_files()
            for chapter_file in chapter_files:
                print(f"  Adding: {chapter_file.name}")
                with open(chapter_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Adjust heading levels (optional)
                    # content = re.sub(r'^#', '##', content, flags=re.MULTILINE)
                    outfile.write(content)
                    outfile.write("\n\n---\n\n")
                    
        print(f"✅ Complete book saved to: {output_file.relative_to(self.root_path)}")
        
    def build_toc(self):
        """Generate a table of contents."""
        print("📑 Building table of contents...")
        
        toc_file = self.output_dir / 'table-of-contents.md'
        
        with open(toc_file, 'w', encoding='utf-8') as outfile:
            outfile.write("# 目次\n\n")
            
            chapter_files = self.get_chapter_files()
            
            current_part = None
            for chapter_file in chapter_files:
                with open(chapter_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    
                # Find the main heading
                for line in lines:
                    if line.startswith('# '):
                        title = line.strip('# \n')
                        
                        # Determine part
                        if 'chapter-' in chapter_file.name:
                            chapter_num = int(re.search(r'chapter-(\d+)', chapter_file.name).group(1))
                            if chapter_num <= 5:
                                part = "第1部：AI協働時代の基礎編"
                            elif chapter_num <= 11:
                                part = "第2部：AIツール活用編"
                            elif chapter_num <= 14:
                                part = "第3部：セキュリティとアクセス管理編"
                            else:
                                part = "第4部：実践編（チーム開発）"
                                
                            if part != current_part:
                                outfile.write(f"\n## {part}\n\n")
                                current_part = part
                                
                        # Write TOC entry
                        outfile.write(f"- [{title}]({chapter_file.name})\n")
                        break
                        
            # Add appendices section
            if any('appendix-' in f.name for f in chapter_files):
                outfile.write("\n## 付録\n\n")
                for chapter_file in chapter_files:
                    if 'appendix-' in chapter_file.name:
                        with open(chapter_file, 'r', encoding='utf-8') as f:
                            for line in f:
                                if line.startswith('# '):
                                    title = line.strip('# \n')
                                    outfile.write(f"- [{title}]({chapter_file.name})\n")
                                    break
                                    
        print(f"✅ Table of contents saved to: {toc_file.relative_to(self.root_path)}")
        
    def build_metadata(self):
        """Generate metadata file for the book."""
        print("📊 Building metadata...")
        
        metadata = {
            "title": "AI開発のためのGitHubワークフロー実践ガイド",
            "subtitle": "AI協働時代に対応した実践的GitHubワークフローガイドブック",
            "author": "株式会社アイティードゥ",
            "publisher": "ITDO Inc.",
            "language": "ja",
            "build_date": datetime.now().isoformat(),
            "version": "1.0.0",
            "chapters": []
        }
        
        chapter_files = self.get_chapter_files()
        for chapter_file in chapter_files:
            with open(chapter_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Count words (rough estimate for Japanese)
            word_count = len(re.findall(r'[ぁ-んァ-ン一-龥]+|[a-zA-Z]+', content))
            
            # Find title
            title_match = re.search(r'^# (.+)$', content, re.MULTILINE)
            title = title_match.group(1) if title_match else chapter_file.stem
            
            metadata["chapters"].append({
                "file": chapter_file.name,
                "title": title,
                "word_count": word_count,
                "size_bytes": len(content.encode('utf-8'))
            })
            
        # Calculate totals
        metadata["total_word_count"] = sum(ch["word_count"] for ch in metadata["chapters"])
        metadata["total_size_bytes"] = sum(ch["size_bytes"] for ch in metadata["chapters"])
        metadata["chapter_count"] = len([ch for ch in metadata["chapters"] if 'chapter-' in ch["file"]])
        metadata["appendix_count"] = len([ch for ch in metadata["chapters"] if 'appendix-' in ch["file"]])
        
        # Save metadata
        metadata_file = self.output_dir / 'book-metadata.json'
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
            
        print(f"✅ Metadata saved to: {metadata_file.relative_to(self.root_path)}")
        print(f"   Total chapters: {metadata['chapter_count']}")
        print(f"   Total appendices: {metadata['appendix_count']}")
        print(f"   Total word count: {metadata['total_word_count']:,}")
        
    def build_all(self):
        """Build all output formats."""
        print("🔨 Starting book build process...\n")
        
        self.ensure_output_dir()
        self.build_single_file()
        print()
        self.build_toc()
        print()
        self.build_metadata()
        
        print("\n✅ Build completed successfully!")

def main():
    """Main entry point."""
    root_path = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    builder = BookBuilder(root_path)
    builder.build_all()

if __name__ == '__main__':
    main()