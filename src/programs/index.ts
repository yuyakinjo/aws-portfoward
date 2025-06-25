import type { Command } from "commander";
import { registerConnectCommand } from "./connect.js";
import { registerExecTaskCommand } from "./exec.js";

export function registerAllCommands(program: Command): void {
  registerConnectCommand(program);
  registerExecTaskCommand(program);
}
