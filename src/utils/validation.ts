import * as net from "node:net";
import { type InferIssue, safeParse } from "valibot";
import {
  ConnectOptionsSchema,
  ExecOptionsSchema,
  failure,
  type Port,
  PortSchema,
  type Result,
  success,
  type ValidatedConnectOptions,
  type ValidatedExecOptions,
} from "../types.js";
import { messages } from "./messages.js";

/**
 * Checks if an array or string is empty
 * @param value Array or string to check
 * @returns true if the array or string is empty, false otherwise
 */
export function isEmpty<T>(value: T[] | string): boolean {
  return value.length === 0;
}

// =============================================================================
// Parse-first Validation Functions
// =============================================================================

/**
 * Parse CLI options using valibot schemas
 * Returns a Result type instead of throwing exceptions
 */
export function parseConnectOptions(
  rawOptions: unknown,
): Result<ValidatedConnectOptions, InferIssue<typeof ConnectOptionsSchema>[]> {
  const result = safeParse(ConnectOptionsSchema, rawOptions);

  if (result.success) {
    return success(result.output);
  } else {
    return failure(result.issues);
  }
}

/**
 * Parse exec options using valibot schemas
 */
export function parseExecOptions(
  rawOptions: unknown,
): Result<ValidatedExecOptions, InferIssue<typeof ExecOptionsSchema>[]> {
  const result = safeParse(ExecOptionsSchema, rawOptions);

  if (result.success) {
    return success(result.output);
  } else {
    return failure(result.issues);
  }
}

/**
 * Parse port string to strongly-typed Port
 * This replaces manual validation with parsing approach
 */
export function parsePort(
  portString: string,
): Result<Port, InferIssue<typeof PortSchema>[]> {
  const result = safeParse(PortSchema, portString);

  if (result.success) {
    return success(result.output);
  } else {
    return failure(result.issues);
  }
}

/**
 * Display parsing errors in a user-friendly format
 * Updated to work with ParseResult pattern
 */
export function displayParsingErrors(
  issues:
    | InferIssue<typeof ConnectOptionsSchema>[]
    | InferIssue<typeof ExecOptionsSchema>[],
): void {
  messages.error("Invalid CLI options:");
  for (const issue of issues) {
    messages.error(
      `  • ${issue.path?.[0]?.key || "Unknown"}: ${issue.message}`,
    );
  }
}

// =============================================================================
// Network Port Functions with Type Safety
// =============================================================================

/**
 * Check if a port is available on localhost
 * Now accepts strongly-typed Port instead of plain number
 */
export async function isPortAvailableSafe(port: Port): Promise<boolean> {
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
 * Legacy port availability check for backward compatibility
 * Converts number to strongly-typed Port internally
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  const parseResult = parsePort(port.toString());
  if (!parseResult.success) {
    return false; // Invalid port numbers are considered unavailable
  }
  return isPortAvailableSafe(parseResult.data);
}

/**
 * Find the next available port starting from the given port (Result version)
 * Returns a Result type with strongly-typed Port
 */
export async function findAvailablePortSafe(
  startPort = 8888,
): Promise<Result<Port, string>> {
  // First, validate and parse the starting port
  const parseResult = parsePort(startPort.toString());
  if (!parseResult.success) {
    return failure(`Invalid starting port: ${startPort}`);
  }

  const maxPort = 65535;

  const findPort = async (currentPort: Port): Promise<Result<Port, string>> => {
    if (Number(currentPort) > maxPort) {
      return failure(`No available ports found starting from ${startPort}`);
    }

    if (await isPortAvailableSafe(currentPort)) {
      return success(currentPort);
    }

    const nextPortNumber = Number(currentPort) + 1;
    if (nextPortNumber > maxPort) {
      return failure(`No available ports found starting from ${startPort}`);
    }

    // Increment port and parse again to maintain type safety
    const nextPortResult = parsePort(nextPortNumber.toString());
    if (!nextPortResult.success) {
      return failure(`Port range exceeded maximum value: ${maxPort}`);
    }

    return findPort(nextPortResult.data);
  };

  return findPort(parseResult.data);
}

/**
 * Legacy function for backward compatibility
 * This maintains the original API while internally using the new type-safe version
 */
export async function findAvailablePort(startPort = 8888): Promise<number> {
  const result = await findAvailablePortSafe(startPort);
  if (result.success) {
    return Number(result.data);
  } else {
    throw new Error(result.error);
  }
}
