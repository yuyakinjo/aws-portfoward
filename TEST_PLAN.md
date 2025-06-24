# 🧪 AWS Port Forward CLI テスト計画

## 🎯 概要

本CLIツールは4つのコマンド（`connect`, `connect-ui`, `exec-task`, `exec-task-ui`）を提供しており、モックデータを使用したテスト環境を構築することで、実際のAWS環境に依存せずにテスト実行を可能にします。

## 🛠️ CLIコマンド一覧

| コマンド | 機能 | 説明 |
|---------|------|------|
| `connect` | RDS直接接続 | 指定されたオプションでRDSに直接接続 |
| `connect-ui` | RDS UI接続 | ステップバイステップUIでRDS接続 |
| `exec-task` | ECS直接実行 | 指定されたオプションでECSタスクコマンド実行 |
| `exec-task-ui` | ECS UI実行 | ステップバイステップUIでECSタスクコマンド実行 |

## 📋 テスト対象関数カテゴリ

### 1️⃣ AWS サービス連携関数

| ファイル | 関数名 | 機能 | テスト難易度 | 優先度 |
|---------|--------|------|------------|--------|
| `aws-services.ts` | `getECSClusters` | ECSクラスター一覧取得 | ★★☆ | 高 |
| `aws-services.ts` | `getECSTasks` | ECSタスク一覧取得 | ★★☆ | 高 |
| `aws-services.ts` | `getAWSRegions` | リージョン一覧取得 | ★☆☆ | 中 |
| `aws-services.ts` | `getRDSInstances` | RDS一覧取得 | ★★☆ | 高 |
| `aws-services.ts` | `checkECSExecCapability` | Exec機能チェック | ★★★ | 中 |
| `aws-services.ts` | `getECSClustersWithExecCapability` | Exec可能クラスター取得 | ★★★ | 高 |
| `aws-services.ts` | `getECSTasksWithExecCapability` | Exec可能タスク取得 | ★★★ | 高 |
| `aws-services.ts` | `getECSTaskContainers` | タスクコンテナ一覧取得 | ★★☆ | 中 |

### 2️⃣ 推論・スコアリングエンジン

| ファイル | 関数名 | 機能 | テスト難易度 | 優先度 |
|---------|--------|------|------------|--------|
| `inference/cluster-inference.ts` | `inferClustersFromRDSName` | RDS名からクラスター推論 | ★☆☆ | 高 |
| `inference/task-scoring.ts` | `scoreTasksByNaming` | 名前の類似性でスコアリング | ★☆☆ | 高 |
| `inference/task-scoring.ts` | `scoreTasksAgainstRDS` | RDS関連性でスコアリング | ★★☆ | 高 |
| `inference/main-inference.ts` | `inferECSTargets` | 総合推論エンジン | ★★★ | 最高 |
| `core/inference-workflow.ts` | `filterInferenceResults` | 推論結果フィルタリング | ★☆☆ | 中 |

### 3️⃣ 検索・絞り込み機能

| ファイル | 関数名 | 機能 | テスト難易度 | 優先度 |
|---------|--------|------|------------|--------|
| `search.ts` | `universalSearch` | 汎用検索関数 | ★★☆ | 高 |
| `search.ts` | `keywordSearch` | キーワード検索 | ★☆☆ | 中 |
| `search.ts` | `searchRegions` | リージョン検索 | ★☆☆ | 中 |
| `search.ts` | `searchClusters` | クラスター検索 | ★☆☆ | 中 |
| `search.ts` | `searchTasks` | タスク検索 | ★☆☆ | 中 |
| `search.ts` | `searchRDS` | RDS検索 | ★☆☆ | 中 |
| `search.ts` | `searchContainers` | コンテナ検索 | ★☆☆ | 低 |
| `search.ts` | `searchInferenceResults` | 推論結果検索 | ★★☆ | 中 |

### 4️⃣ バリデーション・ユーティリティ

