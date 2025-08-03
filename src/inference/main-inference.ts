import type { ECSClient } from "@aws-sdk/client-ecs";
import { isDefined } from "remeda";
import {
  getECSClustersWithExecCapability,
  getECSTasksWithExecCapability,
} from "../aws-services.js";
import type { ECSCluster, RDSInstance } from "../types.js";
import { parseClusterName } from "../types.js";
import { messages } from "../utils/messages.js";
import { inferClustersFromRDSName } from "./cluster-inference.js";
import type { InferenceResult } from "./index.js";
import { PerformanceTracker } from "./performance-tracker.js";
import { scoreTasksAgainstRDS, scoreTasksByNaming } from "./task-scoring.js";

interface InferECSTargetsParams {
  ecsClient: ECSClient;
  selectedRDS: RDSInstance;
  enablePerformanceTracking?: boolean;
  enableNetworkAnalysis?: boolean;
}

/**
 * Infer ECS cluster and task recommendations for a given RDS instance
 */
export async function inferECSTargets(
  params: InferECSTargetsParams,
): Promise<InferenceResult[]> {
  const {
    ecsClient,
    selectedRDS: rdsInstance,
    enablePerformanceTracking = false,
  } = params;
  const tracker = new PerformanceTracker();
  const results: InferenceResult[] = [];

  try {
    tracker.startStep("Load analysis results");
    const analysisResults = {
      environment: [],
      naming: [],
      network: [],
    };
    tracker.endStep();

    tracker.startStep("Get ECS clusters with exec capability");
    const clustersResult = await getECSClustersWithExecCapability(ecsClient);
    if (!clustersResult.success) throw new Error(clustersResult.error);
    const allClusters = clustersResult.data;
    const clusterMap = new Map(allClusters.map((c) => [c.clusterName, c]));
    tracker.endStep();

    tracker.startStep("RDS name-based cluster inference");
    // Phase 0: Infer likely ECS clusters from RDS name (performance optimization)
    const likelyClusterNames = inferClustersFromRDSName({
      rdsName: rdsInstance.dbInstanceIdentifier,
      allClusters,
    });
    // likelyClusterNamesはstring[]の可能性があるのでparseしてbranded typesに
    const likelyClusters = likelyClusterNames
      .map((name) => {
        const clusterNameResult = parseClusterName(name);
        if (!clusterNameResult.success) return undefined;
        return clusterMap.get(clusterNameResult.data);
      })
      .filter((cluster): cluster is ECSCluster => isDefined(cluster));
    tracker.endStep();

    // Phase 1: 推論されたクラスターでタスク検索（高スコア順）
    tracker.startStep("Search tasks in high-scoring clusters");
    const highScoreClusters = likelyClusters.slice(0, 4); // 上位4つのクラスターは詳細スコアリング

    // 並列でタスクを取得し、詳細スコアリングを実行
    const highScoreResults = await Promise.all(
      highScoreClusters.map(async (cluster) => {
        try {
          const tasksResult = await getECSTasksWithExecCapability(
            ecsClient,
            cluster,
          );
          if (!tasksResult.success) return [];
          const tasks = tasksResult.data;
          if (tasks.length > 0) {
            const scored = await scoreTasksAgainstRDS({
              ecsClient,
              tasks,
              cluster,
              rdsInstance,
              analysisResults,
            });
            return scored.map((result) => ({
              ...result,
              reasons: [result.reason],
            }));
          } else {
            return [];
          }
        } catch {
          return [];
        }
      }),
    );

    // 結果をフラット化
    results.push(...highScoreResults.flat());
    tracker.endStep();

    // Phase 2: 残りのクラスターもすべて検索（簡易スコアリング）
    tracker.startStep("Search tasks in remaining clusters");
    const remainingInferredClusters = likelyClusters.slice(4); // 推論された残りのクラスター
    const nonInferredClusters = allClusters.filter(
      (cluster) => !likelyClusterNames.includes(cluster.clusterName),
    ); // 推論されなかったクラスター

    // すべての残りのクラスターを並列で検索
    const remainingResults = await Promise.all(
      [...remainingInferredClusters, ...nonInferredClusters].map(async (cluster) => {
        try {
          const tasksResult = await getECSTasksWithExecCapability(
            ecsClient,
            cluster,
          );
          if (!tasksResult.success) return [];
          const tasks = tasksResult.data;
          if (tasks.length > 0) {
            const scored = await scoreTasksByNaming({
              tasks,
              cluster,
              rdsInstance,
            });
            return scored.map((result) => ({
              ...result,
              confidence: "low" as const, // 推論外のクラスターは低信頼度
              reasons: [result.reason],
            }));
          } else {
            return [];
          }
        } catch {
          return [];
        }
      }),
    );

    results.push(...remainingResults.flat());
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

    if (enablePerformanceTracking) {
      messages.debug(`推論結果サマリー:`);
      messages.debug(`  - 総クラスター数: ${allClusters.length}個`);
      messages.debug(`  - 高スコアクラスター: ${highScoreClusters.length}個`);
      messages.debug(`  - 推論クラスター: ${likelyClusterNames.length}個`);
      messages.debug(`  - 検索済みクラスター: ${allClusters.length}個`);
      messages.debug(`  - 検索済みタスク: ${results.length}個`);
      messages.debug(`  - 接続可能: ${validResults.length}個`);
      messages.debug(`  - 接続不可: ${invalidResults.length}個`);
    }

    return finalResults;
  } catch (error) {
    messages.error(`Error during ECS target inference: ${String(error)}`);
    throw error;
  } finally {
    if (enablePerformanceTracking) {
      messages.debug(tracker.getReport());
    }
  }
}

/**
 * Format inference result for display
 */
export function formatInferenceResult(result: InferenceResult): string {
  return result.task.serviceName;
}
