#!/bin/bash
# Script to remove sensitive files from git tracking
# Run this to remove files from git but keep them locally

echo "🔒 Removing sensitive files from git tracking..."
echo ""

# Remove markdown documentation files (keep README.md)
echo "📄 Removing documentation files..."
git rm --cached CLAUDE.md 2>/dev/null
git rm --cached -r .claude/ 2>/dev/null
git rm --cached -r documentation/ 2>/dev/null

# Remove test suites and mocks
echo "🧪 Removing test files..."
git rm --cached -r __tests__/ 2>/dev/null
git rm --cached -r __mocks__/ 2>/dev/null

# Remove database migrations
echo "🗄️  Removing database migrations..."
git rm --cached -r supabase/migrations/ 2>/dev/null

# Remove component configuration
echo "⚙️  Removing configuration files..."
git rm --cached components.json 2>/dev/null

# Remove all markdown files except README.md
echo "📝 Removing other markdown files..."
git ls-files "*.md" | grep -v "^README.md$" | xargs -I {} git rm --cached {} 2>/dev/null

# Remove backup files and screenshots (from earlier)
echo "🗑️  Removing backup files and screenshots..."
git rm --cached app/api/chat/route.ts.backup 2>/dev/null
git rm --cached *.png 2>/dev/null

echo ""
echo "✅ Files removed from git tracking (but kept locally)"
echo ""
echo "📋 Next steps:"
echo "1. Review changes: git status"
echo "2. Commit changes: git add .gitignore && git commit -m 'chore: remove sensitive files from git'"
echo "3. Push to remote: git push"
echo ""
echo "⚠️  IMPORTANT: These files are still in git history!"
echo "To completely remove from history, you need to use git filter-branch or BFG Repo-Cleaner"
echo "See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository"
