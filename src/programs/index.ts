import type { Command } from "commander";
import {
  registerConnectCommand,
  registerConnectInferenceCommand,
  registerConnectSimpleUICommand,
} from "./connect.js";

export function registerAllCommands(program: Command): void {
  registerConnectCommand(program);
  registerConnectInferenceCommand(program);
  registerConnectSimpleUICommand(program);
}
