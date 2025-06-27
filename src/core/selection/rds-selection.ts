import type { RDSClient } from "@aws-sdk/client-rds";
import { search } from "@inquirer/prompts";
import { getRDSInstances } from "../../aws-services.js";
import { searchRDS } from "../../search.js";
import {
  parseDBInstanceIdentifier,
  parsePortNumber,
} from "../../types/parsers.js";
import type { RDSInstance, SelectionState } from "../../types.js";
import { getDefaultPortForEngine, messages } from "../../utils/index.js";
import { clearLoadingMessage } from "../ui/display-utils.js";

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
    const rdsIdResult = parseDBInstanceIdentifier(options.rds);
    if (!rdsIdResult.success) throw new Error(rdsIdResult.error);

    selections.rds = rdsIdResult.data;
    messages.success(`✓ RDS (from CLI): ${options.rds}`);
    messages.info("Validating RDS instance...");

    const rdsInstancesResult = await getRDSInstances(rdsClient);
    if (!rdsInstancesResult.success) {
      throw new Error(
        `Failed to get RDS instances: ${rdsInstancesResult.error}`,
      );
    }

    const rdsInstance = rdsInstancesResult.data.find(
      (r) => String(r.dbInstanceIdentifier) === options.rds,
    );

    if (!rdsInstance) {
      throw new Error(`RDS instance not found: ${options.rds}`);
    }

    return rdsInstance;
  }

  messages.warning("Getting RDS instances...");
  const rdsInstancesResult = await getRDSInstances(rdsClient);
  if (!rdsInstancesResult.success) {
    throw new Error(`Failed to get RDS instances: ${rdsInstancesResult.error}`);
  }

  const rdsInstances = rdsInstancesResult.data;
  if (rdsInstances.length === 0) {
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
  const rdsIdResult = parseDBInstanceIdentifier(
    String(rdsInstance.dbInstanceIdentifier),
  );
  if (!rdsIdResult.success) throw new Error(rdsIdResult.error);

  selections.rds = rdsIdResult.data;
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
    const portResult = parsePortNumber(options.rdsPort);
    if (!portResult.success) throw new Error(portResult.error);

    selections.rdsPort = portResult.data;
    messages.success(`✓ RDS port (from CLI): ${options.rdsPort}`);
    return options.rdsPort;
  }

  // Use the actual port from RDS instance (branded type), fallback to engine default
  const actualRDSPort = selectedRDS.port;
  const fallbackPort = getDefaultPortForEngine(selectedRDS.engine);
  const port = actualRDSPort || fallbackPort;

  const portResult = parsePortNumber(port);
  if (!portResult.success) throw new Error(portResult.error);

  selections.rdsPort = portResult.data;
  messages.success(`✓ RDS port (auto-detected): ${port}`);
  return `${port}`;
}
