import type { Command } from "commander";
import {
  registerConnectCommand,
  registerConnectInkCommand,
  registerConnectSimpleUICommand,
} from "./connect.js";
import {
  registerExecTaskCommand,
  registerExecTaskSimpleUICommand,
} from "./exec.js";

export function registerAllCommands(program: Command): void {
  registerConnectCommand(program);
  registerConnectSimpleUICommand(program);
  registerConnectInkCommand(program);
  registerExecTaskCommand(program);
  registerExecTaskSimpleUICommand(program);
}
