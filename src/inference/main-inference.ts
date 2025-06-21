import type { ECSClient } from "@aws-sdk/client-ecs";
import { getECSClusters, getECSTasks } from "../aws-services.js";
import type { ECSCluster, RDSInstance } from "../types.js";
import { loadAnalysisResults } from "./analysis-loader.js";
import { inferClustersFromRDSName } from "./cluster-inference.js";
import type { InferenceResult } from "./index.js";
import { PerformanceTracker } from "./performance-tracker.js";
import { scoreTasksAgainstRDS, scoreTasksByNaming } from "./task-scoring.js";

/**
 * Infer ECS cluster and task recommendations for a given RDS instance
 */
export async function inferECSTargets(
  ecsClient: ECSClient,
  rdsInstance: RDSInstance,
  enablePerformanceTracking = false,
): Promise<InferenceResult[]> {
  const tracker = new PerformanceTracker();
  const results: InferenceResult[] = [];

  try {
    tracker.startStep("Load analysis results");
    const analysisResults = loadAnalysisResults();
    tracker.endStep();

    tracker.startStep("Get ECS clusters");
    const allClusters = await getECSClusters(ecsClient);
    const clusterMap = new Map(allClusters.map((c) => [c.clusterName, c]));
    tracker.endStep();

    tracker.startStep("RDS name-based cluster inference");
    // Phase 0: Infer likely ECS clusters from RDS name (performance optimization)
    const likelyClusterNames = inferClustersFromRDSName(
      rdsInstance.dbInstanceIdentifier,
      allClusters,
    );
    const likelyClusters = likelyClusterNames
      .map((name: string) => clusterMap.get(name))
      .filter(Boolean) as ECSCluster[];

    // 詳細なクラスター情報表示を削除
    // console.log(
    //   `🎯 RDS "${rdsInstance.dbInstanceIdentifier}" から推論されたクラスター: ${likelyClusterNames.length}個`,
    // );
    tracker.endStep();

    // Phase 1: 推論されたクラスターでタスク検索（最優先）
    tracker.startStep("Search tasks in inferred clusters");
    const primaryClusters = likelyClusters.slice(0, 3); // 上位3つのクラスターのみ

    // 並列でタスクを取得し、スコアリングを実行
    const primaryClusterResults = await Promise.all(
      primaryClusters.map(async (cluster) => {
        try {
          const tasks = await getECSTasks(ecsClient, cluster);
          if (tasks.length > 0) {
            const scored = await scoreTasksAgainstRDS(
              ecsClient,
              tasks,
              cluster,
              rdsInstance,
              analysisResults,
            );
            return scored;
          } else {
            return [];
          }
        } catch {
          return [];
        }
      }),
    );

    // 結果をフラット化
    results.push(...primaryClusterResults.flat());
    tracker.endStep();

    // Phase 2: 不十分な場合のフォールバック検索
    tracker.startStep("Fallback search if needed");
    if (results.length < 3) {
      const remainingClusters = likelyClusters.slice(3, 8); // 次の5個のクラスター

      const fallbackResults = await Promise.all(
        remainingClusters.map(async (cluster) => {
          try {
            const tasks = await getECSTasks(ecsClient, cluster);
            if (tasks.length > 0) {
              const scored = await scoreTasksByNaming(
                tasks,
                cluster,
                rdsInstance,
              );
              return scored;
            } else {
              return [];
            }
          } catch {
            return [];
          }
        }),
      );

      results.push(...fallbackResults.flat());
    }
    tracker.endStep();

    // 有効なタスクと無効なタスクを分離
    const validResults = results.filter((result) => {
      return (
        result.task.taskStatus === "RUNNING" ||
        result.task.taskStatus === "PENDING"
      );
    });

    const invalidResults = results.filter((result) => {
      return (
        result.task.taskStatus !== "RUNNING" &&
        result.task.taskStatus !== "PENDING"
      );
    });

    // 有効な結果を信頼度とスコアでソート
    const sortedValidResults = validResults.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      const confidenceDiff =
        confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      if (confidenceDiff !== 0) return confidenceDiff;
      return b.score - a.score;
    });

    // 無効な結果を最後に追加（disabled状態として）
    const finalResults = [
      ...sortedValidResults,
      ...invalidResults.map((result) => ({
        ...result,
        confidence: "low" as const,
        score: 0,
        reason: `${result.reason} (タスク停止中 - 接続不可)`,
      })),
    ];

    // Debug: 推論結果のサマリーを表示
    if (enablePerformanceTracking) {
      console.log(`\n📊 推論結果サマリー:`);
      console.log(`  - 推論クラスター: ${likelyClusterNames.length}個`);
      console.log(`  - 検索済みタスク: ${results.length}個`);
      console.log(`  - 接続可能: ${validResults.length}個`);
      console.log(`  - 接続不可: ${invalidResults.length}個`);
    }

    return finalResults;
  } catch (error) {
    console.error("Error during ECS target inference:", error);
    throw error;
  } finally {
    if (enablePerformanceTracking) {
      console.log(tracker.getReport());
    }
  }
}

/**
 * Format inference result for display
 */
export function formatInferenceResult(result: InferenceResult): string {
  const confidenceIcon = {
    high: "🎯",
    medium: "⭐",
    low: "🔧",
  }[result.confidence];

  const methodLabel = {
    environment: "環境変数",
    naming: "名前類似性",
    network: "ネットワーク",
  }[result.method];

  return `${confidenceIcon} ${result.cluster.clusterName} → ${result.task.displayName} (${methodLabel}: ${result.score}%)`;
}
