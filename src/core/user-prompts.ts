import { input, search } from "@inquirer/prompts";
import { isDefined } from "remeda";
import {
  formatInferenceResult,
  type InferenceResult,
} from "../inference/index.js";
import {
  searchClusters,
  searchInferenceResults,
  searchRDS,
  searchRegions,
  searchTasks,
} from "../search.js";
import type { AWSRegion, ECSCluster, ECSTask, RDSInstance } from "../types.js";
import { messages } from "../utils/index.js";

/**
 * Prompt user to select an AWS region
 */
export async function promptForRegion(
  regions: AWSRegion[],
  defaultRegion?: string,
): Promise<string> {
  // Select AWS region with zoxide-style real-time search
  messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

  return await search({
    message: "Search and select AWS region:",
    source: async (input) => {
      return await searchRegions(regions, input || "", defaultRegion);
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

  const result = await search({
    message: "Search and select ECS cluster:",
    source: async (input) => {
      return await searchClusters(clusters, input || "");
    },
    pageSize: 50,
  });

  // Ensure the result is a valid ECS cluster by finding it in the original array
  const selectedCluster = clusters.find(
    (cluster) =>
      cluster.clusterName === result || cluster.clusterArn === result,
  );

  if (!isDefined(selectedCluster)) {
    throw new Error("Selected cluster not found in cluster list");
  }

  return selectedCluster;
}

/**
 * Prompt user to select an ECS task
 */
export async function promptForTask(tasks: ECSTask[]): Promise<string> {
  // Select ECS task with zoxide-style real-time search
  const result = await search({
    message: "Search and select ECS task:",
    source: async (input) => {
      return await searchTasks(tasks, input || "");
    },
    pageSize: 50,
  });

  if (typeof result !== "string") {
    throw new Error("Invalid task selection result");
  }

  return result;
}

/**
 * Prompt user to select an RDS instance
 */
export async function promptForRDS(
  rdsInstances: RDSInstance[],
): Promise<RDSInstance> {
  // Select RDS instance with zoxide-style real-time search
  const result = await search({
    message: "Search and select RDS instance:",
    source: async (input) => {
      return await searchRDS(rdsInstances, input || "");
    },
    pageSize: 50,
  });

  // Ensure the result is a valid RDS instance by finding it in the original array
  const selectedRDS = rdsInstances.find(
    (rds) => rds.dbInstanceIdentifier === result,
  );

  if (!selectedRDS) {
    throw new Error("Selected RDS instance not found in RDS list");
  }

  return selectedRDS;
}

/**
 * Prompt user to select from inference results
 */
export async function promptForInferenceResult(
  inferenceResults: InferenceResult[],
): Promise<InferenceResult> {
  // Filter Examples セクションを削除

  const result = await search({
    message:
      "Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
    source: async (input) => {
      return await searchInferenceResults(inferenceResults, input || "");
    },
    pageSize: 50,
  });

  // Ensure the result is a valid inference result by finding it in the original array
  const selectedResult = inferenceResults.find(
    (inference) => formatInferenceResult(inference) === result,
  );

  if (!selectedResult) {
    throw new Error("Selected inference result not found in results list");
  }

  return selectedResult;
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
