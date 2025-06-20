#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { registerAllCommands } from "./programs/index.js";
import { displayFriendlyError } from "./utils/index.js";

const program = new Command();

program
	.name("aws-port-forward")
	.description("CLI for port-forwarding to RDS via AWS ECS")
	.version("1.0.0");

// Register all commands
registerAllCommands(program);

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason) => {
	console.log("");
	console.log(chalk.red("❌ An unexpected error occurred"));
	displayFriendlyError(reason);
	process.exit(1);
});

// Catch uncaught exceptions
process.on("uncaughtException", (error) => {
	console.log("");
	console.log(chalk.red("❌ A critical error occurred"));
	displayFriendlyError(error);
	process.exit(1);
});

program.parse();
