import { startSSMSession } from "../../session.js";
import type { RDSInstance, RegionName, ClusterName } from "../../types.js";
import {
  parseClusterName,
  parsePortNumber,
  parseRegionName,
  parseTaskArn,
  parseTaskId,
} from "../../types.js";
import { messages } from "../../utils/index.js";
import { generateReproducibleCommand } from "../command-generation.js";
import { displayDryRunResult, generateConnectDryRun } from "../dry-run.js";
import type { SelectionState } from "../ui/selection-ui.js";

/**
 * Handle the final connection or dry run
 */
export async function handleConnection(
  selections: SelectionState,
  selectedRDS: RDSInstance,
  selectedTask: string,
  selectedInference: any,
  rdsPort: string,
  options: { dryRun?: boolean },
): Promise<void> {
  // Parse and validate selections for reproducible command
  const regionResult = parseRegionName(selections.region);
  if (!regionResult.success) throw new Error(regionResult.error);

  const clusterResult = parseClusterName(
    selections.ecsCluster || String(selectedInference.cluster.clusterName),
  );
  if (!clusterResult.success) throw new Error(clusterResult.error);

  const taskResult = parseTaskArn(selectedTask);
  if (!taskResult.success) throw new Error(taskResult.error);

  // Generate reproducible command
  const rdsPortNumber = parsePortNumber(Number(rdsPort));
  if (!rdsPortNumber.success) throw new Error(rdsPortNumber.error);
  
  const localPortStr = selections.localPort || "";
  const localPortNumber = parsePortNumber(Number(localPortStr || "8888"));
  if (!localPortNumber.success) throw new Error(localPortNumber.error);
  
  const reproducibleCommand = generateReproducibleCommand(
    regionResult.data,
    clusterResult.data,
    taskResult.data,
    selectedRDS.dbInstanceIdentifier,
    rdsPortNumber.data,
    localPortNumber.data,
  );

  // Check if dry run mode is enabled
  if (options.dryRun) {
    await handleDryRun(
      regionResult.data,
      clusterResult.data,
      taskResult.data,
      selectedRDS,
      rdsPort,
      selections.localPort || "8888",
    );
  } else {
    await handleLiveConnection(
      taskResult.data,
      selectedRDS,
      rdsPort,
      selections.localPort || "8888",
      reproducibleCommand,
    );
  }
}

/**
 * Handle dry run mode
 */
async function handleDryRun(
  region: RegionName,
  cluster: ClusterName,
  taskArn: string,
  selectedRDS: RDSInstance,
  rdsPort: string,
  localPort: string,
): Promise<void> {
  // Parse port numbers safely
  const rdsPortResult = parsePortNumber(Number(rdsPort));
  if (!rdsPortResult.success) throw new Error(rdsPortResult.error);

  const localPortResult = parsePortNumber(Number(localPort));
  if (!localPortResult.success) throw new Error(localPortResult.error);

  // Extract TaskId from TaskArn for dry run
  const taskIdStr = String(taskArn).split("_")[1] || String(taskArn);
  const taskIdResult = parseTaskId(taskIdStr);
  if (!taskIdResult.success) throw new Error(taskIdResult.error);

  // Generate and display dry run result
  const dryRunResult = generateConnectDryRun(
    region,
    cluster,
    taskIdResult.data,
    selectedRDS,
    rdsPortResult.data,
    localPortResult.data,
  );

  displayDryRunResult(dryRunResult);
  messages.success("Dry run completed successfully.");
}

/**
 * Handle live connection
 */
async function handleLiveConnection(
  taskArn: string,
  selectedRDS: RDSInstance,
  rdsPort: string,
  localPort: string,
  reproducibleCommand: string,
): Promise<void> {
  // Parse port numbers for SSM session
  const rdsPortResult = parsePortNumber(Number(rdsPort));
  if (!rdsPortResult.success) throw new Error(rdsPortResult.error);

  const localPortResult = parsePortNumber(Number(localPort));
  if (!localPortResult.success) throw new Error(localPortResult.error);

  await startSSMSession(
    taskArn,
    selectedRDS,
    String(Number(rdsPortResult.data)),
    String(Number(localPortResult.data)),
    reproducibleCommand,
  );
}