import { input } from "@inquirer/prompts";
import { isDefined } from "remeda";
import { parsePortNumber } from "../../types/parsers.js";
import type { Port, SelectionState } from "../../types.js";
import {
  findAvailablePort,
  getPortRange,
  isPortRange,
  messages,
} from "../../utils/index.js";
import { clearLoadingMessage } from "../ui/display-utils.js";

/**
 * Handle local port selection logic
 */
export async function selectLocalPort(
  options: { localPort?: Port },
  selections: SelectionState,
): Promise<string> {
  if (isDefined(options.localPort)) {
    const portResult = parsePortNumber(options.localPort);
    if (!portResult.success) throw new Error(portResult.error);

    selections.localPort = portResult.data;
    messages.success(`✓ Local port (from CLI): ${options.localPort}`);
    return `${options.localPort}`;
  }

  try {
    messages.warning("Finding available local port...");
    const availablePort = await findAvailablePort(8888);

    const portResult = parsePortNumber(availablePort);
    if (!portResult.success) throw new Error(portResult.error);

    selections.localPort = portResult.data;

    // Clear the loading message
    clearLoadingMessage();

    return `${availablePort}`;
  } catch {
    // If auto-detection fails, ask user for input
    const port = await input({
      message: "Enter local port number:",
      default: "8888",
      validate: (inputValue) => {
        const port = parseInt(inputValue || "8888");
        const [minPort, maxPort] = getPortRange();
        return isPortRange(port)
          ? true
          : `Please enter a valid port number (${minPort}-${maxPort})`;
      },
    });

    const portResult = parsePortNumber(port);
    if (!portResult.success) throw new Error(portResult.error);

    selections.localPort = portResult.data;
    return port;
  }
}
