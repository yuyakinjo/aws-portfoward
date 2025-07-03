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
      "test",
      "End-to-End CLI Tests",
      "Run Tests",
      "Run Tests with Coverage (24.x)",
      "Quality Gate"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
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
  "allow_fork_syncing": false
}
EOF

echo ""
echo "🎉 Branch protection rules have been successfully configured!"
echo ""
echo "📋 Summary of settings:"
echo "✅ PR required before merge"
echo "✅ Status checks required: test, End-to-End CLI Tests, Run Tests, Run Tests with Coverage (24.x), Quality Gate"
echo "✅ Required approving reviews: 0 (セルフマージ可能)"
echo "✅ Stale review dismissal: disabled (承認が維持される)"
echo "✅ Code owner reviews: not required"
echo "✅ Conversation resolution: required"
echo "✅ Force pushes: blocked"
echo "✅ Branch deletions: blocked"
echo ""
echo "🤖 Dependabot PRs with 0 required approvals can now auto-merge!"
echo "👤 Manual PRs can be self-approved and merged!"