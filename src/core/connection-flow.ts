import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { isDefined } from "remeda";
import { startSSMSession } from "../session.js";
import type { ValidatedConnectOptions } from "../types.js";
import {
  askRetry,
  displayFriendlyError,
  getDefaultPortForEngine,
  messages,
} from "../utils/index.js";
import { generateReproducibleCommand } from "./command-generation.js";
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
  options: ValidatedConnectOptions = {},
): Promise<void> {
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
  const selectedTask = await selectTask(ecsClient, selectedCluster, options);
  messages.success(`Task: ${selectedTask}`);

  // Get RDS instance
  messages.warning("Getting RDS instances...");
  const selectedRDS = await selectRDSInstance(rdsClient, options);
  messages.success(`RDS: ${selectedRDS.dbInstanceIdentifier}`);

  // Use RDS port automatically
  let rdsPort: string;
  if (isDefined(options.rdsPort)) {
    rdsPort = `${options.rdsPort}`;
    messages.success(`RDS Port (from CLI): ${rdsPort}`);
  } else {
    // Automatically use the port from RDS instance, fallback to engine default
    const actualRDSPort = selectedRDS.port;
    const fallbackPort = getDefaultPortForEngine(selectedRDS.engine);
    rdsPort = `${actualRDSPort || fallbackPort}`;
    messages.success(`RDS Port (auto-detected): ${rdsPort}`);
  }

  // Specify local port
  let localPort: string;
  if (isDefined(options.localPort)) {
    localPort = `${options.localPort}`;
    messages.success(`Local Port (from CLI): ${localPort}`);
  } else {
    localPort = await promptForLocalPort();
  }

  // Generate reproducible command
  const reproducibleCommand = generateReproducibleCommand(
    region,
    selectedCluster.clusterName,
    selectedTask,
    selectedRDS.dbInstanceIdentifier,
    rdsPort,
    localPort,
  );

  // Start SSM session
  messages.info("Selected task:");
  messages.info(selectedTask);
  await startSSMSession(
    selectedTask,
    selectedRDS,
    rdsPort,
    localPort,
    reproducibleCommand,
  );
}
