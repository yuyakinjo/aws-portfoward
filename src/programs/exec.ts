import type { Command } from "commander";
import { safeParse } from "valibot";
import { execECSTask, execECSTaskWithSimpleUI } from "../aws-exec.js";
import { ExecOptionsSchema } from "../types.js";
import {
  displayFriendlyError,
  displayValidationErrors,
  messages,
} from "../utils/index.js";

export function registerExecTaskCommand(program: Command): void {
  program
    .command("exec-task")
    .description("Execute command in ECS task container")
    .option("-r, --region <region>", "AWS region")
    .option("-c, --cluster <cluster>", "ECS cluster name")
    .option("-t, --task <task>", "ECS task ID")
    .option("--container <container>", "Container name")
    .option("--command <command>", "Command to execute (default: /bin/bash)")
    .action(async (rawOptions: unknown) => {
      try {
        // Validate options using Valibot
        const { success, issues, output } = safeParse(
          ExecOptionsSchema,
          rawOptions,
        );

        if (!success) {
          displayValidationErrors(issues);
          process.exit(1);
        }

        messages.info("Starting AWS ECS execute command tool...");
        await execECSTask(output);
      } catch (error) {
        // If error occurs during retry process, error is already displayed, so show brief message
        if (
          error instanceof Error &&
          error.message.includes("maximum retry count")
        ) {
          messages.error("Terminating process");
        } else {
          // For unexpected errors, display detailed error screen
          displayFriendlyError(error);
        }
        process.exit(1);
      }
    });
}

export function registerExecTaskSimpleUICommand(program: Command): void {
  program
    .command("exec-task-ui")
    .description(
      "Execute command in ECS task container with step-by-step UI (recommended)",
    )
    .option("-r, --region <region>", "AWS region")
    .option("-c, --cluster <cluster>", "ECS cluster name")
    .option("-t, --task <task>", "ECS task ID")
    .option("--container <container>", "Container name")
    .option("--command <command>", "Command to execute (default: /bin/bash)")
    .action(async (rawOptions: unknown) => {
      try {
        // Validate options using Valibot
        const { success, issues, output } = safeParse(
          ExecOptionsSchema,
          rawOptions,
        );

        if (!success) {
          displayValidationErrors(issues);
          process.exit(1);
        }

        messages.info(
          "Starting AWS ECS execute command tool with Simple UI...",
        );
        await execECSTaskWithSimpleUI(output);
      } catch (error) {
        // If error occurs during retry process, error is already displayed, so show brief message
        if (
          error instanceof Error &&
          error.message.includes("maximum retry count")
        ) {
          messages.error("Terminating process");
        } else {
          // For unexpected errors, display detailed error screen
          displayFriendlyError(error);
        }
        process.exit(1);
      }
    });
}
