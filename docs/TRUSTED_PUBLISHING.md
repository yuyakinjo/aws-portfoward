# 🔐 Trusted Publishing（トークンレス認証）設定ガイド

## 概要

**Trusted Publishing**は、npmとGitHub Actionsを使用した最新のセキュリティ機能です。従来の長期間有効なNPMトークンを使用せず、OpenID Connect (OIDC)を使用した一時的な認証を行います。

## メリット

✅ **セキュリティ向上**: 長期間有効なトークンが不要
✅ **管理不要**: トークンのローテーションや有効期限管理が不要
✅ **漏洩リスク軽減**: トークンがGitHub Secretsに保存されない
✅ **自動化**: GitHub Actionsが自動的に認証を処理

## 前提条件

- npmパッケージの所有者またはメンテナー権限
- GitHub Actionsが有効なリポジトリ
- npm CLIバージョン 9.8.0以上

## 設定手順

### ステップ1: npmでTrusted Publishingを有効化

1. **npmにログイン**

   ```bash
   npm login
   ```

2. **npmのWebサイトでパッケージページにアクセス**
   - https://www.npmjs.com/package/ecs-pf にアクセス
   - "Settings"タブをクリック

3. **Publishingタブを開く**
   - 左メニューの「Publishing」をクリック

4. **GitHub Actionsプロバイダーを追加**
   以下の情報を入力：

   | 項目            | 値                               |
   | --------------- | -------------------------------- |
   | **Provider**    | GitHub Actions                   |
   | **Owner**       | GitHubユーザー名またはOrg名      |
   | **Repository**  | aws-portfoward                   |
   | **Workflow**    | release.yml (または publish.yml) |
   | **Environment** | (オプション) 空欄でOK            |

5. **「Add」をクリックして保存**

### ステップ2: GitHub Actionsワークフローを更新

#### 現在の設定（トークンベース）

```yaml
- name: Publish to npm with Provenance
  run: npm publish --provenance --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} # ⬅️ トークン使用
```

#### Trusted Publishing設定後（トークンレス）

```yaml
permissions:
  id-token: write  # ⬅️ OIDC用の権限（既に設定済み）
  contents: write

- name: Publish to npm with Provenance (Trusted Publishing)
  run: npm publish --provenance --access public
  # ⬅️ NODE_AUTH_TOKENの指定が不要！
```

### ステップ3: NPM_TOKENシークレットを削除（オプション）

Trusted Publishing設定後、`NPM_TOKEN`は不要になります。

1. GitHubリポジトリの「Settings」→「Secrets and variables」→「Actions」
2. `NPM_TOKEN`を削除

**注意**: すぐに削除せず、まずTrusted Publishingが正常に動作することを確認してから削除することをお勧めします。

## テスト方法

### 1. Dry Runでテスト

```yaml
- name: Test Trusted Publishing (Dry Run)
  run: npm publish --dry-run --provenance --access public
```

### 2. 実際のリリースでテスト

1. GitHub Actionsで手動実行
2. ログを確認して、トークンエラーが出ないか確認
3. npmパッケージページで公開を確認

## トラブルシューティング

### エラー: "Unable to authenticate with npm"

**原因**: Trusted Publishingの設定が正しくない

**解決策**:

1. npmのパッケージ設定で、リポジトリ情報が正確か確認
2. ワークフロー名が一致しているか確認
3. `id-token: write`パーミッションがあるか確認

### エラー: "provenance requires --access public"

**原因**: プライベートパッケージではProvenanceが使用できない

**解決策**:

```yaml
run: npm publish --provenance --access public
```

### まだトークンが必要な場合

Trusted Publishingが何らかの理由で使用できない場合は、従来のトークン方式を継続できます。両方の認証方法を同時にサポートすることも可能です。

```yaml
- name: Publish to npm
  run: npm publish --provenance --access public
  env:
    # Trusted Publishingが優先されますが、
    # 失敗した場合のフォールバックとしてトークンも設定可能
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 参考リンク

- [npm Trusted Publishers Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [npm Provenance Blog Post](https://github.blog/2023-04-19-introducing-npm-package-provenance/)

## まとめ

Trusted Publishingを使用することで：

- ✅ トークン管理の手間が不要
- ✅ セキュリティが向上
- ✅ 90日のトークン期限問題を解決

**現在の状態**: ✅ Trusted Publishing設定済み（トークンレス認証を使用中）
**トークン**: NPM_TOKENは不要（削除可能）
