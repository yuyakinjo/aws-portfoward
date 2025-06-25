import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { input, search } from "@inquirer/prompts";
import { isDefined, isEmpty } from "remeda";
import {
  getAWSRegions,
  getECSClusters,
  getECSClustersWithExecCapability,
  getECSTasks,
  getRDSInstances,
} from "../aws-services.js";
import {
  searchClusters,
  searchRDS,
  searchRegions,
  searchTasks,
} from "../search.js";
import type {
  ECSCluster,
  RDSInstance,
  RegionName,
  TaskArn,
  ValidatedConnectOptions,
} from "../types.js";
import { isFailure, parseRegionName, parseTaskArn } from "../types.js";
import {
  findAvailablePortSafe,
  getDefaultPortForEngine,
  messages,
  parsePort,
} from "../utils/index.js";

const DEFAULT_PAGE_SIZE = 50;

// Type guards for search results
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

function isTaskArn(value: unknown): value is string {
  return typeof value === "string";
}

export interface ResourceSelectionResult {
  region: RegionName;
  cluster: ECSCluster;
  taskArn: TaskArn;
  rdsInstance: RDSInstance;
  rdsPort: string;
  localPort: string;
  ecsClient: ECSClient;
  rdsClient: RDSClient;
}

/**
 * Select AWS region with parse-first approach
 */
