import type { DryRunResult, RDSInstance } from "../types.js";
import { messages } from "../utils/messages.js";
import { VERSION } from "../version.js";
import { generateReproducibleCommand } from "./command-generation.js";

/**
 * Display dry run results in a formatted way using messages.dryRun
 */
export function displayDryRunResult(result: DryRunResult): void {
  messages.dryRun.header();
  messages.dryRun.awsCommand(result.awsCommand);
  messages.dryRun.reproducibleCommand(result.reproducibleCommand);
  messages.dryRun.sessionInfo(result.sessionInfo);
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
