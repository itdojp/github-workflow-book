#!/usr/bin/env python3
"""
Link validation script for the book project.
Checks all internal and external links in Markdown files.
"""

import os
import re
import sys
from pathlib import Path
import requests
from urllib.parse import urlparse
import markdown
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Configuration
MARKDOWN_EXTENSIONS = ['.md']
TIMEOUT = 10
MAX_WORKERS = 10
RETRY_COUNT = 2
RETRY_DELAY = 1

# Files and directories to ignore
IGNORE_PATTERNS = [
    '.git',
    'node_modules',
    'venv',
    '__pycache__',
    '.github',
    'scripts'
]

class LinkValidator:
    def __init__(self, root_path='.'):
        self.root_path = Path(root_path).absolute()
        self.errors = []
        self.warnings = []
        self.checked_urls = {}
        
    def find_markdown_files(self):
        """Find all Markdown files in the project."""
        markdown_files = []
        
        for root, dirs, files in os.walk(self.root_path):
            # Remove ignored directories from search
            dirs[:] = [d for d in dirs if d not in IGNORE_PATTERNS]
            
            for file in files:
                if any(file.endswith(ext) for ext in MARKDOWN_EXTENSIONS):
                    file_path = Path(root) / file
                    if not any(pattern in str(file_path) for pattern in IGNORE_PATTERNS):
                        markdown_files.append(file_path)
                        
        return sorted(markdown_files)
    
    def extract_links(self, file_path):
        """Extract all links from a Markdown file."""
        links = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Extract Markdown links: [text](url)
            md_links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
            for text, url in md_links:
                links.append({
                    'text': text,
                    'url': url,
                    'file': file_path,
                    'type': 'markdown'
                })
                
            # Extract reference-style links: [text][ref]
            ref_links = re.findall(r'\[([^\]]+)\]\[([^\]]+)\]', content)
            ref_definitions = re.findall(r'^\[([^\]]+)\]:\s*(.+)$', content, re.MULTILINE)
            ref_dict = dict(ref_definitions)
            
            for text, ref in ref_links:
                if ref in ref_dict:
                    links.append({
                        'text': text,
                        'url': ref_dict[ref],
                        'file': file_path,
                        'type': 'reference'
                    })
                    
            # Extract raw URLs
            raw_urls = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', content)
            for url in raw_urls:
                if not any(url in link['url'] for link in links):
                    links.append({
                        'text': url,
                        'url': url,
                        'file': file_path,
                        'type': 'raw'
                    })
                    
        except Exception as e:
            self.errors.append(f"Error reading {file_path}: {e}")
            
        return links
    
    def check_internal_link(self, link):
        """Check if an internal link is valid."""
        url = link['url']
        file_path = link['file']
        
        # Handle anchor links
        if url.startswith('#'):
            # TODO: Check if anchor exists in the same file
            return True
            
        # Handle relative links
        if not url.startswith(('http://', 'https://', 'mailto:')):
            # Remove anchor from URL
            url_parts = url.split('#')
            target_path = url_parts[0]
            
            # Resolve relative path
            base_dir = file_path.parent
            resolved_path = (base_dir / target_path).resolve()
            
            # Check if file exists
            if not resolved_path.exists():
                self.errors.append(
                    f"Broken internal link in {file_path.relative_to(self.root_path)}: "
                    f"'{link['text']}' -> {target_path} (file not found)"
                )
                return False
                
            # TODO: Check if anchor exists in target file
            if len(url_parts) > 1:
                anchor = url_parts[1]
                # Implement anchor checking
                
        return True
    
    def check_external_link(self, link):
        """Check if an external link is valid."""
        url = link['url']
        
        # Skip non-HTTP links
        if not url.startswith(('http://', 'https://')):
            return True
            
        # Check cache first
        if url in self.checked_urls:
            return self.checked_urls[url]
            
        # Try to fetch the URL
        for attempt in range(RETRY_COUNT):
            try:
                response = requests.head(url, timeout=TIMEOUT, allow_redirects=True)
                
                # Accept 2xx and 3xx status codes
                if response.status_code < 400:
                    self.checked_urls[url] = True
                    return True
                else:
                    # Try GET request for some sites that don't support HEAD
                    response = requests.get(url, timeout=TIMEOUT, allow_redirects=True)
                    if response.status_code < 400:
                        self.checked_urls[url] = True
                        return True
                        
            except requests.exceptions.SSLError:
                self.warnings.append(f"SSL error for {url}")
                self.checked_urls[url] = True  # Don't fail on SSL errors
                return True
            except requests.exceptions.Timeout:
                if attempt < RETRY_COUNT - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                self.warnings.append(f"Timeout checking {url}")
                self.checked_urls[url] = True  # Don't fail on timeouts
                return True
            except Exception as e:
                if attempt < RETRY_COUNT - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                    
        # If all attempts failed
        self.errors.append(
            f"Broken external link in {link['file'].relative_to(self.root_path)}: "
            f"'{link['text']}' -> {url}"
        )
        self.checked_urls[url] = False
        return False
    
    def validate_all(self):
        """Validate all links in the project."""
        print("🔍 Finding Markdown files...")
        markdown_files = self.find_markdown_files()
        print(f"📄 Found {len(markdown_files)} Markdown files")
        
        # Extract all links
        all_links = []
        print("\n📖 Extracting links...")
        for file_path in markdown_files:
            links = self.extract_links(file_path)
            all_links.extend(links)
            
        print(f"🔗 Found {len(all_links)} total links")
        
        # Separate internal and external links
        internal_links = [l for l in all_links if not l['url'].startswith(('http://', 'https://'))]
        external_links = [l for l in all_links if l['url'].startswith(('http://', 'https://'))]
        
        print(f"  📁 Internal links: {len(internal_links)}")
        print(f"  🌐 External links: {len(external_links)}")
        
        # Check internal links
        print("\n✅ Checking internal links...")
        for link in internal_links:
            self.check_internal_link(link)
            
        # Check external links in parallel
        if external_links:
            print("\n🌐 Checking external links (this may take a while)...")
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                future_to_link = {
                    executor.submit(self.check_external_link, link): link 
                    for link in external_links
                }
                
                completed = 0
                for future in as_completed(future_to_link):
                    completed += 1
                    if completed % 10 == 0:
                        print(f"  Progress: {completed}/{len(external_links)}")
                        
        # Print results
        print("\n" + "="*50)
        print("📊 VALIDATION RESULTS")
        print("="*50)
        
        if self.warnings:
            print(f"\n⚠️  Warnings: {len(self.warnings)}")
            for warning in self.warnings[:5]:  # Show first 5 warnings
                print(f"  - {warning}")
            if len(self.warnings) > 5:
                print(f"  ... and {len(self.warnings) - 5} more warnings")
                
        if self.errors:
            print(f"\n❌ Errors: {len(self.errors)}")
            for error in self.errors:
                print(f"  - {error}")
            print("\n❌ Link validation FAILED")
            return False
        else:
            print("\n✅ All links are valid!")
            return True

def main():
    """Main entry point."""
    # Get root path from command line or use current directory
    root_path = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    validator = LinkValidator(root_path)
    success = validator.validate_all()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()