# AWS Port Forward CLI - コーディング指示

## 基本方針

このプロジェクトは AWS ECS/RDS への安全なポートフォワーディングを提供するTypeScript CLIツールです。以下のコーディング指示に従ってください。

## Parse, Don't Validate（バリデーションせずパースせよ）

**最も重要な原則**: バリデーションではなくパースを行うことで、型安全性を最大化し、ランタイムエラーを防ぐ。

### 具体的な実装指針

1. **valibotを使用したパース優先アプローチ**
  - 入力データは必ずvalibotスキーマでパースし、型安全な構造体に変換する
  - `boolean` バリデーションではなく、`parse()` や `safeParse()` を使用して適切な型に変換する
  - パース後の型情報を活用して、後続の処理で再チェックを不要にする

2. **不正な状態を表現できないデータ構造を設計**
  - Unionタイプやbranded typesを活用して、コンパイル時に不正な状態を排除
  - `string` ではなく具体的な型（例: `TaskArn`, `ClusterName`）を定義
  - Optional型とNon-null型を明確に区別する

3. **エラーハンドリング戦略**
  - パースエラーは境界（CLI入力、API応答など）で処理
  - 内部関数では型安全な値のみを受け取り、部分関数を避ける
  - `Result<T, E>` パターンやOption型を活用

### 例
```typescript
// 悪い例（バリデーション）
function validatePort(port: string): void {
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Invalid port');
  }
}

// 良い例（パース）
const PortSchema = pipe(
  string(),
  transform((val) => Number(val)),
  integer(),
  minValue(1),
  maxValue(65535)
);
type Port = InferOutput<typeof PortSchema>;

function parsePort(input: string): Result<Port, ValidationError> {
  return safeParse(PortSchema, input);
}
```

## TypeScript設定

- `strict: true` を維持し、型安全性を最大限活用
- `noUncheckedIndexedAccess: true` で配列アクセスの安全性を確保
- 戻り値の型は明示的に記述（推論に依存しない）

## エラーハンドリング

- プロジェクトの `messages` ユーティリティを使用してユーザーフレンドリーなエラー表示
- AWS SDK エラーは適切にラップして、ユーザーが理解できる形に変換
- 非同期処理ではPromise拒否を適切に処理

## コードスタイル

- Biomeを使用してフォーマット・リントを統一
- 関数は小さく、単一責任の原則に従う
- AWS リソース操作は `aws-services.ts` に集約
- 型定義は `types.ts` に集約し、スキーマと型を一元管理
- 150行以内の関数を推奨し、可読性を重視。もし長くなる場合は責務を分割

## テスト

- Vitestを使用した単体テスト・統合テストの実装
- モック（`test/mocks/`）を活用したAWS APIのテスト
- パースロジックは必ずテストケースを作成

## AWS 関連

- このプロジェクトではAWS SDK v3を使用
- ECS, RDS, SSMサービスとの連携が主要機能
- IAM権限エラーは分かりやすいメッセージで案内

## パフォーマンス

- AWS API呼び出しは最小限に抑制
- キャッシュ可能なデータ（クラスター情報など）は適切にキャッシュ
- 推論ワークフロー（`inference/`）でのスコアリング最適化を考慮
