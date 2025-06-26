import { input } from "@inquirer/prompts";
import { isDefined } from "remeda";
import type { Port, SelectionState } from "../../types.js";
import { findAvailablePort, messages } from "../../utils/index.js";
import { clearLoadingMessage } from "../ui/display-utils.js";

/**
 * Handle local port selection logic
 */
export async function selectLocalPort(
  options: { localPort?: Port },
  selections: SelectionState,
): Promise<string> {
  if (isDefined(options.localPort)) {
    const port = `${Number(options.localPort)}`;
    selections.localPort = port;
    messages.success(`✓ Local port (from CLI): ${options.localPort}`);
    return port;
  }

  try {
    messages.warning("Finding available local port...");
    const availablePort = await findAvailablePort(8888);
    selections.localPort = `${availablePort}`;

    // Clear the loading message
    clearLoadingMessage();

    return `${availablePort}`;
  } catch {
    // If auto-detection fails, ask user for input
    const port = await input({
      message: "Enter local port number:",
      default: "8888",
      validate: (inputValue: string) => {
        const port = parseInt(inputValue || "8888");
        return port > 0 && port < 65536
          ? true
          : "Please enter a valid port number (1-65535)";
      },
    });

    selections.localPort = port;
    return port;
  }
}
