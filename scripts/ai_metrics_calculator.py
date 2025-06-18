#!/usr/bin/env python3
"""
AI Metrics Calculator for the book project.
Analyzes AI-related content and provides metrics.
"""

import os
import re
import json
from pathlib import Path
from collections import Counter, defaultdict

class AIMetricsCalculator:
    def __init__(self, root_path='.'):
        self.root_path = Path(root_path).absolute()
        self.metrics = {
            'ai_tools_mentioned': Counter(),
            'ai_patterns': Counter(),
            'code_examples': defaultdict(list),
            'best_practices': [],
            'case_studies': [],
            'metrics': defaultdict(int)
        }
        
        # AI tool patterns
        self.ai_tool_patterns = {
            'github_copilot': r'(?i)github\s+copilot|copilot',
            'chatgpt': r'(?i)chatgpt|chat\s*gpt',
            'claude': r'(?i)claude',
            'gpt4': r'(?i)gpt-?4',
            'gemini': r'(?i)gemini',
            'ai_code_review': r'(?i)ai.{0,10}(code\s*review|レビュー)',
            'ai_testing': r'(?i)ai.{0,10}(test|テスト)',
            'ml_ops': r'(?i)mlops|ml\s*ops'
        }
        
        # AI collaboration patterns
        self.collab_patterns = {
            'pair_programming': r'(?i)(ai.{0,10})?pair.{0,10}program|ペアプログラミング',
            'code_generation': r'(?i)code.{0,10}generat|コード生成',
            'automated_review': r'(?i)automat.{0,10}review|自動.{0,10}レビュー',
            'ai_workflow': r'(?i)ai.{0,10}workflow|ai.{0,10}ワークフロー',
            'prompt_engineering': r'(?i)prompt.{0,10}engineer|プロンプト',
            'clear_method': r'(?i)clear.{0,10}(方式|method|framework)'
        }
        
    def analyze_file(self, file_path):
        """Analyze a single Markdown file for AI metrics."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Count AI tools mentioned
            for tool_name, pattern in self.ai_tool_patterns.items():
                matches = re.findall(pattern, content)
                if matches:
                    self.metrics['ai_tools_mentioned'][tool_name] += len(matches)
                    
            # Count collaboration patterns
            for pattern_name, pattern in self.collab_patterns.items():
                matches = re.findall(pattern, content)
                if matches:
                    self.metrics['ai_patterns'][pattern_name] += len(matches)
                    
            # Extract code examples
            code_blocks = re.findall(r'```(\w+)?\n(.*?)```', content, re.DOTALL)
            for lang, code in code_blocks:
                if lang:
                    self.metrics['code_examples'][lang].append({
                        'file': str(file_path.relative_to(self.root_path)),
                        'lines': len(code.strip().split('\n'))
                    })
                    
            # Count specific metrics
            self.metrics['metrics']['total_words'] += len(re.findall(r'\b\w+\b', content))
            self.metrics['metrics']['ai_mentions'] += len(re.findall(r'(?i)\bai\b|人工知能', content))
            self.metrics['metrics']['github_mentions'] += len(re.findall(r'(?i)github', content))
            
            # Extract case studies
            case_study_matches = re.findall(r'(?i)(?:case\s*study|ケーススタディ|事例)[：:](.{0,100})', content)
            for match in case_study_matches:
                self.metrics['case_studies'].append({
                    'file': str(file_path.relative_to(self.root_path)),
                    'title': match.strip()
                })
                
            # Extract best practices
            best_practice_matches = re.findall(r'(?i)(?:best\s*practice|ベストプラクティス)[：:](.{0,100})', content)
            for match in best_practice_matches:
                self.metrics['best_practices'].append({
                    'file': str(file_path.relative_to(self.root_path)),
                    'practice': match.strip()
                })
                
        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")
            
    def calculate_metrics(self):
        """Calculate all AI-related metrics for the book."""
        print("🤖 Calculating AI metrics...")
        
        # Find all Markdown files
        markdown_files = list(self.root_path.glob("*.md"))
        markdown_files.extend(list((self.root_path / "chapters").glob("*.md")) if (self.root_path / "chapters").exists() else [])
        
        # Analyze each file
        for file_path in markdown_files:
            if not any(skip in str(file_path) for skip in ['.git', 'node_modules', 'build']):
                print(f"  Analyzing: {file_path.name}")
                self.analyze_file(file_path)
                
        # Calculate summary metrics
        total_code_examples = sum(len(examples) for examples in self.metrics['code_examples'].values())
        total_code_lines = sum(
            sum(ex['lines'] for ex in examples) 
            for examples in self.metrics['code_examples'].values()
        )
        
        # Create summary
        summary = {
            'ai_coverage': {
                'total_ai_mentions': self.metrics['metrics']['ai_mentions'],
                'ai_mentions_per_1000_words': round(
                    self.metrics['metrics']['ai_mentions'] * 1000 / max(self.metrics['metrics']['total_words'], 1), 2
                ),
                'github_integration_mentions': self.metrics['metrics']['github_mentions']
            },
            'ai_tools': {
                'unique_tools_covered': len([t for t, c in self.metrics['ai_tools_mentioned'].items() if c > 0]),
                'most_mentioned': self.metrics['ai_tools_mentioned'].most_common(5),
                'total_tool_mentions': sum(self.metrics['ai_tools_mentioned'].values())
            },
            'collaboration_patterns': {
                'patterns_covered': len([p for p, c in self.metrics['ai_patterns'].items() if c > 0]),
                'most_used_patterns': self.metrics['ai_patterns'].most_common(5),
                'total_pattern_mentions': sum(self.metrics['ai_patterns'].values())
            },
            'code_examples': {
                'total_examples': total_code_examples,
                'total_lines': total_code_lines,
                'languages': {
                    lang: len(examples) 
                    for lang, examples in self.metrics['code_examples'].items()
                },
                'average_lines_per_example': round(total_code_lines / max(total_code_examples, 1), 1)
            },
            'practical_content': {
                'case_studies': len(self.metrics['case_studies']),
                'best_practices': len(self.metrics['best_practices'])
            }
        }
        
        return summary
        
    def generate_report(self):
        """Generate a comprehensive AI metrics report."""
        summary = self.calculate_metrics()
        
        print("\n" + "="*60)
        print("🤖 AI METRICS REPORT")
        print("="*60)
        
        print("\n📊 AI Coverage:")
        print(f"  Total AI mentions: {summary['ai_coverage']['total_ai_mentions']}")
        print(f"  AI mentions per 1000 words: {summary['ai_coverage']['ai_mentions_per_1000_words']}")
        print(f"  GitHub integration mentions: {summary['ai_coverage']['github_integration_mentions']}")
        
        print("\n🛠️ AI Tools Coverage:")
        print(f"  Unique tools covered: {summary['ai_tools']['unique_tools_covered']}")
        print(f"  Total tool mentions: {summary['ai_tools']['total_tool_mentions']}")
        print("  Most mentioned tools:")
        for tool, count in summary['ai_tools']['most_mentioned']:
            print(f"    - {tool}: {count} mentions")
            
        print("\n🤝 Collaboration Patterns:")
        print(f"  Patterns covered: {summary['collaboration_patterns']['patterns_covered']}")
        print(f"  Total pattern mentions: {summary['collaboration_patterns']['total_pattern_mentions']}")
        print("  Most used patterns:")
        for pattern, count in summary['collaboration_patterns']['most_used_patterns']:
            print(f"    - {pattern}: {count} mentions")
            
        print("\n💻 Code Examples:")
        print(f"  Total examples: {summary['code_examples']['total_examples']}")
        print(f"  Total lines of code: {summary['code_examples']['total_lines']}")
        print(f"  Average lines per example: {summary['code_examples']['average_lines_per_example']}")
        print("  Languages used:")
        for lang, count in sorted(summary['code_examples']['languages'].items(), key=lambda x: x[1], reverse=True):
            print(f"    - {lang}: {count} examples")
            
        print("\n📚 Practical Content:")
        print(f"  Case studies: {summary['practical_content']['case_studies']}")
        print(f"  Best practices documented: {summary['practical_content']['best_practices']}")
        
        # Save detailed report
        report_path = self.root_path / 'ai-metrics-report.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'summary': summary,
                'detailed_metrics': {
                    'ai_tools': dict(self.metrics['ai_tools_mentioned']),
                    'patterns': dict(self.metrics['ai_patterns']),
                    'case_studies': self.metrics['case_studies'],
                    'best_practices': self.metrics['best_practices']
                }
            }, f, ensure_ascii=False, indent=2)
            
        print(f"\n📄 Detailed report saved to: {report_path.relative_to(self.root_path)}")
        
        # Calculate AI integration score
        ai_score = self._calculate_ai_integration_score(summary)
        print(f"\n🎯 AI Integration Score: {ai_score}/100")
        print(self._get_ai_integration_feedback(ai_score))
        
    def _calculate_ai_integration_score(self, summary):
        """Calculate an AI integration score based on metrics."""
        score = 0
        
        # AI mentions (max 20 points)
        mentions_per_1000 = summary['ai_coverage']['ai_mentions_per_1000_words']
        score += min(mentions_per_1000 * 2, 20)
        
        # Tool coverage (max 20 points)
        tools_covered = summary['ai_tools']['unique_tools_covered']
        score += min(tools_covered * 4, 20)
        
        # Collaboration patterns (max 20 points)
        patterns = summary['collaboration_patterns']['patterns_covered']
        score += min(patterns * 4, 20)
        
        # Code examples (max 20 points)
        examples = summary['code_examples']['total_examples']
        score += min(examples / 5, 20)
        
        # Practical content (max 20 points)
        practical = summary['practical_content']['case_studies'] + summary['practical_content']['best_practices']
        score += min(practical * 2, 20)
        
        return round(score)
        
    def _get_ai_integration_feedback(self, score):
        """Get feedback based on AI integration score."""
        if score >= 90:
            return "⭐ Excellent AI integration! The book comprehensively covers AI collaboration."
        elif score >= 70:
            return "✅ Good AI integration. Consider adding more practical examples or tool coverage."
        elif score >= 50:
            return "📈 Moderate AI integration. More AI-specific content would enhance the book."
        else:
            return "⚠️ Limited AI integration. Consider expanding AI-related topics and examples."

def main():
    """Main entry point."""
    import sys
    root_path = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    calculator = AIMetricsCalculator(root_path)
    calculator.generate_report()

if __name__ == '__main__':
    main()