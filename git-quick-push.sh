#!/bin/bash

# Quick Git Push - No prompts, auto-commit message
# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}⚡ Quick Git Push${NC}\n"

# Check if there are changes
if [[ -z $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
    exit 0
fi

# Generate automatic commit message
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
COMMIT_MSG="Quick update: $TIMESTAMP"

# Show what's being committed
echo -e "${BLUE}📋 Changes:${NC}"
git status -s
echo ""

# Add all changes
git add .

# Commit
echo -e "${BLUE}💾 Commit: $COMMIT_MSG${NC}"
git commit -m "$COMMIT_MSG"

# Push
echo -e "${BLUE}🚀 Pushing...${NC}"
git push

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Done!${NC}"
else
    echo -e "\n${YELLOW}⚠️  Push failed.${NC}"
    exit 1
fi

