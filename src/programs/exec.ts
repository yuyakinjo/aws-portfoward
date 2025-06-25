import type { Command } from "commander";
import { render } from "ink";
import React from "react";
import { safeParse } from "valibot";
import { ExecApp } from "../commands/exec/index.js";
import { ExecOptionsSchema } from "../types.js";
import { displayValidationErrors } from "../utils/index.js";

export function registerExecTaskCommand(program: Command): void {
  program
    .command("exec-task")
    .description("Execute command in ECS task container with interactive UI")
    .option("-r, --region <region>", "AWS region")
    .option("-c, --cluster <cluster>", "ECS cluster name")
    .option("-t, --task <task>", "ECS task ID")
    .option("--container <container>", "Container name")
    .option("--command <command>", "Command to execute (default: /bin/bash)")
    .option("--dry-run", "Show commands without execution")
    .action(async (rawOptions: unknown) => {
      // Validate options using Valibot
      const { success, issues, output } = safeParse(
        ExecOptionsSchema,
        rawOptions,
      );

      if (!success) {
        displayValidationErrors(issues);
        process.exit(1);
      }

      // Render Ink application
      render(React.createElement(ExecApp, { options: output }));
    });
}