| ファイル | 関数名 | 機能 | テスト難易度 | 優先度 |
|---------|--------|------|------------|--------|
| `utils/validation.ts` | `isPortAvailable` | ポート可用性チェック | ★☆☆ | 中 |
| `utils/validation.ts` | `findAvailablePort` | 利用可能ポート検索 | ★☆☆ | 中 |
| `utils/validation.ts` | `displayValidationErrors` | バリデーションエラー表示 | ★☆☆ | 低 |

### 5️⃣ リソース選択機能

| ファイル | 関数名 | 機能 | テスト難易度 | 優先度 |
|---------|--------|------|------------|--------|
| `core/resource-selection.ts` | `selectRegion` | リージョン選択 | ★★★ | 中 |
| `core/resource-selection.ts` | `selectCluster` | クラスター選択 | ★★★ | 高 |
| `core/resource-selection.ts` | `selectTask` | タスク選択 | ★★★ | 高 |
| `core/resource-selection.ts` | `selectRDSInstance` | RDS選択 | ★★★ | 高 |
| `core/resource-selection.ts` | `getRDSPort` | RDSポート取得 | ★☆☆ | 低 |
| `core/resource-selection.ts` | `getLocalPort` | ローカルポート取得 | ★☆☆ | 低 |

## 🏗️ テスト実装戦略

### フェーズ1: 基盤となるピュア関数のテスト
> **関数型プログラミングアプローチ採用** - 副作用を減らし、テストしやすい設計

#### 1.1 推論・スコアリング系（外部依存なし）
- ✅ `inferClustersFromRDSName` - モックのECSクラスターデータでテスト
- ✅ `scoreTasksByNaming` - モックタスクとRDSデータでテスト
- ✅ `filterInferenceResults` - モック推論結果でフィルタリングテスト

#### 1.2 検索・絞り込み系（ピュア関数）
- ✅ `keywordSearch` - 様々なキーワードでテスト
- ✅ `searchRegions/Clusters/Tasks/RDS` - モックデータで検索性能テスト

#### 1.3 バリデーション系（独立性高い）
- ✅ `isPortAvailable` - テスト用ポートでチェック
- ✅ `findAvailablePort` - ポート範囲指定でテスト

### フェーズ2: AWS SDK モック化テスト

#### 2.1 AWS クライアントのモック化設計
```typescript
// テスト用モックデータ設計例
const mockECSClusters = [
  { clusterName: "prod-web", clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/prod-web" },
  { clusterName: "staging-api", clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/staging-api" },
  { clusterName: "dev-app", clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/dev-app" }
];

const mockRDSInstances = [
  {
    dbInstanceIdentifier: "prod-web-db",
    endpoint: "prod-web-db.cluster-xyz.ap-northeast-1.rds.amazonaws.com",
    port: 3306,
    engine: "mysql"
  },
  {
    dbInstanceIdentifier: "staging-api-postgres",
    endpoint: "staging-api.cluster-abc.ap-northeast-1.rds.amazonaws.com",
    port: 5432,
    engine: "postgres"
  }
];
```

#### 2.2 主要AWS連携関数のテスト
- ✅ `getECSClusters` - モックECSClientでテスト
- ✅ `getRDSInstances` - モックRDSClientでテスト
- ✅ `inferECSTargets` - 統合推論フローテスト

### フェーズ3: CLI 統合テスト

#### 3.1 コマンド引数解析テスト
- ✅ 各CLIコマンドの引数バリデーション
- ✅ エラーハンドリングの確認
- ✅ Valibotスキーマのテスト

#### 3.2 E2E モックテスト
- ✅ AWS SDK完全モック化
- ✅ 全フローの動作確認
- ✅ ユーザーインタラクションのシミュレーション

## 📦 テスト環境セットアップ

### package.json の更新
```json
{
  "scripts": {
    "test": "npm run type-check && npm run build && npm run test:mock",
    "test:mock": "node --experimental-strip-types test/run-tests.ts",
    "test:unit": "node --experimental-strip-types test/unit/**/*.test.ts",
    "test:integration": "node --experimental-strip-types test/integration/**/*.test.ts",
    "test:watch": "npm run test:unit -- --watch"
  }
}
```

