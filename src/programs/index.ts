import type { Command } from "commander";

export function registerAllCommands(program: Command): void {
  program
    .command("connect")
    .description("Connect to an AWS RDS instance via ECS Exec")
    .option("-r, --region <region>", "AWS region")
    .option("-c, --cluster <cluster>", "ECS cluster name")
    .option("-t, --task <task>", "ECS task ID")
    .option("--rds <rds>", "RDS instance identifier")
    .option("--rds-port <port>", "RDS port number")
    .option("-p, --local-port <port>", "Local port number")
    .option("--dry-run", "Show commands without execution")
    .action(async (rawOptions: unknown) => {
      const { runConnectCommand } = await import("./connect.js");
      await runConnectCommand(rawOptions);
    });

  program
    .command("exec")
    .description("Execute a command on an AWS ECS task")
    .option("-r, --region <region>", "AWS region")
    .option("-c, --cluster <cluster>", "ECS cluster name")
    .option("-t, --task <task>", "ECS task ID")
    .option("--container <container>", "Container name")
    .option("--command <command>", "Command to execute (default: /bin/bash)")
    .option("--dry-run", "Show commands without execution")
    .action(async (rawOptions: unknown) => {
      const { runExecTaskCommand } = await import("./exec.js");
      await runExecTaskCommand(rawOptions);
    });
}
