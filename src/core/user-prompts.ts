import { input, search } from "@inquirer/prompts";
import { formatInferenceResult, type InferenceResult } from "../inference.js";
import {
  searchClusters,
  searchRDS,
  searchRegions,
  searchTasks,
} from "../search.js";
import type { AWSRegion, ECSCluster, ECSTask, RDSInstance } from "../types.js";
import { messages } from "../utils/index.js";

/**
 * Prompt user to select an AWS region
 */
export async function promptForRegion(regions: AWSRegion[]): Promise<string> {
  // Select AWS region with zoxide-style real-time search
  messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

  return await search({
    message: "🌍 Search and select AWS region:",
    source: async (input) => {
      return await searchRegions(regions, input || "");
    },
    pageSize: 50,
  });
}

/**
 * Prompt user to select an ECS cluster
 */
export async function promptForCluster(
  clusters: ECSCluster[],
): Promise<ECSCluster> {
  // Select ECS cluster with zoxide-style real-time search
  messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

  return (await search({
    message: "🔍 Search and select ECS cluster:",
    source: async (input) => {
      return await searchClusters(clusters, input || "");
    },
    pageSize: 50,
  })) as ECSCluster;
}

/**
 * Prompt user to select an ECS task
 */
export async function promptForTask(tasks: ECSTask[]): Promise<string> {
  // Select ECS task with zoxide-style real-time search
  return (await search({
    message: "🔍 Search and select ECS task:",
    source: async (input) => {
      return await searchTasks(tasks, input || "");
    },
    pageSize: 50,
  })) as string;
}

/**
 * Prompt user to select an RDS instance
 */
export async function promptForRDS(
  rdsInstances: RDSInstance[],
): Promise<RDSInstance> {
  // Select RDS instance with zoxide-style real-time search
  return (await search({
    message: "🔍 Search and select RDS instance:",
    source: async (input) => {
      return await searchRDS(rdsInstances, input || "");
    },
    pageSize: 50,
  })) as RDSInstance;
}

/**
 * Prompt user to select from inference results
 */
export async function promptForInferenceResult(
  inferenceResults: InferenceResult[],
): Promise<InferenceResult> {
  // Add comprehensive hint about filtering functionality
  messages.info("💡 Filter Examples:");
  console.log("   🔍 'prod web' - production web services");
  console.log("   🔍 'staging api' - staging API tasks");
  console.log("   🔍 'high env' - high confidence environment matches");
  console.log("   🔍 'naming 中' - medium confidence naming matches");
  console.log("   🔍 'running' - only running tasks");
  console.log();

  return (await search({
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
            disabled: isUnavailable ? "⚠️ タスク停止中 - 選択不可" : undefined,
          };
        },
      );
    },
    pageSize: 15,
  })) as InferenceResult;
}

/**
 * Prompt user to enter a local port number
 */
export async function promptForLocalPort(): Promise<string> {
  return await input({
    message: "Enter local port number:",
    default: "8888",
    validate: (inputValue: string) => {
      const port = parseInt(inputValue || "8888");
      return port > 0 && port < 65536
        ? true
        : "Please enter a valid port number (1-65535)";
    },
  });
}

/**
 * Filter inference results using space-separated keywords
 * Supports both English and Japanese search terms
 * Searches through cluster name, task name, service name, method, confidence, and reason
 *
 * Examples:
 * - "prod web" - finds tasks in production clusters with web services
 * - "staging api" - finds staging API tasks
 * - "high env" - finds high confidence matches from environment analysis
 * - "名前 中" - finds medium confidence naming matches (Japanese)
 */
function filterInferenceResults(
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
