import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { search } from "@inquirer/prompts";
import { isEmpty } from "remeda";
import {
  enableECSExecForService,
  enableECSExecForServices,
  getAllECSServices,
  getAWSRegions,
  getECSClusters,
  getECSServicesWithoutExec,
} from "./aws-services.js";
import { searchRegions, searchServices } from "./search.js";
import type {
  ECSCluster,
  ECSService,
  EnableExecResult,
  ProcessClusterServicesParams,
  ValidatedEnableExecOptions,
} from "./types.js";
import {
  parseClusterArn,
  parseClusterName,
  parseProcessClusterServicesParams,
  parseRegionName,
  unwrapBrandedString,
} from "./types.js";
import { displayFriendlyError, messages } from "./utils/index.js";

// UI Configuration constants
const DEFAULT_PAGE_SIZE = 50;

/**
 * Enable ECS exec for services (direct execution with provided options)
 */
export async function enableECSExec(
  options: ValidatedEnableExecOptions,
): Promise<void> {
  let selectedRegion: string | undefined = options.region;

  // If region is not provided, select interactively
  if (!selectedRegion) {
    const ec2Client = new EC2Client({});
    const regionsResult = await getAWSRegions(ec2Client);

    if (!regionsResult.success) {
      throw new Error(regionsResult.error);
    }

    const selectedRegionValue = await search({
      message: "Select AWS region:",
      source: async (input) =>
        await searchRegions(regionsResult.data, input || ""),
      pageSize: DEFAULT_PAGE_SIZE,
    });

    if (typeof selectedRegionValue !== "string") {
      throw new Error("Invalid region selection");
    }

    selectedRegion = selectedRegionValue;
  }

  const regionResult = parseRegionName(selectedRegion);
  if (!regionResult.success) {
    throw new Error(`Invalid region: ${selectedRegion}`);
  }

  const ecsClient = new ECSClient({
    region: unwrapBrandedString(regionResult.data),
  });

  try {
    if (options.cluster && options.service) {
      // Enable exec for specific service in specific cluster
      await enableExecForSpecificService(ecsClient, options);
    } else if (options.cluster) {
      // Enable exec for all services in specific cluster
      await enableExecForClusterServices(ecsClient, options);
    } else {
      // Interactive mode - let user select cluster and services
      await enableExecInteractive(ecsClient, options);
    }
  } catch (error) {
    displayFriendlyError(error);
    throw error;
  }
}

/**
 * Enable exec for specific service in specific cluster
 */
