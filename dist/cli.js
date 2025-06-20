#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import * as v from "valibot";
import { connectToRDS } from "./aws-port-forward.js";
import { ConnectOptionsSchema } from "./types.js";
import { displayFriendlyError } from "./utils.js";
const program = new Command();
program
    .name("aws-port-forward")
    .description("CLI for port-forwarding to RDS via AWS ECS")
    .version("1.0.0");
program
    .command("connect")
    .description("Connect to RDS via ECS")
    .option("-r, --region <region>", "AWS region")
    .option("-c, --cluster <cluster>", "ECS cluster name")
    .option("-t, --task <task>", "ECS task ID")
    .option("--rds <rds>", "RDS instance identifier")
    .option("--rds-port <port>", "RDS port number")
    .option("-p, --local-port <port>", "Local port number")
    .action(async (rawOptions) => {
    try {
        const validationResult = v.safeParse(ConnectOptionsSchema, rawOptions);
        if (!validationResult.success) {
            console.log(chalk.red("❌ Invalid CLI options:"));
            for (const issue of validationResult.issues) {
                console.log(chalk.red(`  • ${issue.path?.[0]?.key || "Unknown"}: ${issue.message}`));
            }
            process.exit(1);
        }
        const validatedOptions = validationResult.output;
        console.log(chalk.blue("🚀 Starting AWS ECS RDS connection tool..."));
        await connectToRDS(validatedOptions);
        console.log(chalk.green("✅ Process completed successfully"));
    }
    catch (error) {
        if (error instanceof Error &&
            error.message.includes("maximum retry count")) {
            console.log(chalk.red("🚫 Terminating process"));
        }
        else {
            displayFriendlyError(error);
        }
        process.exit(1);
    }
});
process.on("unhandledRejection", (reason) => {
    console.log("");
    console.log(chalk.red("❌ An unexpected error occurred"));
    displayFriendlyError(reason);
    process.exit(1);
});
process.on("uncaughtException", (error) => {
    console.log("");
    console.log(chalk.red("❌ A critical error occurred"));
    displayFriendlyError(error);
    process.exit(1);
});
program.parse();
