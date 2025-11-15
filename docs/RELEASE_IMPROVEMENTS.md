# 🎉 リリースワークフローの改善（2025年版）

## 実施した変更

### ✅ 1. npm Provenanceの追加

**変更内容:**
- `.github/workflows/publish.yml`
- `.github/workflows/release.yml`

```yaml
# Before
- run: npm publish --access public

# After
- run: npm publish --provenance --access public
```

**効果:**
- ✅ パッケージの出所を証明
- ✅ サプライチェーンセキュリティの向上
- ✅ npmパッケージページにProvenanceバッジが表示される

### ✅ 2. 権限設定の確認

両方のワークフローで既に設定済み：

```yaml
permissions:
  contents: write  # git push とリリース作成
  id-token: write  # npm Provenance用
```

### ✅ 3. 手動実行のみに変更

**変更内容:** `.github/workflows/release.yml`

```yaml
# Before: mainブランチへのpush時も実行
on:
  push:
    branches:
      - main
  workflow_dispatch:

# After: 手動実行のみ
on:
  workflow_dispatch:
```

**理由:**
- 意図しないリリースを防止
- リリースタイミングを完全にコントロール
- より安全なリリースプロセス

## リリース方法の選択肢

### 🚀 方法1: GitHub Actions手動実行（推奨）

**手順:**
1. GitHubの「Actions」タブ
2. 「Release Package」を選択
3. 「Run workflow」→ バージョンタイプを選択
4. 実行

**メリット:**
- ワンクリックで完全自動化
- バージョンアップからnpm公開まで一貫処理
- CHANGELOG自動生成
- エラー時の対応が容易

### 📝 方法2: 手動リリース作成

**手順:**
1. `npm version patch/minor/major`
2. `git push --tags`
3. GitHubでリリースを作成
4. 自動的にnpm公開

**メリット:**
- ローカルで柔軟な変更が可能
- リリース前の最終確認

## Trusted Publishing（次のステップ）

現在は従来のトークン方式を使用していますが、将来的に以下への移行を推奨：

### 現在の状態

```yaml
- run: npm publish --provenance --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}  # トークン必要
```

### Trusted Publishing設定後

```yaml
- run: npm publish --provenance --access public
  # トークン不要！OIDCで自動認証
```

**設定方法:** [`TRUSTED_PUBLISHING.md`](TRUSTED_PUBLISHING.md) を参照

**メリット:**
- ✅ NPM_TOKENの管理不要
- ✅ トークン漏洩リスクゼロ
- ✅ 90日の有効期限問題を解決

## セキュリティの向上

### Before（従来）
- トークンベース認証のみ
- Provenance無し
- 自動実行によるリスク

### After（現在）
- ✅ Provenance付きで出所証明
- ✅ 手動実行で意図しないリリース防止
- ✅ OIDC準備完了（id-token: write設定済み）

### Future（将来）
- Trusted Publishingでトークンレス認証
- さらなるセキュリティ強化

## ドキュメント更新

以下のドキュメントを更新：

1. **PUBLISH.md**
   - 推奨リリース方法の明記
   - Trusted Publishingへの言及
   - 手動実行手順の追加

2. **docs/TRUSTED_PUBLISHING.md**（新規作成）
   - Trusted Publishingの詳細説明
   - 設定手順
   - トラブルシューティング

3. **docs/RELEASE_IMPROVEMENTS.md**（このファイル）
   - 変更内容のまとめ
   - リリース方法の比較

## 次にやるべきこと

### 優先度：高
- [ ] 次回リリースでProvenanceが正常に動作することを確認
- [ ] npmパッケージページでProvenanceバッジを確認

### 優先度：中
- [ ] Trusted Publishingの設定を検討
- [ ] NPM_TOKENのローテーション（90日以内）

### 優先度：低
- [ ] プレリリース機能の追加
- [ ] Slackなどへの通知機能

## トラブルシューティング

### Provenanceエラーが出た場合

```
Error: npm publish --provenance requires permissions
```

**解決策:**
- `id-token: write`パーミッションを確認
- Node.jsバージョンが20.x以上か確認

### Trusted Publishing設定後にエラー

```
Error: Unable to authenticate with npm
```

**解決策:**
1. npmパッケージ設定でリポジトリ情報を確認
2. ワークフロー名が一致しているか確認
3. 一時的に`NODE_AUTH_TOKEN`を戻す

## 参考リソース

- [npm Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**実施日:** 2025年11月15日
**更新者:** GitHub Actions Automation

