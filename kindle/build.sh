#!/bin/bash
# Kindle book build script

echo "🔨 Building Kindle version..."

# Create output directory
mkdir -p output

# Combine all chapters
echo "📚 Combining chapters..."
cat ../introduction.md > output/book.md
echo -e "\n\n" >> output/book.md

for chapter in ../chapter-*.md; do
    echo "Adding: $(basename $chapter)"
    cat "$chapter" >> output/book.md
    echo -e "\n\n" >> output/book.md
done

for appendix in ../appendix-*.md; do
    echo "Adding: $(basename $appendix)"
    cat "$appendix" >> output/book.md
    echo -e "\n\n" >> output/book.md
done

echo "✅ Markdown file created: output/book.md"

# Convert to EPUB using pandoc (if available)
if command -v pandoc &> /dev/null; then
    echo "📖 Converting to EPUB..."
    pandoc output/book.md \
        -o output/book.epub \
        --epub-metadata=metadata.xml \
        --toc \
        --toc-depth=2 \
        --epub-cover-image=../assets/images/cover.png 2>/dev/null || true
    echo "✅ EPUB created: output/book.epub"
else
    echo "⚠️ Pandoc not installed. Skipping EPUB conversion."
fi

echo "✅ Kindle build complete!"