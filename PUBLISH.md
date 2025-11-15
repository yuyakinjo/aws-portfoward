#### GitHub Actionsによる自動公開

新しいリリースを作成すると自動的に以下が実行されます：

1. **依存関係のインストール**: `npm ci`
2. **型チェック**: `npm run type-check`
3. **コード品質チェック**: `npm run ci`
4. **ビルド**: `npm run build`
5. **CHANGELOG更新**: `npm run changelog:update`
6. **npm公開**: `npm publish --provenance --access public` （🆕 Provenance付き）

#### リリース手順

新しいバージョンをリリースする場合は、以下の手順に従ってください：

##### 推奨: GitHub Actionsで手動実行（自動化）

1. **GitHubのActionsタブにアクセス**
   - リポジトリページの「Actions」タブをクリック

2. **Release Packageワークフローを選択**
   - 左サイドバーから「Release Package」を選択
   - 「Run workflow」ボタンをクリック

3. **バージョンタイプを選択**
   - `patch`: バグ修正（1.1.2 → 1.1.3）
   - `minor`: 新機能（1.1.2 → 1.2.0）
   - `major`: 破壊的変更（1.1.2 → 2.0.0）

4. **「Run workflow」を実行**
   - 自動的に以下が実行されます：
     - ✅ バージョンアップ
     - ✅ ビルド
     - ✅ テスト
     - ✅ CHANGELOG更新
     - ✅ GitHubリリース作成
     - ✅ npm公開（Provenance付き）

##### 代替: 手動でリリース作成

手動でリリースを作成した場合も、GitHubリリース作成時に自動的にnpmに公開されます。

##### 1. バージョンの更新

```bash
# package.jsonのバージョンを更新（例：1.1.2 → 1.1.3）
# または、npmコマンドを使用してバージョンを自動更新
npm version patch  # パッチバージョンを上げる（1.1.2 → 1.1.3）
npm version minor  # マイナーバージョンを上げる（1.1.2 → 1.2.0）
npm version major  # メジャーバージョンを上げる（1.1.2 → 2.0.0）
```

##### 2. 変更をプッシュ

```bash
git push origin main
git push origin --tags
```

##### 3. GitHubリリースの作成

```bash
# GitHub CLIを使用
gh release create v1.1.3 --target main --notes-start-tag v1.1.2 --generate-notes

# または、GitHubの Web UIから
# Releases → "Create a new release" → タグを選択 → "Generate release notes" → "Publish release"
```

##### CHANGELOG管理

このプロジェクトでは**CHANGELOG.md**が自動管理されています：

- **自動更新**: リリース時にGitHub Actionsが自動でCHANGELOG.mdを更新
- **手動更新**: `npm run changelog:update` でいつでも手動更新可能
- **初期化**: `npm run changelog:init` で初回のCHANGELOG.mdを作成

CHANGELOGは[Conventional Commits](https://www.conventionalcommits.org/)形式のコミットメッセージから自動生成されます。

##### ⚠️ 重要な注意点

- **Rerunは使用しない**: GitHub Actionsでエラーが発生した場合、「Re-run jobs」ではなく新しいリリースを作成してください
- **タグとコミットの一致**: リリースタグが正しいコミット（最新のpackage.json）を指していることを確認してください
- **バージョンの重複回避**: npm.jsで既に公開されているバージョンは再公開できません

##### NPMトークンの設定

~~初回セットアップ時は、GitHubリポジトリにNPMトークンを設定する必要があります：~~

~~1. [npm.js](https://www.npmjs.com)でTypeがAutomationまたはPublishトークンを作成~~
~~2. GitHubリポジトリの Settings → Secrets and variables → Actions(gh secret set NPM_TOKEN -b <token>)~~
~~3. `NPM_TOKEN` という名前でシークレットを追加~~

**✅ Trusted Publishing設定済み（トークンレス認証）**

このプロジェクトでは、OpenID Connectを使用したTrusted Publishingを採用しています。
NPMトークンの管理は不要です。詳細は [`docs/TRUSTED_PUBLISHING.md`](docs/TRUSTED_PUBLISHING.md) を参照してください。

Trusted Publishingのメリット：

- ✅ トークン管理が不要
- ✅ トークン漏洩リスクがゼロ
- ✅ 90日の有効期限問題を解決
- ✅ セキュリティが大幅に向上
