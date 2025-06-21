import * as net from "node:net";
import type * as v from "valibot";
import type { ConnectOptionsSchema } from "../types.js";
import { messages } from "./messages.js";

/**
 * Display validation errors in a user-friendly format
 */
export function displayValidationErrors(
  issues: v.InferIssue<typeof ConnectOptionsSchema>[],
): void {
  messages.error("❌ Invalid CLI options:");
  for (const issue of issues) {
    messages.error(
      `  • ${issue.path?.[0]?.key || "Unknown"}: ${issue.message}`,
    );
  }
}

/**
 * Check if a port is available on localhost
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(port, "localhost", () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Find the next available port starting from the given port
 */
export async function findAvailablePort(startPort = 8888): Promise<number> {
  let port = startPort;
  const maxPort = 65535;

  while (port <= maxPort) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }

  throw new Error(`No available ports found starting from ${startPort}`);
}
