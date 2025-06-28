# Migration Notes: github-workflow-book-private

This document records the specific migration steps taken to update this repository to use the latest book-publishing-template.

## Migration Summary

**Date**: 2025-06-19  
**From**: Python-based build system  
**To**: Node.js-based book-publishing-template (v1.2.0+ with README generation)

## Changes Made

### 1. Added Node.js Infrastructure
- Created `package.json` with all template scripts
- Installed npm dependencies
- Added Node.js entries to `.gitignore`

### 2. Created Configuration Files
- `book-config.json`: Centralized book configuration
- `.markdownlint.json`: Markdown linting rules
- `cspell.json`: Spell check configuration with Japanese terms
- Updated `_config.yml` to template format

### 3. Script Integration
- Copied essential build scripts from template (including updated build.js with README generation)
- Created `build-adapter.js` to handle flat file structure
- Created Python wrapper scripts:
  - `python-wrapper.js`: Generic Python script runner
  - `publish-to-zenn.js`: Zenn publishing integration
  - `python-build-adapter.js`: Python build integration

### 4. Template System
- Added `templates/` directory
- Created customized `book-readme.md` template specific to this book
- Template includes full chapter structure and book features

### 5. Preserved Existing Functionality
- Kept all Python scripts in `scripts/` directory
- Added npm scripts to run Python commands:
  - `npm run python:build`
  - `npm run python:publish`
  - `npm run python:validate`
  - `npm run python:metrics`
  - `npm run publish:zenn`

## New Commands Available

```bash
# Building
npm run build              # Build with adapter (handles flat structure)
npm run build:incremental  # Faster incremental builds
npm run build:parallel     # Parallel processing build

# Development
npm run dev               # Start hot reload dev server
npm run preview          # Build and preview

# Quality Checks
npm run check:all        # Run all checks
npm run check:markdown   # Lint markdown
npm run check:spelling   # Spell check
npm run check:links      # Validate links

# Deployment
npm run deploy           # Deploy to GitHub Pages
npm run setup:deploy     # Configure deployment
npm run setup:secrets    # Set up GitHub Actions secrets

# Python Integration
npm run python:build     # Run Python build script
npm run publish:zenn     # Publish to Zenn platform

# Version Management
npm run version:create   # Create new version
npm run version:list     # List all versions
```

## File Structure Adaptation

Since this repository uses a flat structure (chapters in root), the `build-adapter.js` temporarily creates the expected `src/` structure during build:

```
Root files:                    Temporary src/ structure:
chapter-01-*.md        →       src/chapters/chapter01/index.md
chapter-02-*.md        →       src/chapters/chapter02/index.md
appendix-a-*.md        →       src/appendices/appendix-a/index.md
README.md              →       src/introduction/index.md
```

## Testing Results

✅ Build completed successfully with:
- 1 introduction file
- 16 chapter files
- 7 appendix files
- Table of contents generated
- Images optimized
- **NEW**: Professional README.md generated from template

⚠️ Warnings detected:
- Sensitive content patterns found in some chapters (API keys, passwords, emails)
- These appear to be example/demo content and should be reviewed

## Next Steps

1. **Review sensitive content warnings** and ensure no real credentials are exposed
2. **Set up deployment**:
   ```bash
   npm run setup:deploy
   npm run setup:secrets
   ```
3. **Test all quality checks**:
   ```bash
   npm run check:all
   ```
4. **Configure GitHub Actions** for automated builds
5. **Consider migrating Python scripts** to JavaScript for full integration

## Rollback Instructions

If you need to rollback to the Python-only system:

1. Keep using the Python scripts directly:
   ```bash
   cd scripts
   python build_book.py
   python publication_manager.py
   ```

2. The following files can be safely removed:
   - `package.json`
   - `package-lock.json`
   - `node_modules/`
   - `book-config.json`
   - `.markdownlint.json`
   - New files in `scripts/` (except Python files)

3. Restore original `_config.yml` from git history

## Benefits Achieved

1. **Performance**: Incremental builds now available
2. **Development**: Hot reload server for instant preview
3. **Quality**: Automated linting and spell checking
4. **Standardization**: Same workflow as other ITDO book projects
5. **Future-proofing**: Easy updates from template repository
6. **Professional presentation**: Auto-generated README for public repository with full book structure