#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { registerAllCommands } from "./programs/index.js";
import { displayFriendlyError, messages } from "./utils/index.js";

// Import version from package.json
const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const program = new Command();

program
  .name("aws-port-forward")
  .description("CLI for port-forwarding to RDS via AWS ECS")
  .version(packageJson.version);

// Register all commands
registerAllCommands(program);

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  messages.empty();
  messages.error("An unexpected error occurred");
  displayFriendlyError(reason);
  process.exit(1);
});

// Catch uncaught exceptions
process.on("uncaughtException", (error) => {
  messages.empty();
  messages.error("A critical error occurred");
  displayFriendlyError(error);
  process.exit(1);
});

program.parse();