export async function selectRegion(
  options: ValidatedConnectOptions,
): Promise<RegionName> {
  if (options.region) {
    messages.success(`Region (from CLI): ${options.region}`);
    return options.region;
  }

  // Try to get default region from AWS config
  const defaultRegion: string | undefined = await (async () => {
    try {
      const testClient = new EC2Client({});
      return await testClient.config.region();
    } catch {
      return undefined;
    }
  })();

  // Initialize EC2 client with default region to get region list
  const defaultEc2Client = new EC2Client({ region: "us-east-1" });

  messages.warning("Getting available AWS regions...");
  const regionsResult = await getAWSRegions(defaultEc2Client);

  if (isFailure(regionsResult)) {
    throw new Error(`Failed to get AWS regions: ${regionsResult.error}`);
  }

  const regions = regionsResult.data;
  if (isEmpty(regions)) {
    throw new Error("No AWS regions available");
  }

  if (defaultRegion) {
    messages.info(`Default region from AWS config: ${defaultRegion}`);
  }

  messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

  const selectedValue = await search({
    message: "Search and select AWS region:",
    source: async (input) => {
      return await searchRegions(regions, input || "", defaultRegion);
    },
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // Parse the selected region to ensure type safety
  if (typeof selectedValue !== "string") {
    throw new Error("Invalid region selection");
  }

  const regionParseResult = parseRegionName(selectedValue);
  if (isFailure(regionParseResult)) {
    throw new Error(`Invalid region selected: ${regionParseResult.error}`);
  }

  return regionParseResult.data;
}

/**
 * Select ECS cluster with Result-based error handling
 */
export async function selectCluster(
  ecsClient: ECSClient,
  options: ValidatedConnectOptions,
): Promise<ECSCluster> {
  if (options.cluster) {
    messages.warning("Getting ECS clusters...");
    const clustersResult = await getECSClusters(ecsClient);
    if (isFailure(clustersResult)) {
      throw new Error(`Failed to get ECS clusters: ${clustersResult.error}`);
    }

    const cluster = clustersResult.data.find(
      (c) => c.clusterName === options.cluster,
    );
    if (!cluster) {
      throw new Error(`ECS cluster not found: ${options.cluster}`);
    }
    messages.success(`Cluster (from CLI): ${options.cluster}`);
    return cluster;
  }

  messages.warning("Getting ECS clusters with exec capability...");
  const clustersResult = await getECSClustersWithExecCapability(ecsClient);

  if (isFailure(clustersResult)) {
    throw new Error(`Failed to get ECS clusters: ${clustersResult.error}`);
  }

  const clusters = clustersResult.data;
  if (clusters.length === 0) {
    throw new Error(
      "No ECS clusters found with exec capability. Please ensure your clusters have ECS exec enabled.",
    );
  }

  messages.info(`Found ${clusters.length} clusters with ECS exec capability`);
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

/**
 * Select ECS task with Result-based error handling
 */
export async function selectTask(
  ecsClient: ECSClient,
  cluster: ECSCluster,
  options: ValidatedConnectOptions,
): Promise<TaskArn> {
  if (options.task) {
    messages.success(`Task (from CLI): ${options.task}`);
    const parseResult = parseTaskArn(options.task);
    if (isFailure(parseResult)) {
      throw new Error(`Invalid task ARN from CLI: ${parseResult.error}`);
    }
    return parseResult.data;
  }

  messages.warning("Getting ECS tasks...");
  const tasksResult = await getECSTasks(ecsClient, cluster);

  if (isFailure(tasksResult)) {
    throw new Error(`Failed to get ECS tasks: ${tasksResult.error}`);
  }

  const tasks = tasksResult.data;
  if (tasks.length === 0) {
    throw new Error("No running ECS tasks found");
  }

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

/**
 * Select RDS instance with Result-based error handling
 */
export async function selectRDSInstance(
  rdsClient: RDSClient,
  options: ValidatedConnectOptions,
): Promise<RDSInstance> {
  if (options.rds) {
    messages.warning("Getting RDS instances...");
    const rdsInstancesResult = await getRDSInstances(rdsClient);
    if (isFailure(rdsInstancesResult)) {
      throw new Error(
        `Failed to get RDS instances: ${rdsInstancesResult.error}`,
      );
    }

    const rdsInstance = rdsInstancesResult.data.find(
      (r) => r.dbInstanceIdentifier === options.rds,
    );
    if (!rdsInstance) {
      throw new Error(`RDS instance not found: ${options.rds}`);
    }
    messages.success(`RDS (from CLI): ${options.rds}`);
    return rdsInstance;
  }

  messages.warning("Getting RDS instances...");
  const rdsInstancesResult = await getRDSInstances(rdsClient);

  if (isFailure(rdsInstancesResult)) {
    throw new Error(`Failed to get RDS instances: ${rdsInstancesResult.error}`);
  }

  const rdsInstances = rdsInstancesResult.data;
  if (rdsInstances.length === 0) {
    throw new Error("No RDS instances found");
  }

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

/**
 * Get RDS port (auto-detect or from CLI)
 */
export async function getRDSPort(
  rdsInstance: RDSInstance,
  options: ValidatedConnectOptions,
): Promise<string> {
  if (isDefined(options.rdsPort)) {
    const rdsPort = `${options.rdsPort}`;
    messages.success(`RDS Port (from CLI): ${rdsPort}`);
    return rdsPort;
  }

  // Automatically use the port from RDS instance, fallback to engine default
  const actualRDSPort = rdsInstance.port;
  const fallbackPort = getDefaultPortForEngine(rdsInstance.engine);
  const rdsPort = `${actualRDSPort || fallbackPort}`;
  messages.success(`RDS Port (auto-detected): ${rdsPort}`);
  return rdsPort;
}

/**
 * Get local port with type-safe parsing (from CLI or automatically find available port starting from 8888)
 */
export async function getLocalPort(
  options: ValidatedConnectOptions,
): Promise<string> {
  if (isDefined(options.localPort)) {
    const localPort = `${options.localPort}`;
    messages.success(`Local Port (from CLI): ${localPort}`);
    return localPort;
  }

  // Automatically find available port starting from 8888
  const availablePortResult = await findAvailablePortSafe(8888);
  if (availablePortResult.success) {
    const port = Number(availablePortResult.data);
    messages.success(`Local Port (auto-selected): ${port}`);
    return `${port}`;
  }

  // Fallback to asking user if automatic port finding fails
  messages.warning(
    "Could not find available port automatically. Please specify manually:",
  );
  const localPortInput = await input({
    message: "Enter local port number:",
    default: "8888",
    validate: (inputValue: string) => {
      const parseResult = parsePort(inputValue || "8888");
      return parseResult.success
        ? true
        : `Invalid port: ${parseResult.error.map((e) => e.message).join(", ")}`;
    },
  });
  return localPortInput;
}

/**
 * Complete resource selection workflow
 */
export async function selectAllResources(
  options: ValidatedConnectOptions,
): Promise<ResourceSelectionResult> {
  // Select region
  const region = await selectRegion(options);

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region });
  const rdsClient = new RDSClient({ region });

  // Select resources
  const cluster = await selectCluster(ecsClient, options);
  const taskArn = await selectTask(ecsClient, cluster, options);
  const rdsInstance = await selectRDSInstance(rdsClient, options);
  const rdsPort = await getRDSPort(rdsInstance, options);
  const localPort = await getLocalPort(options);

  return {
    region,
    cluster,
    taskArn,
    rdsInstance,
    rdsPort,
    localPort,
    ecsClient,
    rdsClient,
  };
}
