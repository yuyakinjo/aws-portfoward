import type { Command } from "commander";
import {
  registerConnectCommand,
  registerConnectSimpleUICommand,
} from "./connect.js";
import {
  registerExecTaskCommand,
  registerExecTaskSimpleUICommand,
} from "./exec.js";

export function registerAllCommands(program: Command): void {
  registerConnectCommand(program);
  registerConnectSimpleUICommand(program);
  registerExecTaskCommand(program);
  registerExecTaskSimpleUICommand(program);
}
