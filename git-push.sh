#!/bin/bash

# Git Push Automation Script
# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Git Push Automation${NC}\n"

# Check if there are changes
if [[ -z $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
    exit 0
fi

# Show status
echo -e "${BLUE}📋 Current changes:${NC}"
git status -s
echo ""

# Ask for commit message
echo -e "${BLUE}💬 Enter commit message (or press Enter for auto-generated):${NC}"
read -r COMMIT_MSG

# Generate automatic commit message if empty
if [ -z "$COMMIT_MSG" ]; then
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    COMMIT_MSG="Auto-update: $TIMESTAMP"
    echo -e "${YELLOW}📝 Using auto-generated message: $COMMIT_MSG${NC}"
fi

# Add all changes
echo -e "\n${BLUE}➕ Adding changes...${NC}"
git add .

# Commit
echo -e "${BLUE}💾 Committing...${NC}"
git commit -m "$COMMIT_MSG"

# Push
echo -e "${BLUE}🚀 Pushing to remote...${NC}"
git push

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Successfully pushed to remote!${NC}"
else
    echo -e "\n${YELLOW}⚠️  Push failed. Please check your git configuration.${NC}"
    exit 1
fi

