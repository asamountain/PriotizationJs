# Git Push Automation 🚀

Quick and easy ways to commit and push your changes to git.

## 📋 Two Options:

### 1️⃣ **Interactive Push** (with custom commit message)
```bash
npm run push
```
- Shows you what changed
- Asks for your commit message
- Auto-generates one if you press Enter
- Commits and pushes

### 2️⃣ **Quick Push** (no prompts, instant)
```bash
npm run quick-push
```
- Shows what changed
- Auto-generates commit message with timestamp
- Commits and pushes immediately
- Perfect for rapid iterations

## 🎯 Example Workflow:

```bash
# Make your changes...
# Edit files, test features, etc.

# Quick push (no questions asked)
npm run quick-push

# Output:
# ⚡ Quick Git Push
# 📋 Changes:
#  M server.js
#  M public/app.js
# 💾 Commit: Quick update: 2025-10-18 15:30:45
# 🚀 Pushing...
# ✅ Done!
```

## 📝 Custom Commit Message:

```bash
npm run push

# It will ask:
# 💬 Enter commit message (or press Enter for auto-generated):
# You type: Add fullscreen chart feature
# 
# ✅ Successfully pushed to remote!
```

## ⚙️ Manual Scripts:

You can also run the scripts directly:

```bash
./git-push.sh          # Interactive
./git-quick-push.sh    # Quick
```

## 🔒 What Gets Committed:

- All tracked changes (`git add .`)
- New files
- Modified files
- Deleted files

**Note:** Files in `.gitignore` are NOT committed (like `node_modules/`, `tasks.db`, etc.)

## 💡 Pro Tips:

1. **Before pushing large changes**, review with `git status` first
2. **Use `quick-push`** for minor updates and iterations
3. **Use `push`** for meaningful commits with descriptive messages
4. Make sure you're on the correct branch!

## 🛡️ Safety:

- Scripts check if there are changes before pushing
- Won't push if there's nothing to commit
- Shows you what's being committed
- Safe to run anytime!

---

**Reminder:** Make sure your git remote is configured:
```bash
git remote -v  # Check your remote
```

