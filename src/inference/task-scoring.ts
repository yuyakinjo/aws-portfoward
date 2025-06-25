import type { ECSClient } from "@aws-sdk/client-ecs";
import type { ECSCluster, ECSTask, RDSInstance } from "../types.js";

// 型定義（循環インポートを避けるため直接定義）
interface InferenceResult {
  cluster: ECSCluster;
  task: ECSTask;
  confidence: "high" | "medium" | "low";
  method: "environment" | "naming" | "network";
  score: number;
  reason: string;
}

interface InferenceMatch {
  rds_identifier: string;
  task_family?: string;
  cluster?: string;
  task_arn?: string;
  confidence: "high" | "medium" | "low";
  match_score?: number;
  similarity_score?: number;
  match_reasons?: string[];
  method?: string;
  service?: string;
  task_definition?: string;
  rds_engine?: string;
  match_details?: Record<string, unknown>;
}

/**
 * タスクの環境変数を模擬的にチェックする関数
 * 実際のプロダクションでは、タスク定義のAPIから取得
 */
async function checkTaskEnvironmentVariables(
  _: ECSClient,
  task: ECSTask,
  rdsInstance: RDSInstance,
): Promise<{ hasMatch: boolean; score: number; matchDetails: string[] }> {
  // 実際の実装では、ECS describe-task-definition API を使用して環境変数を取得
  // ここでは模擬的にタスク名とサービス名から推論

  const taskName = task.displayName.toLowerCase();
  const serviceName = task.serviceName.toLowerCase();
  const rdsIdentifier = rdsInstance.dbInstanceIdentifier.toLowerCase();
  const rdsSegments = rdsIdentifier.split("-").filter((s) => s.length > 2);

  // 基本マッチング条件を関数型で定義
  const basicMatches = [
    {
      condition: taskName.includes(rdsIdentifier),
      score: 40,
      detail: "Task name contains RDS identifier",
    },
    {
      condition: serviceName.includes(rdsIdentifier),
      score: 40,
      detail: "Service name contains RDS identifier",
    },
  ];

  // セグメントマッチング条件を関数型で定義
  const segmentMatches = rdsSegments.flatMap((segment) => [
    {
      condition: taskName.includes(segment),
      score: 15,
      detail: `Task name segment match: ${segment}`,
    },
    {
      condition: serviceName.includes(segment),
      score: 15,
      detail: `Service name segment match: ${segment}`,
    },
  ]);

  // 全マッチング条件を組み合わせて処理
  const allMatches = [...basicMatches, ...segmentMatches];
  const positiveMatches = allMatches.filter((match) => match.condition);

  const totalScore = positiveMatches.reduce(
    (sum, match) => sum + match.score,
    0,
  );
  const matchDetails = positiveMatches.map((match) => match.detail);

  return {
    hasMatch: totalScore > 20,
    score: totalScore,
    matchDetails,
  };
}

/**
 * タスクを名前の類似性でスコアリングする関数
 */
export async function scoreTasksByNaming(
  tasks: ECSTask[],
  cluster: ECSCluster,
  rdsInstance: RDSInstance,
): Promise<InferenceResult[]> {
  const rdsName = rdsInstance.dbInstanceIdentifier.toLowerCase();
  const rdsSegments = rdsName.split("-").filter((s) => s.length > 2);

  return tasks.map((task) => {
    const taskName = task.displayName.toLowerCase();
    const serviceName = task.serviceName.toLowerCase();

    // スコア計算ロジックを関数型で処理
    const scoreCalculations = [
      {
        condition: taskName.includes(rdsName),
        score: 35,
        reason: "完全名前一致",
      },
      {
        condition: serviceName.includes(rdsName),
        score: 30,
        reason: "サービス名一致",
      },
    ];

    // 基本スコア計算
    const baseResults = scoreCalculations.filter((calc) => calc.condition);
    const baseScore = baseResults.reduce(
      (total, calc) => total + calc.score,
      0,
    );

    // セグメント一致を関数型で処理
    const segmentResults = rdsSegments
      .flatMap((segment) => [
        {
          condition: taskName.includes(segment),
          score: 20,
          reason: `セグメント一致: ${segment}`,
        },
        {
          condition: serviceName.includes(segment),
          score: 15,
          reason: `サービスセグメント一致: ${segment}`,
        },
      ])
      .filter((calc) => calc.condition);

    const segmentScore = segmentResults.reduce(
      (total, calc) => total + calc.score,
      0,
    );

    // 最終スコアと理由
    const totalScore = 25 + baseScore + segmentScore; // 25はベーススコア
    const confidence =
      totalScore >= 75 ? "high" : totalScore >= 50 ? "medium" : "low";

    return {
      cluster,
      task,
      confidence,
      method: "naming" as const,
      score: totalScore,
      reason: "名前類似性関連",
    };
  });
}

/**
 * タスクをRDSとの関連性でスコアリングする関数
 */
export async function scoreTasksAgainstRDS(
  ecsClient: ECSClient,
  tasks: ECSTask[],
  cluster: ECSCluster,
  rdsInstance: RDSInstance,
  analysisResults: {
    environment: InferenceMatch[];
    naming: InferenceMatch[];
    network: InferenceMatch[];
  },
): Promise<InferenceResult[]> {
  // 各タスクの環境変数チェック結果を並列で取得
  const envCheckPromises = tasks.map(async (task) => {
    const envCheck = await checkTaskEnvironmentVariables(
      ecsClient,
      task,
      rdsInstance,
    );
    return { task, envCheck };
  });

  const envCheckResults = await Promise.all(envCheckPromises);

  // 環境変数マッチの結果を生成
  const envResults = envCheckResults
    .filter(({ envCheck }) => envCheck.hasMatch)
    .map(({ task, envCheck }) => {
      const confidence: "high" | "medium" | "low" =
        envCheck.score >= 80 ? "high" : envCheck.score >= 50 ? "medium" : "low";
      return {
        cluster,
        task,
        confidence,
        method: "environment" as const,
        score: envCheck.score,
        reason: "データベース接続関連",
      };
    });

  // 分析結果からのマッチを生成
  const analysisMatchResults = tasks.flatMap((task) => {
    // 関連する環境マッチを検索
    const relevantMatches = analysisResults.environment.filter(
      (match) =>
        match.rds_identifier === rdsInstance.dbInstanceIdentifier &&
        match.task_family &&
        (task.taskId.includes(match.task_family) ||
          task.serviceName.includes(match.task_family)),
    );

    // 各マッチを結果に変換
    return relevantMatches.map((match) => {
      const score =
        match.confidence === "high"
          ? 95
          : match.confidence === "medium"
            ? 75
            : 45;
      const confidence: "high" | "medium" | "low" = match.confidence;
      return {
        cluster,
        task,
        confidence,
        method: "environment" as const,
        score,
        reason: "データベース接続関連",
      };
    });
  });

  return [...envResults, ...analysisMatchResults];
}
