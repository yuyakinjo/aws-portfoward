import chalk from "chalk";
import type { DryRunResult, RDSInstance } from "../types.js";
import { VERSION } from "../version.js";
import { generateReproducibleCommand } from "./command-generation.js";

/**
 * Display dry run results in a formatted way
 */
export function displayDryRunResult(result: DryRunResult): void {
  console.log("");
  console.log(chalk.cyan("🏃 Dry Run Mode - Commands that would be executed:"));
  console.log("");

  // Display AWS Command
  console.log(chalk.blue("AWS Command:"));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(result.awsCommand);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Display Reproducible Command
  console.log(chalk.green("Reproducible Command:"));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(result.reproducibleCommand);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  // Display session info
  console.log(chalk.yellow("Session Information:"));
  console.log(`Region: ${result.sessionInfo.region}`);
  console.log(`Cluster: ${result.sessionInfo.cluster}`);
  console.log(`Task: ${result.sessionInfo.task}`);

  if (result.sessionInfo.rds) {
    console.log(`RDS: ${result.sessionInfo.rds}`);
    console.log(`RDS Port: ${result.sessionInfo.rdsPort}`);
    console.log(`Local Port: ${result.sessionInfo.localPort}`);
  }

  if (result.sessionInfo.container) {
    console.log(`Container: ${result.sessionInfo.container}`);
    console.log(`Command: ${result.sessionInfo.command}`);
  }

  console.log("");
}

/**
 * Generate dry run result for connect commands
 */
export function generateConnectDryRun(
  region: string,
  cluster: string,
  task: string,
  rdsInstance: RDSInstance,
  rdsPort: string,
  localPort: string,
): DryRunResult {
  // Generate SSM command
  const parameters = {
    host: [rdsInstance.endpoint],
    portNumber: [rdsPort],
    localPortNumber: [localPort],
  };
  const parametersJson = JSON.stringify(parameters);
  const awsCommand = `aws ssm start-session --target ${task} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;

  // Generate reproducible command
  const reproducibleCommand = generateReproducibleCommand(
    region,
    cluster,
    task,
    rdsInstance.dbInstanceIdentifier,
    rdsPort,
    localPort,
  );

  return {
    awsCommand,
    reproducibleCommand,
    sessionInfo: {
      region,
      cluster,
      task,
      rds: rdsInstance.dbInstanceIdentifier,
      rdsPort,
      localPort,
    },
  };
}

/**
 * Generate dry run result for exec commands
 */
export function generateExecDryRun(
  region: string,
  cluster: string,
  task: string,
  container: string,
  command: string,
): DryRunResult {
  // Generate ECS execute command
  const awsCommand = `aws ecs execute-command --region ${region} --cluster ${cluster} --task ${task} --container ${container} --command "${command}" --interactive`;

  // Generate reproducible command
  const reproducibleCommand = `npx ecs-pf@${VERSION} exec-task --region ${region} --cluster ${cluster} --task ${task} --container ${container} --command "${command}"`;

  return {
    awsCommand,
    reproducibleCommand,
    sessionInfo: {
      region,
      cluster,
      task,
      container,
      command,
    },
  };
}

/**
 * Generate SSM command string without executing it
 */
export function generateSSMCommand(
  taskArn: string,
  rdsInstance: RDSInstance,
  rdsPort: string,
  localPort: string,
): string {
  const parameters = {
    host: [rdsInstance.endpoint],
    portNumber: [rdsPort],
    localPortNumber: [localPort],
  };

  const parametersJson = JSON.stringify(parameters);
  return `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;
}

/**
 * Generate ECS execute command string without executing it
 */
export function generateExecCommand(
  region: string,
  clusterName: string,
  taskArn: string,
  containerName: string,
  command: string,
): string {
  return `aws ecs execute-command --region ${region} --cluster ${clusterName} --task ${taskArn} --container ${containerName} --command "${command}" --interactive`;
}
