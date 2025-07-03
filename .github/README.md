# GitHub設定ファイル

このディレクトリには、GitHubリポジトリの設定をコードとして管理するためのファイルが含まれています。

## ファイル構成

```
.github/
├── dependabot.yml                    # Dependabot設定
├── branch-protection-config.json    # ブランチ保護ルール設定
├── scripts/
│   └── setup-branch-protection.sh   # ブランチ保護ルール適用スクリプト
└── workflows/
    ├── dependabot-auto-merge.yml     # Dependabot自動マージ
    ├── test.yml                      # テストワークフロー
    └── ...
```

## ブランチ保護ルールの設定

### 1. 設定の適用

```bash
# GitHub CLIでログイン
gh auth login

# ブランチ保護ルールを適用
.github/scripts/setup-branch-protection.sh
```

### 2. 設定内容

- **必須ステータスチェック**: すべてのテストが成功する必要があります
- **PR承認数**: 0（dependabot自動マージのため）
- **古いレビューの却下**: 新しいコミット時に自動却下
- **会話解決の強制**: マージ前にコメント解決が必要
- **Force pushの禁止**: 履歴保護のため

### 3. 設定のカスタマイズ

`branch-protection-config.json`を編集して、設定を変更できます：

```json
{
  "required_approving_review_count": {
    "_description": "承認数を変更したい場合",
    "value": 1
  }
}
```

### 4. 手動設定の場合

GitHub Web UIでの設定手順：

1. **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. 以下の設定を有効化：
   - ☑️ Require a pull request before merging
   - ☑️ Require status checks to pass before merging
   - ☑️ Require conversation resolution before merging

## Dependabot自動マージ

### 対象パッケージ

以下の開発パッケージは自動マージされます：

- `@biomejs/*` - コード整形ツール
- `@types/*` - TypeScript型定義
- `@vitest/*` - テストツール
- `vitest` - テストランナー
- `typescript` - TypeScriptコンパイラ

### 自動マージ条件

1. ✅ Dependabotが作成したPR
2. ✅ 開発パッケージのアップデート
3. ✅ すべてのテストが成功
4. ✅ 型チェックが成功
5. ✅ ビルドが成功

### 手動確認が必要なもの

- 本番依存関係（AWS SDK など）
- テスト失敗時
- セキュリティアップデート

## トラブルシューティング

### よくある問題

1. **自動マージが動作しない**
   ```bash
   # リポジトリの設定確認
   gh repo view --json autoMergeAllowed

   # 自動マージを有効化
   gh repo edit --enable-auto-merge
   ```

2. **ステータスチェックエラー**
   ```bash
   # ワークフローの実行状況確認
   gh run list --workflow=test.yml
   ```

3. **権限エラー**
   ```bash
   # GitHub CLIの認証状況確認
   gh auth status
   ```

## 更新履歴

- 2024-01-01: 初期設定作成
- 2024-01-01: Dependabot自動マージ機能追加