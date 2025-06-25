import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { input, search } from "@inquirer/prompts";
import chalk from "chalk";
import { isEmpty } from "remeda";
import {
  getAWSRegions,
  getECSClustersWithExecCapability,
  getECSTaskContainers,
  getECSTasksWithExecCapability,
} from "../aws-services.js";
import {
  searchClusters,
  searchContainers,
  searchRegions,
  searchTasks,
} from "../search.js";
import { executeECSCommand } from "../session.js";
import type { ECSCluster, ECSTask, ValidatedExecOptions } from "../types.js";
import { askRetry, displayFriendlyError, messages } from "../utils/index.js";
import { displayDryRunResult, generateExecDryRun } from "./dry-run.js";

/**
 * Execute command in ECS task container with Simple UI workflow
 */
export async function execECSTaskWithSimpleUIInternal(
  options: ValidatedExecOptions,
): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      await execECSTaskWithSimpleUIFlow(options);
      return; // Exit if successful
    } catch (error) {
      retryCount++;

      displayFriendlyError(error);

      if (retryCount <= maxRetries) {
        messages.warning(`Retry count: ${retryCount}/${maxRetries + 1}`);
        const shouldRetry = await askRetry();

        if (!shouldRetry) {
          messages.info("Process interrupted");
          return;
        }

        messages.info("Retrying...\n");
      } else {
        messages.error("Maximum retry count reached. Terminating process.");
        messages.gray(
          "If the problem persists, please check the above solutions.",
        );
        throw error;
      }
    }
  }
}