### テストディレクトリ構造
```
test/
├── mock-data/                    # モックデータ定義
│   ├── aws-clusters.ts          # ECSクラスターモックデータ
│   ├── aws-rds.ts               # RDSインスタンスモックデータ
│   ├── aws-regions.ts           # AWSリージョンモックデータ
│   ├── aws-tasks.ts             # ECSタスクモックデータ
│   └── index.ts                 # モックデータエクスポート
├── mocks/                       # AWS SDKモック実装
│   ├── ecs-client.mock.ts       # ECSクライアントモック
│   ├── rds-client.mock.ts       # RDSクライアントモック
│   ├── ec2-client.mock.ts       # EC2クライアントモック
│   └── index.ts                 # モッククライアントエクスポート
├── unit/                        # ユニットテスト
│   ├── inference/
│   │   ├── cluster-inference.test.ts
│   │   ├── task-scoring.test.ts
│   │   ├── main-inference.test.ts
│   │   └── inference-workflow.test.ts
│   ├── search/
│   │   ├── universal-search.test.ts
│   │   ├── keyword-search.test.ts
│   │   └── specific-searches.test.ts
│   ├── validation/
│   │   ├── port-validation.test.ts
│   │   └── schema-validation.test.ts
│   └── aws-services/
│       ├── ecs-services.test.ts
│       ├── rds-services.test.ts
│       └── ec2-services.test.ts
├── integration/                 # 統合テスト
│   ├── cli-commands/
│   │   ├── connect.test.ts
│   │   ├── connect-ui.test.ts
│   │   ├── exec-task.test.ts
│   │   └── exec-task-ui.test.ts
│   ├── resource-selection.test.ts
│   └── end-to-end.test.ts
├── helpers/                     # テストヘルパー
│   ├── test-utils.ts
│   ├── assertion-helpers.ts
│   └── mock-helpers.ts
└── run-tests.ts                 # テスト実行スクリプト
```

## 🎯 テストカバレッジ目標

| カテゴリ | 目標カバレッジ | 重点項目 |
|---------|---------------|----------|
| ピュア関数 | 95%+ | 推論・検索・バリデーション |
| AWS連携 | 85%+ | エラーハンドリング・レスポンス処理 |
| CLI統合 | 80%+ | 引数解析・エラー表示 |
| E2E | 70%+ | 主要フロー動作確認 |

## 🚀 実装ロードマップ

### Week 1: 基盤整備
- [ ] モックデータ作成
- [ ] テスト環境セットアップ
- [ ] ピュア関数テスト実装

### Week 2: AWS連携テスト
- [ ] AWS SDKモック実装
- [ ] サービス連携関数テスト
- [ ] 推論エンジン統合テスト

### Week 3: CLI統合テスト
- [ ] コマンド引数テスト
- [ ] E2Eテストシナリオ実装
- [ ] エラーハンドリングテスト

### Week 4: 最適化・完成
- [ ] テストカバレッジ確認
- [ ] パフォーマンステスト
- [ ] ドキュメント整備

## 💡 テスト実行方法

```bash
# 全テスト実行（タイプチェック + ビルド + モックテスト）
npm run test

# ユニットテストのみ
npm run test:unit

# 統合テストのみ
npm run test:integration

# モックテストのみ
npm run test:mock
```

## 📝 注意事項

1. **関数型プログラミングアプローチ採用**: `filter + map`の組み合わせを使用し、ループでのpushパターンを避ける
2. **TypeScript型アサーション**: `!`演算子よりも`|| ""`や`|| []`などのフォールバック値を優先
3. **宣言的なアプローチ**: 副作用を減らし、テストしやすい関数設計を心がける
4. **AWS SDK依存の分離**: モック化しやすい設計で実装する
5. **エラーハンドリング**: 実際のAWSエラーパターンを想定したテストを含める

---

*このテスト計画に基づいて段階的に実装を進めることで、信頼性の高いCLIツールの品質を確保します。*