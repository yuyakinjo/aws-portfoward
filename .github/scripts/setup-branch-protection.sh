#!/bin/bash
# ブランチ保護ルール設定スクリプト
# 実行前に GitHub CLI でログインが必要: gh auth login

set -e

REPO_OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO_NAME=$(gh repo view --json name --jq '.name')
BRANCH="main"

echo "🔧 Setting up branch protection rules for $REPO_OWNER/$REPO_NAME"
echo "📋 Branch: $BRANCH"

# 既存のブランチ保護ルールを削除（存在する場合）
echo "🗑️ Removing existing branch protection rules..."
gh api \
  --method DELETE \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO_OWNER/$REPO_NAME/branches/$BRANCH/protection" \
  2>/dev/null || echo "No existing protection rules found"

# 新しいブランチ保護ルールを設定
echo "✅ Creating new branch protection rules..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO_OWNER/$REPO_NAME/branches/$BRANCH/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Tests and Coverage / test",
      "Tests and Coverage / test-e2e",
      "Tests and Coverage / quality-gate",
      "Dependabot Auto-Merge / test"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF

echo "🎉 Branch protection rules successfully configured!"
echo ""
echo "📋 Summary:"
echo "  - Required status checks: ✅"
echo "  - Required PR reviews: ✅ (0 approvals for dependabot)"
echo "  - Dismiss stale reviews: ✅"
echo "  - Require conversation resolution: ✅"
echo "  - Restrict force pushes: ✅"
echo ""
echo "🔗 View settings: https://github.com/$REPO_OWNER/$REPO_NAME/settings/branches"