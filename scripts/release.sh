#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# release.sh — interactive release workflow
#
# Usage:  npm run release   (or ./scripts/release.sh)
# ---------------------------------------------------------------------------

# 1. Reject if uncommitted workspace changes exist
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ ERROR: Working tree is dirty. Please commit or stash changes before releasing." >&2
  git status --short
  exit 1
fi

# 2. Confirmation checklist
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📋 Release Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1.  Integration tests are green      (npm test)"
echo "  2.  Local physical checks pass       (build + device smoke)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -r -p "  Have you verified the checklist above? (y/N) " CONFIRM_LIST
if [ "${CONFIRM_LIST,,}" != "y" ] && [ "${CONFIRM_LIST,,}" != "yes" ]; then
  echo "⚠️   Release aborted — complete the checklist first."
  exit 0
fi

# 3. Ask for tag name
read -r -p "  Enter tag name (e.g. v1.0.0-dev.2): " TAG_NAME
if [ -z "$TAG_NAME" ]; then
  echo "❌ ERROR: Tag name cannot be empty." >&2
  exit 1
fi

# 4. Double-confirm
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Ready to create and push tag:  $TAG_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -r -p "  Type the tag name again to confirm: " CONFIRM_TAG
if [ "$CONFIRM_TAG" != "$TAG_NAME" ]; then
  echo "⚠️   Tag mismatch — release aborted."
  exit 0
fi

# 5. Create annotated tag and push
echo ""
echo "  🏷️  Creating annotated tag: $TAG_NAME ..."
git tag -a "$TAG_NAME" -m "Release $TAG_NAME"

echo "  📤 Pushing tag to origin ..."
git push origin "$TAG_NAME"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  Tag $TAG_NAME pushed successfully!"
echo ""
echo "  GitHub Actions will now:"
echo "     → Build the Android APK via EAS"
echo "     → Create a GitHub Release with the APK attached"
echo "  Watch: https://github.com/msantagiulianab/solana-staker-mobile/actions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"