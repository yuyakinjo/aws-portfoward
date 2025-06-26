import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import type { ValidatedConnectOptions } from "../types.js";
import { askRetry, displayFriendlyError, messages } from "../utils/index.js";
import { handleConnection } from "./connection/rds-connection.js";
import { selectECSTarget } from "./selection/ecs-selection.js";
import { selectLocalPort } from "./selection/port-selection.js";
import {
  determineRDSPort,
  selectRDSInstance,
} from "./selection/rds-selection.js";
import { selectRegion } from "./selection/region-selection.js";
import { initializeSelectionState } from "./ui/selection-ui.js";

/**
 * Simple UI workflow with step-by-step selection
 */
export async function connectToRDSWithSimpleUI(
  options: ValidatedConnectOptions = { dryRun: false },
): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      await connectToRDSWithSimpleUIInternal(options);
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

async function connectToRDSWithSimpleUIInternal(
  options: ValidatedConnectOptions,
): Promise<void> {
  // Check if dry run mode is enabled and show appropriate message
  if (options.dryRun) {
    messages.info(
      "Starting AWS ECS RDS connection tool with Simple UI (DRY RUN)...",
    );
  } else {
    messages.info("Starting AWS ECS RDS connection tool with Simple UI...");
  }

  // Initialize selection state - convert branded types to strings only for UI
  const selections = initializeSelectionState({
    region: options.region ? String(options.region) : undefined,
    cluster: options.cluster ? String(options.cluster) : undefined,
    task: options.task ? String(options.task) : undefined,
    rds: options.rds ? String(options.rds) : undefined,
    rdsPort: options.rdsPort ? String(options.rdsPort) : undefined,
    localPort: options.localPort ? String(options.localPort) : undefined,
    dryRun: options.dryRun,
  });

  // Step 1: Select Region
  const selectedRegion = await selectRegion(options, selections);

  // Update UI with region selection
  messages.ui.displaySelectionState(selections);

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region: selectedRegion });
  const rdsClient = new RDSClient({ region: selectedRegion });

  // Step 2: Select RDS Instance
  const selectedRDS = await selectRDSInstance(rdsClient, options, selections);

  // Step 3: Determine RDS Port
  const rdsPort = determineRDSPort(
    selectedRDS,
    {
      rdsPort: options.rdsPort ? String(options.rdsPort) : undefined,
    },
    selections,
  );

  // Update UI with RDS and port selection
  messages.ui.displaySelectionState(selections);

  // Step 4: ECS Target Selection with Inference
  const { selectedInference, selectedTask } = await selectECSTarget(
    ecsClient,
    selectedRDS,
    options,
    selections,
  );

  // Update UI with ECS target selection
  messages.ui.displaySelectionState(selections);

  // Step 5: Local Port Selection
  await selectLocalPort(
    {
      localPort: options.localPort ? String(options.localPort) : undefined,
    },
    selections,
  );

  // Final display with all selections complete
  messages.ui.displaySelectionState(selections);

  // Step 6: Handle Connection or Dry Run
  await handleConnection(
    selections,
    selectedRDS,
    selectedTask,
    selectedInference,
    rdsPort,
    options,
  );
}
