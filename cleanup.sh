#!/usr/bin/env bash
set -euo pipefail

# Navigate to repository root
cd "$(git rev-parse --show-toplevel)"

# Delete the incorrectly named directories
git rm -r "cp .."
git rm -r "pip install -r ../backend"
git rm -r "pytest tests"

# Stage any additional changes (should be none)
git add -A

# Commit and push if there are changes
git diff --cached --quiet || git commit -m "chore: remove incorrectly named directories"

git push origin master

echo "✅ Directories removed, commit made and pushed."
