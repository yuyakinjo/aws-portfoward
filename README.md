[![CI](https://github.com/yuyakinjo/aws-portfoward/actions/workflows/ci.yml/badge.svg)](https://github.com/yuyakinjo/aws-portfoward/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ecs-pf)](https://www.npmjs.com/package/ecs-pf)

## 使用方法

### 1. インタラクティブモード（従来の方法）

```bash
# 開発環境での実行
npx ecs-pf connect
```

### 2. コマンドライン引数での指定（推奨）

```bash
# すべての値を引数で指定
npx ecs-pf connect --region ap-northeast-1 --cluster production-cluster --task arn:aws:ecs:ap-northeast-1:123456789:task/production-cluster/abcdef123456 --rds production-db --rds-port 5432 --local-port 8888

# 一部のみ指定（残りは対話的に選択）
npx ecs-pf connect --region ap-northeast-1 --cluster production-cluster

# クラスターのみ指定
npx ecs-pf connect --cluster production-cluster
```

### 利用可能なオプション

| オプション | 短縮形 | 説明 | 例 |
|-----------|-------|------|-------|
| `--region` | `-r` | AWSリージョン | `ap-northeast-1` |
| `--cluster` | `-c` | ECSクラスター名 | `production-cluster` |
| `--task` | `-t` | ECSタスクARN | `arn:aws:ecs:...` |
| `--rds` | | RDSインスタンス識別子 | `production-db` |
| `--rds-port` | | RDSポート番号 | `5432` |
| `--local-port` | `-p` | ローカルポート番号 | `8888` |

### ヘルプの表示

```bash
npx ecs-pf connect --help
```

## 使用例

```bash
$ npx ecs-pf connect

🚀 AWS ECS経由RDS接続ツールを開始します...
📋 AWS設定を確認しています...
? AWSリージョンを選択してください: ap-northeast-1
✅ リージョン: ap-northeast-1
🔍 ECSクラスターを取得しています...
? ECSクラスターを選択してください: production-cluster
🔍 ECSタスクを取得しています...
? ECSタスクを選択してください: web-service: 12345678...
🔍 RDSインスタンスを取得しています...
? RDSインスタンスを選択してください: production-db (postgres) - db.example.com:5432
? ローカルポート番号を入力してください: 8888
🚀 ポートフォワーディングセッションを開始します...

実行コマンド:
aws ssm start-session --target ecs:production-cluster_123456789 --parameters {"host":["db.example.com"],"portNumber":["5432"],"localPortNumber":["8888"]} --document-name AWS-StartPortForwardingSessionToRemoteHost

🎯 localhost:8888 でRDS接続が利用可能になります
セッションを終了するには Ctrl+C を押してください
```

## ECS Execの有効化

ECSタスクでSSMセッションを使用するには、ECS Execが有効になっている必要があります：

```bash
# ECS Execの有効化
aws ecs update-service \
  --cluster your-cluster \
  --service your-service \
  --enable-execute-command
```

## データベース接続

ポートフォワーディングが開始されたら、別のターミナルから接続できます：

```bash
# PostgreSQLの場合
psql -h localhost -p 8888 -U username -d database_name

# MySQLの場合
mysql -h localhost -P 8888 -u username -p database_name
```

## トラブルシューティング

### エラー: AWS CLIが見つからない
```bash
# AWS CLIがインストールされているか確認
aws --version

# パスが通っているか確認
which aws
```

### エラー: Session Manager Pluginが見つからない
```bash
# Session Manager Pluginがインストールされているか確認
session-manager-plugin --version
```

### エラー: ECS Execが無効
ECSサービスでECS Execが有効になっているか確認してください。

## 開発者向け情報

### npm配布用パッケージの公開

このツールを npm パッケージとして公開し、`npx ecs-pf` で実行できるようにする手順：

#### 1. ローカルでのテスト
```bash
# 依存関係のインストール
npm install

# Node.js用にビルド
npm run build

# ローカルでテスト実行
node dist/cli.js connect
```

#### 2. npm公開手順（手動）
```bash
# npmアカウントでログイン
npm login

# パッケージを公開
npm publish
```

#### 3. 公開後の使用方法
```bash
# 誰でも以下のコマンドで実行可能
npx ecs-pf connect
```

#### パッケージ設定
- **パッケージ名**: `ecs-pf`
- **実行ファイル**: `dist/cli.js` (Node.js用にビルド済み)
- **対象環境**: Node.js (ESモジュール対応)

## ライセンス

MIT License
