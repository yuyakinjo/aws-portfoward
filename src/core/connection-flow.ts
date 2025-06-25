import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { isDefined } from "remeda";
import { startSSMSession } from "../session.js";
import type {
  Port,
  ValidatedConnectOptions,
} from "../types.js";
import {
  isFailure,
  parsePortNumber,
  parseTaskId,
} from "../types.js";
import {
  askRetry,
  displayFriendlyError,
  getDefaultPortForEngine,
  messages,
} from "../utils/index.js";
import { generateReproducibleCommand } from "./command-generation.js";
import { displayDryRunResult, generateConnectDryRun } from "./dry-run.js";
import {
  selectCluster,
  selectRDSInstance,
  selectRegion,
  selectTask,
} from "./resource-selection.js";
import { promptForLocalPort } from "./user-prompts.js";

/**
 * Main entry point for RDS connection workflow (manual selection)
 */
export async function connectToRDS(
  options: ValidatedConnectOptions = { dryRun: false },
): Promise<void> {
  // Check if dry run mode is enabled
  if (options.dryRun) {
    await connectToRDSDryRun(options);
    return;
  }

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      await connectToRDSInternal(options);
      return; // Exit if successful
    } catch (error) {
      retryCount++;

      displayFriendlyError(error);

      if (retryCount <= maxRetries) {
        messages.warning(`Retry count: ${retryCount}/${maxRetries + 1}`);
        const shouldRetry = await askRetry();

        if (!shouldRetry) {
          messages.info("Process interrupted");
          return;
        }

        messages.info("Retrying...\n");
      } else {
        messages.error("Maximum retry count reached. Terminating process.");
        messages.gray(
          "If the problem persists, please check the above solutions.",
        );
        throw error;
      }
    }
  }
}

/**
 * Dry run version of RDS connection workflow
 */
export async function connectToRDSDryRun(
  options: ValidatedConnectOptions,
): Promise<void> {
  messages.info("Starting AWS ECS RDS connection tool (DRY RUN)...");

  // Get region
  const region = await selectRegion(options);

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region });
  const rdsClient = new RDSClient({ region });

  // Get ECS cluster
  const selectedCluster = await selectCluster(ecsClient, options);
  messages.success(`Cluster: ${selectedCluster.clusterName}`);

  // Get ECS task
  const selectedTaskArn = await selectTask(ecsClient, selectedCluster, options);
  messages.success(`Task: ${String(selectedTaskArn)}`);

  // Get RDS instance
  messages.warning("Getting RDS instances...");
  const selectedRDS = await selectRDSInstance(rdsClient, options);
  messages.success(`RDS: ${selectedRDS.dbInstanceIdentifier}`);

  // Extract TaskId from TaskArn for dry run
  const taskIdStr =
    String(selectedTaskArn).split("_")[1] || String(selectedTaskArn);
  const taskIdResult = parseTaskId(taskIdStr);
  if (isFailure(taskIdResult)) {
    throw new Error(`Invalid task ID: ${taskIdResult.error}`);
  }
  const taskId = taskIdResult.data;

  // Use RDS port automatically with type safety
  const rdsPort: Port = isDefined(options.rdsPort)
    ? (() => {
        messages.success(`RDS Port (from CLI): ${Number(options.rdsPort)}`);
        return options.rdsPort;
      })()
    : (() => {
        // Automatically use the port from RDS instance, fallback to engine default
        const actualRDSPort = selectedRDS.port;
        const fallbackPortNumber = getDefaultPortForEngine(selectedRDS.engine);
        const portToUse = actualRDSPort
          ? Number(actualRDSPort)
          : fallbackPortNumber;
        const portResult = parsePortNumber(portToUse);
        if (isFailure(portResult)) {
          throw new Error(`Invalid RDS port: ${portResult.error}`);
        }
        messages.success(
          `RDS Port (auto-detected): ${Number(portResult.data)}`,
        );
        return portResult.data;
      })();

  // Specify local port with type safety
  const localPort: Port = isDefined(options.localPort)
    ? (() => {
        messages.success(`Local Port (from CLI): ${Number(options.localPort)}`);
        return options.localPort;
      })()
    : await promptForLocalPort();

  // Generate and display dry run result
  const dryRunResult = generateConnectDryRun(
    region,
    selectedCluster.clusterName,
    taskId,
    selectedRDS,
    rdsPort,
    localPort,
  );

  displayDryRunResult(dryRunResult);
  messages.success("Dry run completed successfully.");
}

/**
 * Internal implementation for RDS connection workflow
 */
async function connectToRDSInternal(
  options: ValidatedConnectOptions,
): Promise<void> {
  // Get region
  const region = await selectRegion(options);

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region });
  const rdsClient = new RDSClient({ region });

  // Get ECS cluster
  const selectedCluster = await selectCluster(ecsClient, options);
  messages.success(`Cluster: ${selectedCluster.clusterName}`);

  // Get ECS task
  const selectedTaskArn = await selectTask(ecsClient, selectedCluster, options);
  messages.success(`Task: ${String(selectedTaskArn)}`);

  // Get RDS instance
  messages.warning("Getting RDS instances...");
  const selectedRDS = await selectRDSInstance(rdsClient, options);
  messages.success(`RDS: ${selectedRDS.dbInstanceIdentifier}`);

  // selectedTaskArn is already a strongly-typed TaskArn
  const taskArn = selectedTaskArn;

  // Use RDS port automatically with type safety
  const rdsPort: Port = isDefined(options.rdsPort)
    ? (() => {
        messages.success(`RDS Port (from CLI): ${Number(options.rdsPort)}`);
        return options.rdsPort;
      })()
    : (() => {
        // Automatically use the port from RDS instance, fallback to engine default
        const actualRDSPort = selectedRDS.port;
        const fallbackPortNumber = getDefaultPortForEngine(selectedRDS.engine);
        const portToUse = actualRDSPort
          ? Number(actualRDSPort)
          : fallbackPortNumber;
        const portResult = parsePortNumber(portToUse);
        if (isFailure(portResult)) {
          throw new Error(`Invalid RDS port: ${portResult.error}`);
        }
        messages.success(
          `RDS Port (auto-detected): ${Number(portResult.data)}`,
        );
        return portResult.data;
      })();

  // Specify local port with type safety
  const localPort: Port = isDefined(options.localPort)
    ? (() => {
        messages.success(`Local Port (from CLI): ${Number(options.localPort)}`);
        return options.localPort;
      })()
    : await promptForLocalPort();

  // Generate reproducible command
  const reproducibleCommand = generateReproducibleCommand(
    region,
    selectedCluster.clusterName,
    taskArn,
    selectedRDS.dbInstanceIdentifier,
    `${Number(rdsPort)}`,
    `${Number(localPort)}`,
  );

  // Start SSM session
  messages.info("Selected task:");
  messages.info(String(selectedTaskArn));
  await startSSMSession(
    taskArn,
    selectedRDS,
    String(Number(rdsPort)),
    String(Number(localPort)),
    reproducibleCommand,
  );
}