async function enableExecForSpecificService(
  ecsClient: ECSClient,
  options: ValidatedEnableExecOptions,
): Promise<void> {
  if (!options.cluster || !options.service) {
    throw new Error("Both cluster and service must be specified");
  }

  const clusterName = options.cluster;
  const serviceName = options.service;

  messages.info(
    `Enabling exec for service "${serviceName}" in cluster "${clusterName}"...`,
  );

  if (options.dryRun) {
    messages.info("DRY RUN: Would execute the following AWS command:");
    messages.info(
      `aws ecs update-service --cluster ${clusterName} --service ${serviceName} --enable-execute-command`,
    );
    return;
  }

  const result = await enableECSExecForService(
    ecsClient,
    clusterName,
    serviceName,
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  displayEnableExecResult(result.data);
}

/**
 * Enable exec for all services in specific cluster
 */
async function enableExecForClusterServices(
  ecsClient: ECSClient,
  options: ValidatedEnableExecOptions,
): Promise<void> {
  if (!options.cluster) {
    throw new Error("Cluster must be specified");
  }

  const clusterResult = parseClusterName(options.cluster);
  if (!clusterResult.success) {
    throw new Error(`Invalid cluster name: ${options.cluster}`);
  }

  // Create a proper cluster ARN
  const clusterArnString = `arn:aws:ecs:*:*:cluster/${options.cluster}`;
  const clusterArnResult = parseClusterArn(clusterArnString);
  if (!clusterArnResult.success) {
    throw new Error(`Failed to create cluster ARN: ${clusterArnResult.error}`);
  }

  const cluster: ECSCluster = {
    clusterName: clusterResult.data,
    clusterArn: clusterArnResult.data,
  };

  await processClusterServices({ ecsClient, cluster, options });
}

/**
 * Interactive mode for enabling exec
 */
async function enableExecInteractive(
  ecsClient: ECSClient,
  options: ValidatedEnableExecOptions,
): Promise<void> {
  messages.info("Starting interactive ECS exec enablement...");

  // Step 1: Get all services without exec enabled
  messages.warning("Getting ECS clusters...");

  // First get clusters to show progress
  const clustersResult = await getECSClusters(ecsClient);
  if (!clustersResult.success) {
    throw new Error(clustersResult.error);
  }

  const clusterCount = clustersResult.data.length;
  messages.clearPreviousLine();
  messages.info(`Found ${clusterCount} clusters. Getting services...`);

  // Get all services with progress tracking
  const allServicesResult = await getAllECSServices(ecsClient);
  if (!allServicesResult.success) {
    throw new Error(allServicesResult.error);
  }

  messages.clearPreviousLine();
  messages.info(
    `Found ${allServicesResult.data.length} total services. Filtering exec-disabled services...`,
  );

  // Filter services without exec enabled
  const servicesWithoutExec = allServicesResult.data.filter(
    (service) => !service.enableExecuteCommand,
  );

  // Clear the loading message
  messages.clearPreviousLine();

  if (isEmpty(servicesWithoutExec)) {
    messages.success("All services in all clusters already have exec enabled!");
    return;
  }

  messages.info(
    `Found ${servicesWithoutExec.length} services without exec enabled across all clusters`,
  );

  // Step 2: Select services to enable exec
  const selectedServices = await search({
    message:
      "Select services to enable exec (you can select multiple services):",
    source: async (input) =>
      await searchServices(servicesWithoutExec, input || ""),
    pageSize: DEFAULT_PAGE_SIZE,
  });

  if (
    !selectedServices ||
    typeof selectedServices !== "object" ||
    !("serviceName" in selectedServices)
  ) {
    throw new Error("Invalid service selection");
  }

  const service = selectedServices as ECSService;

  if (options.dryRun) {
    messages.info("DRY RUN: Would enable exec for the following service:");
    messages.info(
      `  aws ecs update-service --cluster ${service.clusterName} --service ${service.serviceName} --enable-execute-command`,
    );
    return;
  }

  // Enable exec for the selected service
  const clusterNameStr = unwrapBrandedString(service.clusterName);
  const serviceNameStr = unwrapBrandedString(service.serviceName);

  if (!clusterNameStr || !serviceNameStr) {
    throw new Error("Invalid cluster or service name");
  }

  const result = await enableECSExecForService(
    ecsClient,
    clusterNameStr,
    serviceNameStr,
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  displayEnableExecResult(result.data);
}

/**
 * Process services in a cluster
 */
async function processClusterServices(
  params: ProcessClusterServicesParams,
): Promise<void> {
  // Parse and validate parameters
  const parseResult = parseProcessClusterServicesParams(params);
  if (!parseResult.success) {
    throw new Error(parseResult.error);
  }

  const { ecsClient, cluster, options } = parseResult.data;
  messages.info(`Processing cluster: ${cluster.clusterName}`);

  const servicesResult = await getECSServicesWithoutExec(ecsClient, cluster);

  if (!servicesResult.success) {
    messages.error(
      `Failed to get services for cluster ${cluster.clusterName}: ${servicesResult.error}`,
    );
    return;
  }

  if (isEmpty(servicesResult.data)) {
    messages.success(
      `  All services in cluster "${cluster.clusterName}" already have exec enabled`,
    );
    return;
  }

  messages.info(
    `  Found ${servicesResult.data.length} services without exec enabled`,
  );

  if (options.dryRun) {
    messages.info("  DRY RUN: Would enable exec for:");
    for (const service of servicesResult.data) {
      messages.info(`    ${service.serviceName}`);
    }
    return;
  }

  const serviceNames = servicesResult.data
    .map((service) => unwrapBrandedString(service.serviceName))
    .filter((name): name is string => name !== undefined);
  const clusterNameStr = unwrapBrandedString(cluster.clusterName);
  if (!clusterNameStr) {
    throw new Error("Invalid cluster name");
  }
  const results = await enableECSExecForServices(
    ecsClient,
    clusterNameStr,
    serviceNames,
  );

  if (!results.success) {
    messages.error(
      `Failed to enable exec for cluster ${cluster.clusterName}: ${results.error}`,
    );
    return;
  }

  displayEnableExecResults(results.data);
}

/**
 * Display single enable exec result
 */
function displayEnableExecResult(result: EnableExecResult): void {
  messages.empty();

  if (result.success) {
    if (result.previousState) {
      messages.info(`Service "${result.serviceName}" already had exec enabled`);
    } else {
      messages.success(
        `Successfully enabled exec for service "${result.serviceName}"`,
      );
    }
  } else {
    messages.error(
      `Failed to enable exec for service "${result.serviceName}": ${result.error}`,
    );
  }

  messages.empty();
}

/**
 * Display multiple enable exec results
 */
function displayEnableExecResults(results: EnableExecResult[]): void {
  messages.empty();
  messages.info("Enable exec results:");
  messages.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let successCount = 0;
  let alreadyEnabledCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if (result.success) {
      if (result.previousState) {
        messages.info(`  ✓ ${result.serviceName} (already enabled)`);
        alreadyEnabledCount++;
      } else {
        messages.success(`  ✓ ${result.serviceName} (enabled)`);
        successCount++;
      }
    } else {
      messages.error(`  ✗ ${result.serviceName} (failed: ${result.error})`);
      failureCount++;
    }
  }

  messages.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  messages.info(
    `Summary: ${successCount} enabled, ${alreadyEnabledCount} already enabled, ${failureCount} failed`,
  );
  messages.empty();
}
