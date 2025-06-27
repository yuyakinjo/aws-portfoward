import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { input, search } from "@inquirer/prompts";
import { isEmpty, isString } from "remeda";
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
import {
  parseClusterName,
  parseContainerName,
  parseRegionName,
  parseTaskArn,
  parseTaskId,
  unwrapBrandedString,
} from "../types.js";
import { askRetry, displayFriendlyError, messages } from "../utils/index.js";
import { displayDryRunResult, generateExecDryRun } from "./dry-run.js";

// UI Configuration constants
const DEFAULT_PAGE_SIZE = 50;

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
  if (options.dryRun) {
    messages.info(
      "Starting AWS ECS execute command tool with Simple UI (DRY RUN)...",
    );
  }

  // selectionsをbranded typesで保持
  const selections: {
    region?: import("../types.js").RegionName;
    cluster?: import("../types.js").ClusterName;
    task?: import("../types.js").TaskId | import("../types.js").TaskArn;
    container?: import("../types.js").ContainerName;
    command?: string;
  } = {};

  // Step 1: Select Region
  const region: import("../types.js").RegionName = options.region
    ? (() => {
        const regionResult = parseRegionName(options.region);
        if (!regionResult.success) throw new Error(regionResult.error);
        return regionResult.data;
      })()
    : await (async () => {
        messages.ui.displayExecSelectionState({
          ...selections,
          region: selections.region ? selections.region : undefined,
        });
        messages.warning("Getting available AWS regions...");
        const regionsResult = await getAWSRegions(
          new EC2Client({ region: "us-east-1" }),
        );
        if (!regionsResult.success) throw new Error(regionsResult.error);
        const regions = regionsResult.data;
        if (isEmpty(regions)) {
          throw new Error("Failed to get AWS regions");
        }
        process.stdout.write("\x1b[1A");
        process.stdout.write("\x1b[2K");
        process.stdout.write("\r");
        const selectedRegion = await search({
          message: "Search and select AWS region:",
          source: async (input) => await searchRegions(regions, input || ""),
          pageSize: DEFAULT_PAGE_SIZE,
        });
        if (!isString(selectedRegion)) {
          throw new Error("Invalid region selection");
        }
        const regionResult = parseRegionName(selectedRegion);
        if (!regionResult.success) throw new Error(regionResult.error);
        return regionResult.data;
      })();
  selections.region = region;
  messages.ui.displayExecSelectionState({
    ...selections,
    region: selections.region
      ? unwrapBrandedString(selections.region)
      : undefined,
  });
  const ecsClient = new ECSClient({ region: unwrapBrandedString(region) });

  // Step 2: Select ECS Cluster
  const selectedCluster: ECSCluster = options.cluster
    ? await (async () => {
        const clusterResult = parseClusterName(options.cluster);
        if (!clusterResult.success) throw new Error(clusterResult.error);
        selections.cluster = clusterResult.data;
        messages.warning("Getting ECS clusters...");
        const clustersResult =
          await getECSClustersWithExecCapability(ecsClient);
        if (!clustersResult.success) throw new Error(clustersResult.error);
        const clusters = clustersResult.data;
        const targetClusterName = clusterResult.data;
        const cluster = clusters.find(
          (c: ECSCluster) => c.clusterName === targetClusterName,
        );
        if (!cluster) {
          throw new Error(
            `ECS cluster not found or does not support exec: ${options.cluster}`,
          );
        }
        return cluster;
      })()
    : await (async () => {
        messages.warning("Getting ECS clusters with exec capability...");
        const clustersResult =
          await getECSClustersWithExecCapability(ecsClient);
        if (!clustersResult.success) throw new Error(clustersResult.error);
        const clusters = clustersResult.data;
        if (isEmpty(clusters)) {
          throw new Error("No ECS clusters found with exec capability");
        }
        process.stdout.write("\x1b[1A");
        process.stdout.write("\x1b[2K");
        process.stdout.write("\r");
        const cluster = await search({
          message: "Search and select ECS cluster:",
          source: async (input) => await searchClusters(clusters, input || ""),
          pageSize: DEFAULT_PAGE_SIZE,
        });

        if (
          !cluster ||
          typeof cluster !== "object" ||
          !("clusterName" in cluster) ||
          !("clusterArn" in cluster)
        ) {
          throw new Error("Invalid cluster selection");
        }
        const clusterNameResult = parseClusterName(cluster.clusterName);
        if (!clusterNameResult.success)
          throw new Error(clusterNameResult.error);
        selections.cluster = clusterNameResult.data;
        return cluster as ECSCluster;
      })();

  messages.ui.displayExecSelectionState({
    ...selections,
    region: selections.region
      ? unwrapBrandedString(selections.region)
      : undefined,
    cluster: selections.cluster
      ? unwrapBrandedString(selections.cluster)
      : undefined,
  });

  // Step 3: Select ECS Task
  const selectedTask: ECSTask = options.task
    ? await (async () => {
        const taskIdResult = parseTaskId(options.task);
        const taskArnResult = parseTaskArn(options.task);
        selections.task = taskIdResult.success
          ? taskIdResult.data
          : taskArnResult.success
            ? taskArnResult.data
            : undefined;
        if (!selections.task)
          throw new Error(`Invalid task id or arn: ${options.task}`);
        messages.warning("Getting ECS tasks...");
        const tasksResult = await getECSTasksWithExecCapability(
          ecsClient,
          selectedCluster,
        );
        if (!tasksResult.success) throw new Error(tasksResult.error);
        const tasks = tasksResult.data;
        const task = tasks.find(
          (t: ECSTask) =>
            (taskIdResult.success && t.taskId === taskIdResult.data) ||
            (taskArnResult.success && t.taskArn === taskArnResult.data),
        );
        if (!task) {
          throw new Error(
            `ECS task not found or does not support exec: ${options.task}`,
          );
        }
        return task;
      })()
    : await (async () => {
        messages.warning("Getting ECS tasks with exec capability...");
        const tasksResult = await getECSTasksWithExecCapability(
          ecsClient,
          selectedCluster,
        );
        if (!tasksResult.success) throw new Error(tasksResult.error);
        const tasks = tasksResult.data;
        if (isEmpty(tasks)) {
          throw new Error(
            "No ECS tasks found with exec capability in this cluster",
          );
        }
        process.stdout.write("\x1b[1A");
        process.stdout.write("\x1b[2K");
        process.stdout.write("\r");
        const selectedTaskArn = await search({
          message: "Search and select ECS task:",
          source: async (input) => await searchTasks(tasks, input || ""),
          pageSize: DEFAULT_PAGE_SIZE,
        });
        if (typeof selectedTaskArn !== "string") {
          throw new Error("Invalid task selection");
        }
        const taskArnResult = parseTaskArn(selectedTaskArn);
        if (!taskArnResult.success) throw new Error(taskArnResult.error);
        const task = tasks.find(
          (t: ECSTask) => t.taskArn === taskArnResult.data,
        );
        if (!task) {
          throw new Error(`Selected task not found: ${selectedTaskArn}`);
        }
        selections.task = task.taskId;
        return task;
      })();

  messages.ui.displayExecSelectionState({
    ...selections,
    region: selections.region
      ? unwrapBrandedString(selections.region)
      : undefined,
    cluster: selections.cluster
      ? unwrapBrandedString(selections.cluster)
      : undefined,
    task: selections.task ? unwrapBrandedString(selections.task) : undefined,
  });

  // Step 4: Select Container
  const selectedContainer: import("../types.js").ContainerName =
    options.container
      ? (() => {
          const containerResult = parseContainerName(options.container);
          if (!containerResult.success) throw new Error(containerResult.error);
          selections.container = containerResult.data;
          return containerResult.data;
        })()
      : await (async () => {
          messages.warning("Getting container list...");
          const containersResult = await getECSTaskContainers({
            ecsClient,
            clusterName: selectedCluster.clusterName,
            taskArn: selectedTask.realTaskArn,
          });
          if (!containersResult.success)
            throw new Error(containersResult.error);
          const containers = containersResult.data;
          if (isEmpty(containers)) {
            throw new Error("No containers found in this task");
          }
          process.stdout.write("\x1b[1A");
          process.stdout.write("\x1b[2K");
          process.stdout.write("\r");
          const selectedContainerName = await search({
            message: "Search and select container:",
            source: async (input) =>
              await searchContainers(
                containers.map((c) => String(c)),
                input || "",
              ),
            pageSize: DEFAULT_PAGE_SIZE,
          });
          if (typeof selectedContainerName !== "string") {
            throw new Error("Invalid container selection");
          }
          const containerResult = parseContainerName(selectedContainerName);
          if (!containerResult.success) throw new Error(containerResult.error);
          const container = containerResult.data;
          selections.container = container;
          return container;
        })();
  messages.ui.displayExecSelectionState({
    ...selections,
    region: selections.region ? selections.region : undefined,
    cluster: selections.cluster ? selections.cluster : undefined,
    task: selections.task ? selections.task : undefined,
    container: selections.container ? selections.container : undefined,
  });

  // Step 5: Specify Command
  const command: string = options.command
    ? (() => {
        selections.command = options.command;
        return options.command;
      })()
    : await (async () => {
        const cmd = await input({
          message: "Enter command to execute:",
          default: "/bin/bash",
        });
        selections.command = cmd;
        return cmd;
      })();

  // Final display with all selections complete
  messages.ui.displayExecSelectionState({
    ...selections,
    region: selections.region
      ? unwrapBrandedString(selections.region)
      : undefined,
    cluster: selections.cluster
      ? unwrapBrandedString(selections.cluster)
      : undefined,
    task: selections.task ? unwrapBrandedString(selections.task) : undefined,
    container: selections.container
      ? unwrapBrandedString(selections.container)
      : undefined,
    command: selections.command,
  });

  // branded typesで渡す
  if (options.dryRun) {
    const dryRunResult = generateExecDryRun({
      region,
      cluster: selectedCluster.clusterName,
      task: selectedTask.taskId,
      container: selectedContainer,
      command,
    });
    displayDryRunResult(dryRunResult);
    messages.success("Dry run completed successfully.");
  } else {
    await executeECSCommand({
      region,
      clusterName: selectedCluster.clusterName,
      taskArn: selectedTask.realTaskArn,
      containerName: selectedContainer,
      command,
    });
  }
}
