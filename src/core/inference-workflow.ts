import type { ECSClient } from "@aws-sdk/client-ecs";
import { search } from "@inquirer/prompts";
import { getECSClusters, getECSTasks } from "../aws-services.js";
import {
  inferECSTargets,
  formatInferenceResult,
  type InferenceResult,
} from "../inference/index.js";
import { searchClusters, searchTasks } from "../search.js";
import type {
  ECSCluster,
  RDSInstance,
  ValidatedConnectOptions,
} from "../types.js";
import { messages } from "../utils/index.js";
import { selectCluster, selectTask } from "./resource-selection.js";

export interface InferenceWorkflowResult {
  selectedInference?: InferenceResult;
  selectedTask: string;
  selectedCluster: ECSCluster;
}

/**
 * Filter inference results based on user input
 * Searches through cluster name, task name, service name, method, confidence, and reason
 *
 * Examples:
 * - "prod web" - finds tasks in production clusters with web services
 * - "staging api" - finds staging API tasks
 * - "high env" - finds high confidence matches from environment analysis
 * - "名前 中" - finds medium confidence naming matches (Japanese)
 */
export function filterInferenceResults(
  results: InferenceResult[],
  input: string,
): InferenceResult[] {
  if (!input || input.trim() === "") {
    return results;
  }

  // Split input into keywords and convert to lowercase
  const keywords = input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((keyword) => keyword.length > 0);

  if (keywords.length === 0) {
    return results;
  }

  return results.filter((result) => {
    // Create searchable text combining multiple fields
    const searchableText = [
      result.cluster.clusterName,
      result.task.displayName,
      result.task.serviceName,
      result.task.taskStatus,
      result.task.runtimeId,
      result.confidence,
      result.method,
      result.reason,
      formatInferenceResult(result),
      // Add method labels for easier searching
      result.method === "environment" ? "環境変数 env" : "",
      result.method === "naming" ? "名前類似性 naming" : "",
      result.method === "network" ? "ネットワーク network" : "",
      // Add confidence levels for easier searching
      result.confidence === "high" ? "high 高" : "",
      result.confidence === "medium" ? "medium 中" : "",
      result.confidence === "low" ? "low 低" : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // All keywords must be found in the searchable text
    return keywords.every((keyword) => searchableText.includes(keyword));
  });
}

/**
 * Run inference workflow to select ECS target based on RDS instance
 */
export async function runInferenceWorkflow(
  ecsClient: ECSClient,
  selectedRDS: RDSInstance,
  options: ValidatedConnectOptions,
): Promise<InferenceWorkflowResult> {
  // Step 2: Infer ECS targets based on selected RDS
  messages.warning("🔮 Inferring ECS targets based on RDS selection...");

  const inferenceStartTime = performance.now();
  const inferenceResults = await inferECSTargets(ecsClient, selectedRDS, false); // パフォーマンス追跡を無効化
  const inferenceEndTime = performance.now();
  const inferenceDuration = Math.round(inferenceEndTime - inferenceStartTime);

  let selectedInference: InferenceResult | undefined;
  let selectedTask: string;
  let selectedCluster: ECSCluster;

  if (inferenceResults.length > 0) {
    // Show simple inference results summary
    messages.success(
      `✨ Found ${inferenceResults.length} ECS targets in ${inferenceDuration}ms`,
    );
    console.log();

    // Show brief summary of inference results
    const highConfidenceResults = inferenceResults.filter(
      (r) => r.confidence === "high",
    );
    const mediumConfidenceResults = inferenceResults.filter(
      (r) => r.confidence === "medium",
    );
    const lowConfidenceResults = inferenceResults.filter(
      (r) => r.confidence === "low",
    );

    // Show simple summary
    const validLowCount = lowConfidenceResults.filter(
      (r) => !r.reason.includes("接続不可"),
    ).length;
    const invalidLowCount = lowConfidenceResults.filter((r) =>
      r.reason.includes("接続不可"),
    ).length;

    console.log(`📊 Found ${inferenceResults.length} ECS targets:`);
    if (highConfidenceResults.length > 0) {
      console.log(`   🎯 High confidence: ${highConfidenceResults.length}個`);
    }
    if (mediumConfidenceResults.length > 0) {
      console.log(
        `   ⭐ Medium confidence: ${mediumConfidenceResults.length}個`,
      );
    }
    if (validLowCount > 0) {
      console.log(
        `   🔧 Low confidence: ${validLowCount}個${invalidLowCount > 0 ? ` (${invalidLowCount}個停止中)` : ""}`,
      );
    }

    // Show recommendation
    const recommendedResult = inferenceResults[0];
    if (recommendedResult) {
      console.log(
        `🎯 \x1b[1m\x1b[36mRecommended\x1b[0m: ${recommendedResult.cluster.clusterName} → ${recommendedResult.task.displayName} (${recommendedResult.confidence} confidence)`,
      );
    }
    console.log();

    // Add comprehensive hint about filtering functionality
    messages.info("💡 Filter Examples:");
    console.log("   🔍 'prod web' - production web services");
    console.log("   🔍 'staging api' - staging API tasks");
    console.log("   🔍 'high env' - high confidence environment matches");
    console.log("   🔍 'naming 中' - medium confidence naming matches");
    console.log("   🔍 'running' - only running tasks");
    console.log();

    if (options.cluster && options.task) {
      // Try to find matching inference result
      const matchingResult = inferenceResults.find(
        (result) =>
          result.cluster.clusterName === options.cluster &&
          result.task.taskId === options.task,
      );

      if (matchingResult) {
        selectedInference = matchingResult;
        selectedTask = matchingResult.task.taskArn;
        selectedCluster = matchingResult.cluster;
        messages.success(
          `✅ Using CLI specified target: ${formatInferenceResult(matchingResult)}`,
        );
      } else {
        // CLI options don't match inference, show warning and let user choose
        messages.warning(
          `⚠️ CLI specified cluster/task not found in recommendations. Showing all options:`,
        );
        selectedInference = (await search({
          message:
            "🎯 Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
          source: async (input) => {
            return filterInferenceResults(inferenceResults, input || "").map(
              (result) => {
                const isUnavailable = result.reason.includes("接続不可");
                return {
                  name: formatInferenceResult(result),
                  value: result,
                  description: result.reason,
                  disabled: isUnavailable
                    ? "⚠️ タスク停止中 - 選択不可"
                    : undefined,
                };
              },
            );
          },
          pageSize: 15,
        })) as InferenceResult;
        selectedTask = selectedInference.task.taskArn;
        selectedCluster = selectedInference.cluster;
      }
    } else {
      // Let user choose from recommendations
      selectedInference = (await search({
        message:
          "🎯 Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
        source: async (input) => {
          return filterInferenceResults(inferenceResults, input || "").map(
            (result) => {
              const isUnavailable = result.reason.includes("接続不可");
              return {
                name: formatInferenceResult(result),
                value: result,
                description: result.reason,
                disabled: isUnavailable
                  ? "⚠️ タスク停止中 - 選択不可"
                  : undefined,
              };
            },
          );
        },
        pageSize: 15,
      })) as InferenceResult;
      selectedTask = selectedInference.task.taskArn;
      selectedCluster = selectedInference.cluster;
    }

    messages.success(
      `✅ Selected: ${formatInferenceResult(selectedInference)}`,
    );
    messages.info(`📝 Reason: ${selectedInference.reason}`);
  } else {
    // No inference results, fall back to manual selection
    messages.warning(
      "⚠️ No specific recommendations found. Manual selection required.",
    );

    // Get ECS cluster manually
    selectedCluster = await selectCluster(ecsClient, options);
    selectedTask = await selectTask(ecsClient, selectedCluster, options);
  }

  return {
    selectedInference,
    selectedTask,
    selectedCluster,
  };
}
