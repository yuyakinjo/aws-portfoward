import type { InferenceResult } from "../inference/index.js";
import { isTaskArnShape } from "../regex.js";
import {
  searchClusters,
  searchInferenceResults,
  searchRDS,
  searchRegions,
  searchTasks,
} from "../search.js";
import type {
  AWSRegion,
  ECSCluster,
  ECSTask,
  Port,
  RDSInstance,
  RegionName,
  TaskArn,
} from "../types.js";
import { isFailure, parseRegionName, parseTaskArn } from "../types.js";
import { parsePort } from "../types/parsers.js";
import { messages } from "../utils/index.js";
import { askText, pickOne } from "../utils/prompt.js";

// Type guards for search results
function isRegionName(value: unknown): value is RegionName {
  return typeof value === "string";
}

function isECSCluster(value: unknown): value is ECSCluster {
  return (
    typeof value === "object" &&
    value !== null &&
    "clusterName" in value &&
    "clusterArn" in value
  );
}

function isRDSInstance(value: unknown): value is RDSInstance {
  return (
    typeof value === "object" &&
    value !== null &&
    "dbInstanceIdentifier" in value &&
    "endpoint" in value
  );
}

function isInferenceResult(value: unknown): value is InferenceResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "cluster" in value &&
    "task" in value &&
    "confidence" in value
  );
}

export async function promptForRegion(params: {
  regions: AWSRegion[];
  defaultRegion?: string;
}): Promise<RegionName> {
  const { regions, defaultRegion } = params;
  messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

  const selectedValue = await pickOne(
    "Search and select AWS region:",
    await searchRegions(regions, "", defaultRegion),
  );

  if (!isRegionName(selectedValue)) {
    throw new Error("Invalid region selection");
  }

  const parseResult = parseRegionName(selectedValue);
  if (isFailure(parseResult)) {
    throw new Error(`Invalid region name: ${parseResult.error}`);
  }

  return parseResult.data;
}

export async function promptForCluster(params: {
  clusters: ECSCluster[];
}): Promise<ECSCluster> {
  const { clusters } = params;
  messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

  const selectedValue = await pickOne(
    "Search and select ECS cluster:",
    await searchClusters(clusters, ""),
  );

  if (!isECSCluster(selectedValue)) {
    throw new Error("Invalid cluster selection");
  }

  return selectedValue;
}

export async function promptForTask(params: {
  tasks: ECSTask[];
}): Promise<TaskArn> {
  const { tasks } = params;
  const selectedValue = await pickOne(
    "Search and select ECS task:",
    await searchTasks(tasks, ""),
  );

  if (!isTaskArnShape(selectedValue)) {
    throw new Error("Invalid task selection");
  }

  const parseResult = parseTaskArn(selectedValue);
  if (isFailure(parseResult)) {
    throw new Error(`Invalid task ARN: ${parseResult.error}`);
  }

  return parseResult.data;
}

export async function promptForRDS(params: {
  rdsInstances: RDSInstance[];
}): Promise<RDSInstance> {
  const { rdsInstances } = params;
  const selectedValue = await pickOne(
    "Search and select RDS instance:",
    await searchRDS(rdsInstances, ""),
  );

  if (!isRDSInstance(selectedValue)) {
    throw new Error("Invalid RDS instance selection");
  }

  return selectedValue;
}

export async function promptForInferenceResult(params: {
  inferenceResults: InferenceResult[];
}): Promise<InferenceResult> {
  const { inferenceResults } = params;
  const selectedValue = await pickOne(
    "Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
    await searchInferenceResults(inferenceResults, ""),
  );

  if (!isInferenceResult(selectedValue)) {
    throw new Error("Invalid inference result selection");
  }

  return selectedValue;
}

export async function promptForLocalPort(): Promise<Port> {
  const portString = await askText("Enter local port number:", {
    default: "8888",
    validate: (inputValue: string) => {
      const parseResult = parsePort(inputValue || "8888");
      return parseResult.success ? true : `Invalid port: ${parseResult.error}`;
    },
  });

  const parseResult = parsePort(portString);
  if (isFailure(parseResult)) {
    throw new Error(`Failed to parse port: ${parseResult.error}`);
  }

  return parseResult.data;
}
