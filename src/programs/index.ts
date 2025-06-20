import type { Command } from "commander";
import { registerConnectCommand } from "./connect.js";

export function registerAllCommands(program: Command): void {
	registerConnectCommand(program);
}
