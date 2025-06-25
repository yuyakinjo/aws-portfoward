import { messages } from "../../utils/index.js";
import { displayCLIArguments } from "./display-utils.js";

/**
 * Selection state for UI display
 */
export interface SelectionState {
  region?: string;
  rds?: string;
  rdsPort?: string;
  ecsTarget?: string;
  ecsCluster?: string;
  localPort?: string;
}

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
  const selections: SelectionState = {};
  
  // Display CLI arguments if provided
  const cliArgs = displayCLIArguments(options);
  if (cliArgs.length > 0) {
    messages.info(`CLI arguments: ${cliArgs.join(" ")}`);
  }
  
  return selections;
}