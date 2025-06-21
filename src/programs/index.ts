import type { Command } from "commander";
import {
  registerConnectCommand,
  registerConnectSimpleUICommand,
} from "./connect.js";

export function registerAllCommands(program: Command): void {
  registerConnectCommand(program);
  registerConnectSimpleUICommand(program);
}
