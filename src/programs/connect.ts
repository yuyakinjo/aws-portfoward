import type { Command } from "commander";
import { safeParse } from "valibot";
import { connectWithInk } from "../commands/connect/index.js";
import { ConnectOptionsSchema } from "../types.js";
import {
  displayFriendlyError,
  displayValidationErrors,
} from "../utils/index.js";

export function registerConnectCommand(program: Command): void {
  program
    .command("connect")
    .description("Connect to RDS via ECS with interactive UI")
    .option("-r, --region <region>", "AWS region")
    .option("-c, --cluster <cluster>", "ECS cluster name")
    .option("-t, --task <task>", "ECS task ID")
    .option("--rds <rds>", "RDS instance identifier")
    .option("--rds-port <port>", "RDS port number")
    .option("-p, --local-port <port>", "Local port number")
    .option("--dry-run", "Show commands without execution")
    .action(async (rawOptions: unknown) => {
      try {
        // Validate options using Valibot
        const { success, issues, output } = safeParse(
          ConnectOptionsSchema,
          rawOptions,
        );

        if (!success) {
          displayValidationErrors(issues);
          process.exit(1);
        }

        await connectWithInk(output);
      } catch (error) {
        displayFriendlyError(error);
        process.exit(1);
      }
    });
}
