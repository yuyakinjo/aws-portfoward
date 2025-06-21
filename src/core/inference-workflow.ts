import type { ECSClient } from "@aws-sdk/client-ecs";
import { search } from "@inquirer/prompts";
import {
  formatInferenceResult,
  type InferenceResult,
  inferECSTargets,
} from "../inference/index.js";
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
 * Searches through cluster name, task name, service name, confidence, and reason
 *
 * Examples:
 * - "prod web" - finds tasks in production clusters with web services
 * - "staging api" - finds staging API tasks
 * - "high" - finds high confidence matches
 * - "medium 中" - finds medium confidence matches (Japanese)
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
  const inferenceResults = await inferECSTargets(ecsClient, selectedRDS, false); // パフォーマンス追跡を無効化

  let selectedInference: InferenceResult | undefined;
  let selectedTask: string;
  let selectedCluster: ECSCluster;

  if (inferenceResults.length > 0) {
    // Show simple inference results summary
    messages.success(`Found ${inferenceResults.length} ECS targets`);
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
          `Using CLI specified target: ${formatInferenceResult(matchingResult)}`,
        );
      } else {
        // CLI options don't match inference, show warning and let user choose
        messages.warning(
          `CLI specified cluster/task not found in recommendations. Showing all options:`,
        );
        selectedInference = (await search({
          message:
            "Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
          source: async (input) => {
            return filterInferenceResults(inferenceResults, input || "").map(
              (result) => {
                const isUnavailable = result.reason.includes("接続不可");
                return {
                  name: formatInferenceResult(result),
                  value: result,
                  // Removed description to clean up UI
                  disabled: isUnavailable
                    ? "Task stopped - Cannot select"
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
          "Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
        source: async (input) => {
          return filterInferenceResults(inferenceResults, input || "").map(
            (result) => {
              const isUnavailable = result.reason.includes("接続不可");
              return {
                name: formatInferenceResult(result),
                value: result,
                // Removed description to clean up UI
                disabled: isUnavailable
                  ? "Task stopped - Cannot select"
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
      `Selected: ${formatInferenceResult(selectedInference)}`,
    );
  } else {
    // No inference results, fall back to manual selection
    messages.warning(
      "No specific recommendations found. Manual selection required.",
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
