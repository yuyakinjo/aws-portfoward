import type { ValidatedExecOptions } from "./types.js";
import { messages } from "./utils/index.js";
import { VERSION } from "./version.js";

/**
 * Execute command in ECS task container (direct execution with provided options)
 */
export async function execECSTask(
  options: ValidatedExecOptions,
): Promise<void> {
  // Validate that all required options are provided
  if (
    !options.region ||
    !options.cluster ||
    !options.task ||
    !options.container
  ) {
    messages.error(
      "All required options must be provided for direct execution",
    );
    messages.info("Required options: --region, --cluster, --task, --container");
    messages.info("Or use 'exec-task-ui' for interactive selection");
    throw new Error("Missing required options for direct execution");
  }

  // Set default command if not provided
  const command = options.command || "/bin/bash";

  messages.info(`Executing command in ECS task container...`);
  messages.info(`Region: ${options.region}`);
  messages.info(`Cluster: ${options.cluster}`);
  messages.info(`Task: ${options.task}`);
  messages.info(`Container: ${options.container}`);
  messages.info(`Command: ${command}`);

  // Generate reproducible command
  const reproducibleCmd = [
    `npx ecs-pf@${VERSION} exec-task`,
    `--region "${options.region}"`,
    `--cluster "${options.cluster}"`,
    `--task "${options.task}"`,
    `--container "${options.container}"`,
    `--command "${command}"`,
  ].join(" ");

  // Import required functions
  const { executeECSCommand } = await import("./session.js");

  // Execute the command directly
  await executeECSCommand(
    options.region,
    options.cluster,
    options.task,
    options.container,
    command,
    reproducibleCmd,
  );
}

/**
 * Execute command in ECS task container with Simple UI
 */
export async function execECSTaskWithSimpleUI(
  options: ValidatedExecOptions = {},
): Promise<void> {
  // Dynamic import to avoid circular dependency
  const { execECSTaskWithSimpleUIInternal } = await import(
    "./core/exec-ui-flow.js"
  );
  await execECSTaskWithSimpleUIInternal(options);
}
