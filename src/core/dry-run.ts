import { safeParse } from "valibot";
import {
  type ConnectDryRunParams,
  type DryRunResult,
  type ExecDryRunParams,
  type TaskArn,
  TaskArnSchema,
} from "../types.js";
import { messages } from "../utils/messages.js";
import { VERSION } from "../version.js";
import { generateReproducibleCommand } from "./command-generation.js";

export function displayDryRunResult(result: DryRunResult): void {
  messages.dryRun.header();
  messages.dryRun.awsCommand(result.awsCommand);
  messages.dryRun.reproducibleCommand(result.reproducibleCommand);
  // Convert branded types to strings only for display
  messages.dryRun.sessionInfo({
    ...result.sessionInfo,
    region: result.sessionInfo.region,
    cluster: result.sessionInfo.cluster,
    task: result.sessionInfo.task,
    rds: result.sessionInfo.rds ? result.sessionInfo.rds : undefined,
    rdsPort: result.sessionInfo.rdsPort
      ? String(result.sessionInfo.rdsPort)
      : undefined,
    localPort: result.sessionInfo.localPort
      ? String(result.sessionInfo.localPort)
      : undefined,
    container: result.sessionInfo.container
      ? String(result.sessionInfo.container)
      : undefined,
    command: result.sessionInfo.command,
  });
}

export function generateConnectDryRun(
  params: ConnectDryRunParams,
): DryRunResult {
  const { region, cluster, task, rdsInstance, rdsPort, localPort } = params;

  // Generate SSM command - Convert TaskId to TaskArn format for SSM
  const { output: taskArn, success } = safeParse(
    TaskArnSchema,
    `ecs:${cluster}_${task}_${task}`,
  );
  if (!success) {
    throw new Error(
      `Invalid TaskId format: ${task}. Expected format: ecs:<cluster>_<task>_<task>`,
    );
  }
  const parameters = {
    host: [rdsInstance.endpoint],
    portNumber: [String(rdsPort)],
    localPortNumber: [String(localPort)],
  };
  const parametersJson = JSON.stringify(parameters);
  const awsCommand = `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;

  // Generate reproducible command
  const reproducibleCommand = generateReproducibleCommand({
    region,
    cluster,
    task: taskArn,
    rds: rdsInstance.dbInstanceIdentifier,
    rdsPort,
    localPort,
  });

  return {
    awsCommand,
    reproducibleCommand,
    sessionInfo: {
      region,
      cluster,
      task: taskArn,
      rds: rdsInstance.dbInstanceIdentifier,
      rdsPort,
      localPort,
    },
  };
}

export function generateExecDryRun(params: ExecDryRunParams): DryRunResult {
  const { region, cluster, task, container, command } = params;

  // Convert TaskId to TaskArn format for ECS execute command
  const taskArnForECS = task as unknown as TaskArn;

  // Generate ECS execute command - convert to strings only at output boundary
  const awsCommand = `aws ecs execute-command --region ${region} --cluster ${cluster} --task ${task} --container ${container} --command "${command}" --interactive`;

  // Generate reproducible command
  const reproducibleCommand = `npx ecs-pf@${VERSION} exec-task --region ${region} --cluster ${cluster} --task ${task} --container ${container} --command "${command}"`;

  return {
    awsCommand,
    reproducibleCommand,
    sessionInfo: {
      region,
      cluster,
      task: taskArnForECS,
      container,
      command,
    },
  };
}