async function execECSTaskWithSimpleUIFlow(
  options: ValidatedExecOptions,
): Promise<void> {
  // Check if dry run mode is enabled and show appropriate message
  if (options.dryRun) {
    messages.info(
      "Starting AWS ECS execute command tool with Simple UI (DRY RUN)...",
    );
  }

  // Initialize state object for UI display
  const selections: {
    region?: string;
    cluster?: string;
    task?: string;
    container?: string;
    command?: string;
  } = {};

  // Initialize EC2 client with default region to get region list
  const defaultEc2Client = new EC2Client({ region: "us-east-1" });

  // Step 1: Select Region
  if (options.region) {
    selections.region = options.region;
  } else {
    // Show initial UI state
    messages.ui.displayExecSelectionState(selections);

    console.log(chalk.yellow("Getting available AWS regions..."));
    const regions = await getAWSRegions(defaultEc2Client);

    if (isEmpty(regions)) {
      throw new Error("Failed to get AWS regions");
    }

    // Clear the loading message and show search prompt
    process.stdout.write("\x1b[1A"); // Move cursor up
    process.stdout.write("\x1b[2K"); // Clear line
    process.stdout.write("\r"); // Move to start

    selections.region = await search({
      message: "Search and select AWS region:",
      source: async (input) => {
        return await searchRegions(regions, input || "");
      },
      pageSize: 15,
    });
  }

  // Update UI with region selection
  messages.ui.displayExecSelectionState(selections);

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region: selections.region });

  // Step 2: Select ECS Cluster
  let selectedCluster: ECSCluster;
  if (options.cluster) {
    selections.cluster = options.cluster;
    console.log(chalk.yellow("Getting ECS clusters..."));
    const clusters = await getECSClustersWithExecCapability(ecsClient);
    const cluster = clusters.find((c) => c.clusterName === options.cluster);
    if (!cluster) {
      throw new Error(
        `ECS cluster not found or does not support exec: ${options.cluster}`,
      );
    }
    selectedCluster = cluster;
  } else {
    console.log(chalk.yellow("Getting ECS clusters with exec capability..."));
    const clusters = await getECSClustersWithExecCapability(ecsClient);

    if (clusters.length === 0) {
      throw new Error("No ECS clusters found with exec capability");
    }

    // Clear the loading message
    process.stdout.write("\x1b[1A");
    process.stdout.write("\x1b[2K");
    process.stdout.write("\r");

    selectedCluster = (await search({
      message: "Search and select ECS cluster:",
      source: async (input) => {
        const results = await searchClusters(clusters, input || "");
        return results;
      },
      pageSize: 15,
    })) as ECSCluster;

    selections.cluster = selectedCluster.clusterName;
  }

  // Update UI with cluster selection
  messages.ui.displayExecSelectionState(selections);

  // Step 3: Select ECS Task
  let selectedTask: ECSTask | undefined;
  if (options.task) {
    selections.task = options.task;
    console.log(chalk.yellow("Getting ECS tasks..."));
    const tasks = await getECSTasksWithExecCapability(
      ecsClient,
      selectedCluster,
    );
    const task = tasks.find(
      (t) => t.taskId === options.task || t.taskArn === options.task,
    );
    if (!task) {
      throw new Error(
        `ECS task not found or does not support exec: ${options.task}`,
      );
    }
    selectedTask = task;
  } else {
    console.log(chalk.yellow("Getting ECS tasks with exec capability..."));
    const tasks = await getECSTasksWithExecCapability(
      ecsClient,
      selectedCluster,
    );

    if (tasks.length === 0) {
      throw new Error(
        "No ECS tasks found with exec capability in this cluster",
      );
    }

    // Clear the loading message
    process.stdout.write("\x1b[1A");
    process.stdout.write("\x1b[2K");
    process.stdout.write("\r");

    const selectedTaskArn = await search({
      message: "Search and select ECS task:",
      source: async (input) => {
        const results = await searchTasks(tasks, input || "");
        return results;
      },
      pageSize: 15,
    });

    selectedTask = tasks.find((t) => t.taskArn === selectedTaskArn);
    if (!selectedTask) {
      throw new Error(`Selected task not found: ${selectedTaskArn}`);
    }

    selections.task = selectedTask.taskId;
  }

  // Update UI with task selection
  messages.ui.displayExecSelectionState(selections);

  // Step 4: Select Container
  if (!selectedTask) {
    throw new Error("No task selected");
  }

  let selectedContainer: string;
  if (options.container) {
    selections.container = options.container;
    selectedContainer = options.container;
  } else {
    console.log(chalk.yellow("Getting container list..."));
    const containers = await getECSTaskContainers(
      ecsClient,
      selectedCluster.clusterName,
      selectedTask.realTaskArn,
    );

    if (containers.length === 0) {
      throw new Error("No containers found in this task");
    }

    // Clear the loading message
    process.stdout.write("\x1b[1A");
    process.stdout.write("\x1b[2K");
    process.stdout.write("\r");

    selectedContainer = await search({
      message: "Search and select container:",
      source: async (input) => {
        const results = await searchContainers(containers, input || "");
        return results;
      },
      pageSize: 15,
    });

    selections.container = selectedContainer;
  }

  // Update UI with container selection
  messages.ui.displayExecSelectionState(selections);

  // Step 5: Specify Command
  let command: string;
  if (options.command) {
    selections.command = options.command;
    command = options.command;
  } else {
    command = await input({
      message: "Enter command to execute:",
      default: "/bin/bash",
    });
    selections.command = command;
  }

  // Final display with all selections complete
  messages.ui.displayExecSelectionState(selections);

  // Check if dry run mode is enabled
  if (options.dryRun) {
    // Generate and display dry run result
    const dryRunResult = generateExecDryRun(
      selections.region || "",
      selectedCluster.clusterName,
      selectedTask.realTaskArn,
      selectedContainer,
      command,
    );

    displayDryRunResult(dryRunResult);
    messages.success("Dry run completed successfully.");
  } else {
    // Execute the command
    await executeECSCommand(
      selections.region || "",
      selectedCluster.clusterName,
      selectedTask.realTaskArn,
      selectedContainer,
      command,
    );
  }
}
