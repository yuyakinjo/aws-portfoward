#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import { connectToRDS } from "./aws-port-forward.js";
import { displayFriendlyError } from "./utils.js";
const program = new Command();
program
    .name("aws-port-forward")
    .description("CLI for port-forwarding to RDS via AWS ECS")
    .version("1.0.0");
program
    .command("connect")
    .description("Connect to RDS via ECS")
    .action(async () => {
    try {
        console.log(chalk.blue("🚀 Starting AWS ECS RDS connection tool..."));
        await connectToRDS();
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
