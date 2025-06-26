import { input, search } from "@inquirer/prompts";
import type { InferenceResult } from "../inference/index.js";
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
import { messages, parsePort } from "../utils/index.js";

const DEFAULT_PAGE_SIZE = 50;

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

function isTaskArn(value: unknown): value is TaskArn {
  return typeof value === "string";
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

  const selectedValue = await search({
    message: "Search and select AWS region:",
    source: async (input) => {
      return await searchRegions(regions, input || "", defaultRegion);
    },
    pageSize: DEFAULT_PAGE_SIZE,
  });

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

  const selectedValue = await search({
    message: "Search and select ECS cluster:",
    source: async (input) => {
      return await searchClusters(clusters, input || "");
    },
    pageSize: DEFAULT_PAGE_SIZE,
  });

  if (!isECSCluster(selectedValue)) {
    throw new Error("Invalid cluster selection");
  }

  return selectedValue;
}

export async function promptForTask(params: {
  tasks: ECSTask[];
}): Promise<TaskArn> {
  const { tasks } = params;
  const selectedValue = await search({
    message: "Search and select ECS task:",
    source: async (input) => {
      return await searchTasks(tasks, input || "");
    },
    pageSize: DEFAULT_PAGE_SIZE,
  });

  if (!isTaskArn(selectedValue)) {
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
  const selectedValue = await search({
    message: "Search and select RDS instance:",
    source: async (input) => {
      return await searchRDS(rdsInstances, input || "");
    },
    pageSize: DEFAULT_PAGE_SIZE,
  });

  if (!isRDSInstance(selectedValue)) {
    throw new Error("Invalid RDS instance selection");
  }

  return selectedValue;
}

export async function promptForInferenceResult(params: {
  inferenceResults: InferenceResult[];
}): Promise<InferenceResult> {
  const { inferenceResults } = params;
  const selectedValue = await search({
    message:
      "Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
    source: async (input) => {
      return await searchInferenceResults(inferenceResults, input || "");
    },
    pageSize: DEFAULT_PAGE_SIZE,
  });

  if (!isInferenceResult(selectedValue)) {
    throw new Error("Invalid inference result selection");
  }

  return selectedValue;
}

export async function promptForLocalPort(): Promise<Port> {
  const portString = await input({
    message: "Enter local port number:",
    default: "8888",
    validate: (inputValue: string) => {
      const parseResult = parsePort(inputValue || "8888");
      return parseResult.success
        ? true
        : `Invalid port: ${parseResult.error.map((e) => e.message).join(", ")}`;
    },
  });

  const parseResult = parsePort(portString);
  if (isFailure(parseResult)) {
    throw new Error(
      `Failed to parse port: ${parseResult.error.map((e) => e.message).join(", ")}`,
    );
  }

  return parseResult.data;
}
