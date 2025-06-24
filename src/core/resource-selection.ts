import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { input, search } from "@inquirer/prompts";
import { isDefined, isEmpty, isString } from "remeda";
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
  ValidatedConnectOptions,
} from "../types.js";
import {
  findAvailablePort,
  getDefaultPortForEngine,
  messages,
} from "../utils/index.js";

export interface ResourceSelectionResult {
  region: string;
  cluster: ECSCluster;
  taskArn: string;
  rdsInstance: RDSInstance;
  rdsPort: string;
  localPort: string;
  ecsClient: ECSClient;
  rdsClient: RDSClient;
}

/**
 * Select AWS region
 */
export async function selectRegion(
  options: ValidatedConnectOptions,
): Promise<string> {
  if (options.region) {
    messages.success(`Region (from CLI): ${options.region}`);
    return options.region;
  }

  // Try to get default region from AWS config
  let defaultRegion: string | undefined;
  try {
    // AWS SDKは自動的に環境変数やconfig fileからリージョンを読み込む
    const testClient = new EC2Client({});
    defaultRegion = await testClient.config.region();
  } catch {
    // AWS configが設定されていない場合はスキップ
    defaultRegion = undefined;
  }

  // Initialize EC2 client with default region to get region list
  const defaultEc2Client = new EC2Client({ region: "us-east-1" });

  messages.warning("Getting available AWS regions...");
  const regions = await getAWSRegions(defaultEc2Client);

  if (isEmpty(regions)) {
    throw new Error("Failed to get AWS regions");
  }

  // デフォルトリージョンがある場合は優先表示
  if (defaultRegion) {
    messages.info(`Default region from AWS config: ${defaultRegion}`);
  }

  // Select AWS region with zoxide-style real-time search
  messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

  const region = await search({
    message: "Search and select AWS region:",
    source: async (input) => {
      return await searchRegions(regions, input || "", defaultRegion);
    },
    pageSize: 50,
  });

  // リージョン選択後の重複メッセージを削除
  // messages.success(`Region: ${region}`);
  return region;
}

/**
 * Select ECS cluster
 */
export async function selectCluster(
  ecsClient: ECSClient,
  options: ValidatedConnectOptions,
): Promise<ECSCluster> {
  if (options.cluster) {
    messages.warning("Getting ECS clusters...");
    const clusters = await getECSClusters(ecsClient);
    const cluster = clusters.find((c) => c.clusterName === options.cluster);
    if (!cluster) {
      throw new Error(`ECS cluster not found: ${options.cluster}`);
    }
    messages.success(`Cluster (from CLI): ${options.cluster}`);
    return cluster;
  }

  messages.warning("Getting ECS clusters with exec capability...");
  const clusters = await getECSClustersWithExecCapability(ecsClient);

  if (clusters.length === 0) {
    throw new Error(
      "No ECS clusters found with exec capability. Please ensure your clusters have ECS exec enabled.",
    );
  }

  // Show count of exec-capable clusters
  messages.info(`Found ${clusters.length} clusters with ECS exec capability`);

  // Clear the loading message
  messages.clearLoadingMessage();

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
 * Select ECS task with appropriate validation
 */
export async function selectTask(
  ecsClient: ECSClient,
  cluster: ECSCluster,
  options: ValidatedConnectOptions,
): Promise<string> {
  if (isDefined(options.task)) {
    return options.task;
  }

  messages.warning("Getting ECS tasks...");
  const tasks = await getECSTasks(ecsClient, cluster);

  if (isEmpty(tasks)) {
    throw new Error("No ECS tasks found in this cluster");
  }

  // Clear the loading message
  messages.clearLoadingMessage();

  // Select ECS task with zoxide-style real-time search
  const result = await search({
    message: "Search and select ECS task:",
    source: async (input) => {
      return await searchTasks(tasks, input || "");
    },
    pageSize: 50,
  });

  if (!isString(result)) {
    throw new Error("Invalid task selection result");
  }

  return result;
}

/**
 * Select RDS instance with appropriate validation
 */
export async function selectRDSInstance(
  rdsClient: RDSClient,
  options: ValidatedConnectOptions,
): Promise<RDSInstance> {
  if (isDefined(options.rds)) {
    const rdsInstances = await getRDSInstances(rdsClient);
    const selectedRDS = rdsInstances.find(
      (rds) => rds.dbInstanceIdentifier === options.rds,
    );

    if (!selectedRDS) {
      throw new Error(
        `RDS instance not found: ${options.rds}. Please check the instance identifier.`,
      );
    }

    return selectedRDS;
  }

  const rdsInstances = await getRDSInstances(rdsClient);

  if (isEmpty(rdsInstances)) {
    throw new Error("No RDS instances found in this region");
  }

  // Clear the loading message
  messages.clearLoadingMessage();

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
 * Get local port (from CLI or automatically find available port starting from 8888)
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
  try {
    const availablePort = await findAvailablePort(8888);
    messages.success(`Local Port (auto-selected): ${availablePort}`);
    return `${availablePort}`;
  } catch {
    // Fallback to asking user if automatic port finding fails
    messages.warning(
      "Could not find available port automatically. Please specify manually:",
    );
    const localPort = await input({
      message: "Enter local port number:",
      default: "8888",
      validate: (inputValue: string) => {
        const port = parseInt(inputValue || "8888");
        return port > 0 && port < 65536
          ? true
          : "Please enter a valid port number (1-65535)";
      },
    });
    return localPort;
  }
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
