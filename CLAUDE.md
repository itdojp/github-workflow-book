# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive Japanese-language technical book titled "AI開発のためのGitHubワークフロー実践ガイド" (Practical Guide to GitHub Workflows for AI Development). The project consists of 16 chapters plus 6 appendices, all written in Markdown format.

## File Structure and Conventions

### Naming Patterns
- **Main chapters**: `chapter-XX-descriptive-name.md` (zero-padded numbers 01-16)
- **Appendices**: `appendix-X-descriptive-name.md` (letters A-F)
- **Table of Contents**: `github-workflow-book-toc.md`

### Content Organization
The book is structured in 5 parts:
1. **Fundamentals** (Chapters 1-4): Basic Git/GitHub concepts
2. **AI Tools** (Chapters 5-7): GitHub Copilot, AI code review, security
3. **Security & Permissions** (Chapters 8-10): Access control, organization management
4. **Practical Implementation** (Chapters 11-14): Team workflows, CI/CD, data management
5. **Enterprise** (Chapters 15-16): External collaboration, compliance

## Content Format Standards

### Chapter Structure
Each chapter follows this pattern:
- Main heading: `# 第X章：Chapter Title`
- Numbered sections: `## X.1 Section Title`
- Subsections: `###` and `####` for deeper hierarchy
- End sections: `## まとめ` (Summary) and `## 確認事項` (Checklist)

### Content Types
- Code examples with proper syntax highlighting (Python, YAML, JSON, bash)
- Tables for comparisons and reference data
- File tree structures using text formatting
- Command-line examples with consistent formatting
- Configuration snippets for various tools

## Key Context for AI/ML Focus

This book specifically targets AI/ML development workflows, so all examples and use cases should be relevant to:
- Model training pipelines and experiment tracking
- Data versioning with Git LFS and DVC
- Security considerations for AI projects
- Collaborative ML development practices
- Enterprise AI governance and compliance

## Development Workflow

### Current State
- No automated build system (pure Markdown files)
- All content currently has unstaged modifications
- Single initial commit: "初期登録" (Initial registration)
- Working on `main` branch

### When Making Changes
- Maintain consistent Japanese technical writing style
- Follow existing formatting patterns for code examples
- Ensure cross-references between chapters remain accurate
- Keep practical examples focused on AI/ML development scenarios
- Preserve the modular, self-contained chapter design