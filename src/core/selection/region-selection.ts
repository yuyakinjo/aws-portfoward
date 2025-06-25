import { EC2Client } from "@aws-sdk/client-ec2";
import { search } from "@inquirer/prompts";
import { isEmpty } from "remeda";
import { getAWSRegions } from "../../aws-services.js";
import { searchRegions } from "../../search.js";
import { messages } from "../../utils/index.js";
import { clearLoadingMessage } from "../ui/display-utils.js";
import type { SelectionState } from "../ui/selection-ui.js";

const DEFAULT_PAGE_SIZE = 50;

/**
 * Handle region selection logic
 */
export async function selectRegion(
  options: { region?: string },
  selections: SelectionState,
): Promise<string> {
  if (options.region) {
    selections.region = options.region;
    messages.success(`✓ Region (from CLI): ${options.region}`);
    return options.region;
  }

  // Show initial UI state
  messages.ui.displaySelectionState(selections);

  // Initialize EC2 client with default region to get region list
  const defaultEc2Client = new EC2Client({ region: "us-east-1" });

  messages.warning("Getting available AWS regions...");
  const regionsResult = await getAWSRegions(defaultEc2Client);
  if (!regionsResult.success) {
    throw new Error(`Failed to get AWS regions: ${regionsResult.error}`);
  }
  const regions = regionsResult.data;

  if (isEmpty(regions)) {
    throw new Error("Failed to get AWS regions");
  }

  // Clear the loading message and show search prompt
  clearLoadingMessage();

  const selectedRegion = await search({
    message: "Search and select AWS region:",
    source: async (input) => {
      return await searchRegions(regions, input || "");
    },
    pageSize: DEFAULT_PAGE_SIZE,
  });

  if (typeof selectedRegion !== "string") {
    throw new Error("Invalid region selection");
  }
  selections.region = selectedRegion;
  return selectedRegion;
}