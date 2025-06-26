import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import type { ValidatedConnectOptions } from "../types.js";
import { parsePortNumber } from "../types.js";
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
  // Check if dry run mode with all parameters provided - skip interactive UI
  if (options.dryRun && hasAllRequiredParameters(options)) {
    await handleDirectDryRun(options);
    return;
  }

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
    region: options.region ? options.region : undefined,
    cluster: options.cluster ? options.cluster : undefined,
    task: options.task ? options.task : undefined,
    rds: options.rds ? options.rds : undefined,
    rdsPort: options.rdsPort ? String(options.rdsPort) : undefined,
    localPort: options.localPort ? String(options.localPort) : undefined,
    dryRun: options.dryRun,
  });

  // Step 1: Select Region
  const selectedRegion = await selectRegion(options, selections);

  // Update UI with region selection - convert branded types to strings for display
  const displaySelections1 = {
    region: selections.region ? String(selections.region) : undefined,
    rds: selections.rds ? String(selections.rds) : undefined,
    rdsPort: selections.rdsPort ? String(selections.rdsPort) : undefined,
    ecsTarget: selections.ecsTarget,
    ecsCluster: selections.ecsCluster,
    localPort: selections.localPort ? String(selections.localPort) : undefined,
  };
  messages.ui.displaySelectionState(displaySelections1);

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
  const displaySelections2 = {
    region: selections.region ? String(selections.region) : undefined,
    rds: selections.rds ? String(selections.rds) : undefined,
    rdsPort: selections.rdsPort ? String(selections.rdsPort) : undefined,
    ecsTarget: selections.ecsTarget,
    ecsCluster: selections.ecsCluster,
    localPort: selections.localPort ? String(selections.localPort) : undefined,
  };
  messages.ui.displaySelectionState(displaySelections2);

  // Step 4: ECS Target Selection with Inference
  const { selectedInference, selectedTask } = await selectECSTarget({
    ecsClient,
    selectedRDS,
    options: {
      cluster: options.cluster,
      task: options.task,
    },
    selections: {
      region: selectedRegion,
      ecsTarget: selections.ecsTarget,
      ecsCluster: selections.ecsCluster,
      localPort: selections.localPort
        ? String(selections.localPort)
        : undefined,
      rds: selections.rds ? String(selections.rds) : undefined,
      rdsPort: selections.rdsPort ? String(selections.rdsPort) : undefined,
    },
  });

  // selectionsに反映（UI表示用）
  selections.ecsTarget = selectedTask;
  selections.ecsCluster = selectedInference.cluster.clusterName;

  // Update UI with ECS target selection
  const displaySelections3 = {
    region: selections.region ? String(selections.region) : undefined,
    rds: selections.rds ? String(selections.rds) : undefined,
    rdsPort: selections.rdsPort ? String(selections.rdsPort) : undefined,
    ecsTarget: selections.ecsTarget,
    ecsCluster: selections.ecsCluster,
    localPort: selections.localPort ? String(selections.localPort) : undefined,
  };
  messages.ui.displaySelectionState(displaySelections3);

  // Step 5: Local Port Selection
  await selectLocalPort(
    {
      localPort: options.localPort ? options.localPort : undefined,
    },
    selections,
  );

  // Final display with all selections complete
  const displaySelections4 = {
    region: selections.region ? String(selections.region) : undefined,
    rds: selections.rds ? String(selections.rds) : undefined,
    rdsPort: selections.rdsPort ? String(selections.rdsPort) : undefined,
    ecsTarget: selections.ecsTarget,
    ecsCluster: selections.ecsCluster,
    localPort: selections.localPort ? String(selections.localPort) : undefined,
  };
  messages.ui.displaySelectionState(displaySelections4);

  // Step 6: Handle Connection or Dry Run - use correct parameter order
  const rdsPortResult = parsePortNumber(Number(rdsPort));
  if (!rdsPortResult.success) throw new Error(rdsPortResult.error);

  await handleConnection({
    selections,
    selectedInference,
    selectedRDS,
    rdsPort: rdsPortResult.data,
    selectedTask,
    options,
  });
}

/**
 * Check if all required parameters are provided for dry run
 */
function hasAllRequiredParameters(options: ValidatedConnectOptions): boolean {
  return !!(
    options.region &&
    options.cluster &&
    options.task &&
    options.rds &&
    options.rdsPort &&
    options.localPort
  );
}

/**
 * Handle direct dry run without interactive UI
 */
async function handleDirectDryRun(
  options: ValidatedConnectOptions,
): Promise<void> {
  messages.info("Running dry run with provided parameters...");

  // Import dry run functions
  const { generateConnectDryRun, displayDryRunResult } = await import(
    "./dry-run.js"
  );
  const { parseRegionName, parseClusterName, parseTaskId, parsePortNumber } =
    await import("../types.js");

  // Parse all parameters
  const regionResult = parseRegionName(String(options.region));
  if (!regionResult.success) throw new Error(regionResult.error);

  const clusterResult = parseClusterName(String(options.cluster));
  if (!clusterResult.success) throw new Error(clusterResult.error);

  // Handle TaskArn or TaskId format
  const taskStr = String(options.task);
  // If taskStr contains '_', treat as TaskArn, else as TaskId
  const [_, extractedTaskId] = taskStr.split("_");
  const taskId = extractedTaskId ?? taskStr.replace(/^ecs:/, "");

  const taskIdResult = parseTaskId(taskId);
  if (!taskIdResult.success) throw new Error(taskIdResult.error);

  const rdsPortResult = parsePortNumber(Number(options.rdsPort));
  if (!rdsPortResult.success) throw new Error(rdsPortResult.error);

  const localPortResult = parsePortNumber(Number(options.localPort));
  if (!localPortResult.success) throw new Error(localPortResult.error);

  // Parse RDS identifier for mock instance
  const { parseDBInstanceIdentifier, parseDBEndpoint, parseDatabaseEngine } =
    await import("../types.js");

  const rdsIdResult = parseDBInstanceIdentifier(String(options.rds));
  if (!rdsIdResult.success) throw new Error(rdsIdResult.error);

  const endpointResult = parseDBEndpoint(
    `${String(options.rds)}.region.rds.amazonaws.com`,
  );
  if (!endpointResult.success) throw new Error(endpointResult.error);

  const engineResult = parseDatabaseEngine("postgres");
  if (!engineResult.success) throw new Error(engineResult.error);

  // Create mock RDS instance for dry run
  const mockRDSInstance = {
    dbInstanceIdentifier: rdsIdResult.data,
    endpoint: endpointResult.data,
    port: rdsPortResult.data,
    engine: engineResult.data,
    dbInstanceClass: "unknown",
    dbInstanceStatus: "available" as const,
    allocatedStorage: 0,
    availabilityZone: "unknown",
    vpcSecurityGroups: [],
    dbSubnetGroup: undefined,
    createdTime: undefined,
  };

  // Generate and display dry run result
  const dryRunResult = generateConnectDryRun({
    region: regionResult.data,
    cluster: clusterResult.data,
    task: taskIdResult.data,
    rdsInstance: mockRDSInstance,
    rdsPort: rdsPortResult.data,
    localPort: localPortResult.data,
  });

  displayDryRunResult(dryRunResult);
  messages.success("Dry run completed successfully.");
}
