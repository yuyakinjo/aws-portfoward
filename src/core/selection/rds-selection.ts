import { RDSClient } from "@aws-sdk/client-rds";
import { search } from "@inquirer/prompts";
import { getRDSInstances } from "../../aws-services.js";
import { searchRDS } from "../../search.js";
import type { RDSInstance } from "../../types.js";
import { getDefaultPortForEngine, messages } from "../../utils/index.js";
import { clearLoadingMessage } from "../ui/display-utils.js";
import type { SelectionState } from "../ui/selection-ui.js";

const DEFAULT_PAGE_SIZE = 50;

/**
 * Handle RDS instance selection logic
 */
export async function selectRDSInstance(
  rdsClient: RDSClient,
  options: { rds?: string },
  selections: SelectionState,
): Promise<RDSInstance> {
  if (options.rds) {
    selections.rds = options.rds;
    messages.success(`✓ RDS (from CLI): ${options.rds}`);
    messages.info("Validating RDS instance...");
    
    const rdsInstancesResult = await getRDSInstances(rdsClient);
    if (!rdsInstancesResult.success) {
      throw new Error(
        `Failed to get RDS instances: ${rdsInstancesResult.error}`,
      );
    }
    
    const rdsInstance = rdsInstancesResult.data.find(
      (r) => r.dbInstanceIdentifier === options.rds,
    );
    
    if (!rdsInstance) {
      throw new Error(`RDS instance not found: ${options.rds}`);
    }
    
    return rdsInstance;
  }

  messages.warning("Getting RDS instances...");
  const rdsInstancesResult = await getRDSInstances(rdsClient);
  if (!rdsInstancesResult.success) {
    throw new Error(
      `Failed to get RDS instances: ${rdsInstancesResult.error}`,
    );
  }
  
  const rdsInstances = rdsInstancesResult.data;
  if (isEmpty(rdsInstances)) {
    throw new Error("No RDS instances found");
  }

  // Clear the loading message
  clearLoadingMessage();

  const selectedRDS = await search({
    message: "Search and select RDS instance:",
    source: async (input) => {
      return await searchRDS(rdsInstances, input || "");
    },
    pageSize: DEFAULT_PAGE_SIZE,
  });

  if (
    !selectedRDS ||
    typeof selectedRDS !== "object" ||
    !("dbInstanceIdentifier" in selectedRDS)
  ) {
    throw new Error("Invalid RDS selection");
  }

  const rdsInstance = selectedRDS as RDSInstance;
  selections.rds = String(rdsInstance.dbInstanceIdentifier);
  return rdsInstance;
}

/**
 * Determine RDS port based on options or auto-detection
 */
export function determineRDSPort(
  selectedRDS: RDSInstance,
  options: { rdsPort?: string },
  selections: SelectionState,
): string {
  if (options.rdsPort) {
    const port = `${Number(options.rdsPort)}`;
    selections.rdsPort = port;
    messages.success(`✓ RDS port (from CLI): ${options.rdsPort}`);
    return port;
  }
  
  const actualRDSPort = selectedRDS.port;
  const fallbackPort = getDefaultPortForEngine(selectedRDS.engine);
  const port = `${actualRDSPort ? Number(actualRDSPort) : fallbackPort}`;
  selections.rdsPort = port;
  messages.success(`✓ RDS port (auto-detected): ${port}`);
  return port;
}