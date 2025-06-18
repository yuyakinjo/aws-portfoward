# AWS ECS経由RDS接続ツール

AWS ECSコンテナを通してポートフォワーディングし、RDSに接続できるインタラクティブなCLIツールです。

## 機能

- ✅ AWS ECSクラスター、サービス、タスクの自動取得
- ✅ RDSインスタンスの自動取得
- ✅ インタラクティブな設定入力
- ✅ AWS SSM Session Managerを使用したセキュアな接続
- ✅ 自動的なポートフォワーディング設定

## 必要な環境

### 1. AWS CLI
```bash
# AWS CLIのインストール（macOS）
brew install awscli

# AWS CLIの設定
aws configure
```

### 2. Session Manager Plugin
```bash
# Session Manager Pluginのインストール（macOS）
brew install session-manager-plugin
```

### 3. Bun
```bash
# Bunのインストール
curl -fsSL https://bun.sh/install | bash
```

## AWS権限

このツールを使用するには、以下のAWS権限が必要です：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:ListClusters",
        "ecs:ListServices",
        "ecs:ListTasks",
        "ecs:DescribeTasks",
        "rds:DescribeDBInstances",
        "ssm:StartSession"
      ],
      "Resource": "*"
    }
  ]
}
```

## インストール

```bash
# 依存関係のインストール
bun install

# CLIの実行権限を付与
chmod +x src/cli.ts
```

## 使用方法

### 基本的な使用方法

```bash
# 開発環境での実行
bun run dev

# または直接実行
bun src/cli.ts connect
```

### 実行手順

1. **AWSリージョンの選択**
   - 利用可能なリージョンから選択

2. **ECSクラスターの選択**
   - アカウント内のECSクラスターから選択

3. **ECSタスクの選択**
   - 実行中のECSタスクから選択

4. **RDSインスタンスの選択**
   - アカウント内のRDSインスタンスから選択

5. **ローカルポートの指定**
   - ローカルマシンで使用するポート番号を入力（デフォルト: 8888）

6. **接続開始**
   - 自動的にSSMセッションが開始され、ポートフォワーディングが設定されます

## 使用例

```bash
$ bun run dev

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

## ライセンス

MIT License
