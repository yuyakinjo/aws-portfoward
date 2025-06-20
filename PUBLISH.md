#### GitHub Actionsによる自動公開

新しいリリースを作成すると自動的に以下が実行されます：

1. **依存関係のインストール**: `npm ci`
2. **型チェック**: `npm run type-check`
3. **コード品質チェック**: `npm run ci`
4. **ビルド**: `npm run build`
5. **npm公開**: `npm publish --access public`

#### リリース手順

新しいバージョンをリリースする場合は、以下の手順に従ってください：

##### 1. バージョンの更新
```bash
# package.jsonのバージョンを更新（例：1.1.2 → 1.1.3）
# または、npmコマンドを使用してバージョンを自動更新
npm version patch  # パッチバージョンを上げる（1.1.2 → 1.1.3）
npm version minor  # マイナーバージョンを上げる（1.1.2 → 1.2.0）
npm version major  # メジャーバージョンを上げる（1.1.2 → 2.0.0）
```

##### 2. 変更をコミット・プッシュ
```bash
# 変更をコミット（npm versionを使った場合は自動でコミットされる）
git add package.json
git commit -m "package: Bump version to 1.1.3"
git push origin main
```

##### 3. GitHubリリースの作成
```bash
# GitHub CLIを使用してリリースを作成
gh release create v1.1.3(current version) --target main --notes-start-tag v1.1.2(previous version) --generate-notes

# または、GitHubの Web UI から Releases → "Create a new release"
# - タグ: v1.1.3 を入力
# - "Generate release notes" をクリック
# - "Publish release" をクリック
```

##### ⚠️ 重要な注意点

- **Rerunは使用しない**: GitHub Actionsでエラーが発生した場合、「Re-run jobs」ではなく新しいリリースを作成してください
- **タグとコミットの一致**: リリースタグが正しいコミット（最新のpackage.json）を指していることを確認してください
- **バージョンの重複回避**: npm.jsで既に公開されているバージョンは再公開できません

##### NPMトークンの設定

初回セットアップ時は、GitHubリポジトリにNPMトークンを設定する必要があります：

1. [npm.js](https://www.npmjs.com)でTypeがAutomationまたはPublishトークンを作成
2. GitHubリポジトリの Settings → Secrets and variables → Actions(gh secret set NPM_TOKEN -b <token>)
3. `NPM_TOKEN` という名前でシークレットを追加