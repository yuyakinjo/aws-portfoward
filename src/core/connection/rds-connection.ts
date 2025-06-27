import { safeParse } from "valibot";
import { startSSMSession } from "../../session.js";
import {
  parseClusterName,
  parsePort,
  parseRegionName,
  parseTaskArn,
  parseTaskId,
} from "../../types/parsers.js";
import type { HandleConnectionParams } from "../../types/schemas.js";
import { HandleConnectionParamsSchema } from "../../types/schemas.js";
import type {
  ClusterName,
  Port,
  RDSInstance,
  RegionName,
  TaskArn,
} from "../../types.js";
import { messages } from "../../utils/index.js";
import { generateReproducibleCommand } from "../command-generation.js";
import { displayDryRunResult, generateConnectDryRun } from "../dry-run.js";

/**
 * Handle the final connection or dry run
 */
export async function handleConnection(
  params: HandleConnectionParams,
): Promise<void> {
  // Validate parameters with schema
  const parseResult = safeParse(HandleConnectionParamsSchema, params);
  if (!parseResult.success) {
    throw new Error(
      `Invalid parameters: ${parseResult.issues.map((issue) => `${issue.path?.map((p) => p.key).join(".")} - ${issue.message}`).join(", ")}`,
    );
  }

  const {
    selections,
    selectedInference,
    selectedRDS,
    rdsPort,
    selectedTask,
    options,
  } = parseResult.output;

  // Parse external inputs only once at the boundary
  const regionResult = parseRegionName(selections.region);
  if (!regionResult.success) throw new Error(regionResult.error);

  const clusterResult = parseClusterName(
    selections.ecsCluster || String(selectedInference.cluster.clusterName),
  );
  if (!clusterResult.success) throw new Error(clusterResult.error);

  const taskResult = parseTaskArn(selectedTask);
  if (!taskResult.success) throw new Error(taskResult.error);

  const rdsPortResult = parsePort(rdsPort);
  if (!rdsPortResult.success) throw new Error(rdsPortResult.error);

  const localPortStr = selections.localPort || "8888";
  const localPortResult = parsePort(localPortStr);
  if (!localPortResult.success) throw new Error(localPortResult.error);

  // Generate reproducible command with parsed branded types
  const reproducibleCommand = generateReproducibleCommand({
    region: regionResult.data,
    cluster: clusterResult.data,
    task: taskResult.data,
    rds: selectedRDS.dbInstanceIdentifier,
    rdsPort: rdsPortResult.data,
    localPort: localPortResult.data,
  });

  // Pass branded types to internal functions
  if (options.dryRun) {
    await handleDryRun(
      regionResult.data,
      clusterResult.data,
      taskResult.data,
      selectedRDS,
      rdsPortResult.data,
      localPortResult.data,
    );
  } else {
    await handleLiveConnection(
      taskResult.data,
      selectedRDS,
      rdsPortResult.data,
      localPortResult.data,
      reproducibleCommand,
    );
  }
}

/**
 * Handle dry run mode - accepts branded types directly
 */
async function handleDryRun(
  region: RegionName,
  cluster: ClusterName,
  taskArn: TaskArn,
  selectedRDS: RDSInstance,
  rdsPort: Port,
  localPort: Port,
): Promise<void> {
  // Extract TaskId from TaskArn for dry run
  const taskIdStr = String(taskArn).split("_")[1] || String(taskArn);
  const taskIdResult = parseTaskId(taskIdStr);
  if (!taskIdResult.success) throw new Error(taskIdResult.error);

  // Generate and display dry run result with branded types
  const dryRunResult = generateConnectDryRun({
    region,
    cluster,
    task: taskIdResult.data,
    rdsInstance: selectedRDS,
    rdsPort,
    localPort,
  });

  displayDryRunResult(dryRunResult);
  messages.success("Dry run completed successfully.");
}

/**
 * Handle live connection - accepts branded types directly
 */
async function handleLiveConnection(
  taskArn: TaskArn,
  selectedRDS: RDSInstance,
  rdsPort: Port,
  localPort: Port,
  reproducibleCommand: string,
): Promise<void> {
  // Pass branded types directly to startSSMSession
  await startSSMSession({
    localPort,
    rdsInstance: selectedRDS,
    rdsPort,
    taskArn,
    reproducibleCommand,
  });
}
