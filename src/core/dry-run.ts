import { safeParse } from "valibot";
import {
  type ClusterName,
  type ContainerName,
  type DryRunResult,
  type Port,
  type RDSInstance,
  type RegionName,
  type TaskArn,
  TaskArnSchema,
  type TaskId,
} from "../types.js";
import { messages } from "../utils/messages.js";
import { VERSION } from "../version.js";
import { generateReproducibleCommand } from "./command-generation.js";

export function displayDryRunResult(result: DryRunResult): void {
  messages.dryRun.header();
  messages.dryRun.awsCommand(result.awsCommand);
  messages.dryRun.reproducibleCommand(result.reproducibleCommand);
  // Convert branded types to strings
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
  });
}

export function generateConnectDryRun(
  region: RegionName,
  cluster: ClusterName,
  task: TaskId,
  rdsInstance: RDSInstance,
  rdsPort: Port,
  localPort: Port,
): DryRunResult {
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
    portNumber: [rdsPort],
    localPortNumber: [localPort],
  };
  const parametersJson = JSON.stringify(parameters);
  const awsCommand = `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;

  // Generate reproducible command
  const reproducibleCommand = generateReproducibleCommand(
    region,
    cluster,
    taskArn,
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
      task: taskArn,
      rds: rdsInstance.dbInstanceIdentifier,
      rdsPort,
      localPort,
    },
  };
}

export function generateExecDryRun(
  region: RegionName,
  cluster: ClusterName,
  task: TaskId,
  container: ContainerName,
  command: string,
): DryRunResult {
  // Convert TaskId to TaskArn format for ECS execute command
  const taskArnForECS = task as unknown as TaskArn;

  // Generate ECS execute command
  const awsCommand = `aws ecs execute-command --region ${String(region)} --cluster ${String(cluster)} --task ${String(task)} --container ${String(container)} --command "${command}" --interactive`;

  // Generate reproducible command
  const reproducibleCommand = `npx ecs-pf@${VERSION} exec-task --region ${String(region)} --cluster ${String(cluster)} --task ${String(task)} --container ${String(container)} --command "${command}"`;

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
