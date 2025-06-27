import { isEmpty } from "remeda";
import { parseSelectionState, type SelectionState } from "../../types/index.js";
import { messages } from "../../utils/index.js";
import { displayCLIArguments } from "./display-utils.js";

/**
 * Initialize and display selection state
 */
export function initializeSelectionState(options: {
  region?: string;
  cluster?: string;
  task?: string;
  rds?: string;
  rdsPort?: string;
  localPort?: string;
  dryRun?: boolean;
}): SelectionState {
  const parsed = parseSelectionState({
    region: options.region,
    rds: options.rds,
    rdsPort: options.rdsPort,
    localPort: options.localPort,
    ecsCluster: options.cluster,
    ecsTarget: options.task,
  });
  if (!parsed.success) {
    throw new Error("Invalid selection state provided");
  }
  // Display CLI arguments if provided
  const cliArgs = displayCLIArguments(options);
  if (!isEmpty(cliArgs)) messages.info(`CLI arguments: ${cliArgs.join(" ")}`);

  return parsed.data;
}
