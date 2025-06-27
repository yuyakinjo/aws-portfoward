import type { Command } from "commander";
import { registerConnectCommand } from "./connect.js";
import { registerExecTaskCommand } from "./exec.js";

export function registerAllCommands(command: Command): void {
  registerConnectCommand(command);
  registerExecTaskCommand(command);
}
