#!/usr/bin/env node
import { Command } from "commander";
import { registerAllCommands } from "./programs/index.js";
import { displayFriendlyError, messages } from "./utils/index.js";
const program = new Command();
program
    .name("aws-port-forward")
    .description("CLI for port-forwarding to RDS via AWS ECS")
    .version("1.0.0");
registerAllCommands(program);
process.on("unhandledRejection", (reason) => {
    messages.empty();
    messages.error("❌ An unexpected error occurred");
    displayFriendlyError(reason);
    process.exit(1);
});
process.on("uncaughtException", (error) => {
    messages.empty();
    messages.error("❌ A critical error occurred");
    displayFriendlyError(error);
    process.exit(1);
});
program.parse();
