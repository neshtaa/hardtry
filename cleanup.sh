#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "=== Step 1: Find directories that look like shell commands ==="
# We look for directories that contain spaces, dots, or typical shell tokens.
# Adjust the pattern if there are false matches.
BAD_DIRS=$(find . -maxdepth 1 -type d | grep -E '(^\./cp |^\./pip |^\./pytest |^\./\.\. |^\./\.\.\. )' || true)

if [ -z "$BAD_DIRS" ]; then
  echo "No suspect directories found. Exiting."
  exit 0
fi

echo "Suspect directories:"
echo "$BAD_DIRS"
echo ""

for d in $BAD_DIRS; do
  echo "=== Checking contents of $d ==="
  ls -la "$d"
  echo ""
done

echo "=== Step 2: Remove them with git rm ==="
for d in $BAD_DIRS; do
  git rm -r "$d" 2>/dev/null || echo "Warning: could not git-rm $d, trying regular rm"
  # If git rm failed (e.g. directory not tracked), just delete locally
  rm -rf "$d" 2>/dev/null || true
done

echo ""
echo "=== Step 3: Commit the cleanup ==="
git add -A
git diff --cached --quiet || git commit -m "cleanup: remove accidentally committed shell-command directories"

echo ""
echo "=== Step 4: Push to origin master ==="
git push origin master

echo ""
echo "=== Step 5: Set up automatic push after every future commit ==="
HOOK="${REPO_ROOT}/.git/hooks/post-commit"
if [ ! -f "$HOOK" ]; then
  cat > "$HOOK" << 'EOF'
#!/bin/sh
git push origin master
EOF
  chmod +x "$HOOK"
  echo "Git post-commit hook installed at $HOOK"
else
  echo "Post-commit hook already exists – please ensure it auto‑pushes to origin master."
fi

echo ""
echo "✅ All done. The repository should now be clean, and future commits will be pushed automatically."
