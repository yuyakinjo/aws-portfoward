import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { input, search } from "@inquirer/prompts";
import chalk from "chalk";
import { isEmpty } from "remeda";
import {
  getAWSRegions,
  getECSClusters,
  getECSTasks,
  getRDSInstances,
} from "./aws-services.js";
import {
  formatInferenceResult,
  type InferenceResult,
  inferECSTargets,
} from "./inference.js";
import {
  searchClusters,
  searchRDS,
  searchRegions,
  searchTasks,
} from "./search.js";
import { startSSMSession } from "./session.js";
import type {
  ECSCluster,
  RDSInstance,
  ValidatedConnectOptions,
} from "./types.js";
import {
  askRetry,
  displayFriendlyError,
  findAvailablePort,
  getDefaultPortForEngine,
  messages,
} from "./utils/index.js";

function generateReproducibleCommand(
  region: string,
  cluster: string,
  task: string,
  rds: string,
  rdsPort: string,
  localPort: string,
): string {
  return `npx ecs-pf connect --region ${region} --cluster ${cluster} --task ${task} --rds ${rds} --rds-port ${rdsPort} --local-port ${localPort}`;
}

export async function connectToRDS(
  options: ValidatedConnectOptions = {},
): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      await connectToRDSInternal(options);
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

async function connectToRDSInternal(
  options: ValidatedConnectOptions,
): Promise<void> {
  // Initialize EC2 client with default region to get region list
  const defaultEc2Client = new EC2Client({ region: "us-east-1" });

  // Get region
  let region: string;
  if (options.region) {
    region = options.region;
    messages.success(`Region (from CLI): ${region}`);
  } else {
    messages.warning("Getting available AWS regions...");
    const regions = await getAWSRegions(defaultEc2Client);

    if (isEmpty(regions)) {
      throw new Error("Failed to get AWS regions");
    }

    // Select AWS region with zoxide-style real-time search
    messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

    region = await search({
      message: "Search and select AWS region:",
      source: async (input) => {
        return await searchRegions(regions, input || "");
      },
      pageSize: 50,
    });

    // Clear the process messages and show only the result
    messages.clearLines(2); // Clear "Getting regions..." and "filtered as you type"
    messages.success(`Region: ${region}`);
  }

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region });
  const rdsClient = new RDSClient({ region });

  // Get ECS cluster
  let selectedCluster: ECSCluster;
  if (options.cluster) {
    messages.warning("Getting ECS clusters...");
    const clusters = await getECSClusters(ecsClient);
    const cluster = clusters.find((c) => c.clusterName === options.cluster);
    if (!cluster) {
      throw new Error(`ECS cluster not found: ${options.cluster}`);
    }
    selectedCluster = cluster;
    messages.clearAndReplace(`Cluster (from CLI): ${options.cluster}`);
  } else {
    messages.warning("Getting ECS clusters...");
    const clusters = await getECSClusters(ecsClient);

    if (clusters.length === 0) {
      throw new Error("No ECS clusters found");
    }

    // Select ECS cluster with zoxide-style real-time search
    messages.info("filtered as you type (↑↓ to select, Enter to confirm)");

    selectedCluster = (await search({
      message: "Search and select ECS cluster:",
      source: async (input) => {
        return await searchClusters(clusters, input || "");
      },
      pageSize: 50,
    })) as ECSCluster;

    // Clear the process messages and show only the result
    messages.clearLines(2); // Clear "Getting clusters..." and "filtered as you type"
    messages.success(`Cluster: ${selectedCluster.clusterName}`);
  }

  // Get ECS task
  let selectedTask: string;
  if (options.task) {
    selectedTask = options.task;
    messages.success(`Task (from CLI): ${options.task}`);
  } else {
    messages.warning("Getting ECS tasks...");
    const tasks = await getECSTasks(ecsClient, selectedCluster);

    if (tasks.length === 0) {
      throw new Error("No running ECS tasks found");
    }

    // Select ECS task with zoxide-style real-time search
    selectedTask = (await search({
      message: "Search and select ECS task:",
      source: async (input) => {
        return await searchTasks(tasks, input || "");
      },
      pageSize: 50,
    })) as string;

    messages.clearLines(2); // Clear "Getting ECS tasks..." and "filtered as you type"
  }

  // Get RDS instance
  let selectedRDS: RDSInstance;
  if (options.rds) {
    messages.warning("Getting RDS instances...");
    const rdsInstances = await getRDSInstances(rdsClient);
    const rdsInstance = rdsInstances.find(
      (r) => r.dbInstanceIdentifier === options.rds,
    );
    if (!rdsInstance) {
      throw new Error(`RDS instance not found: ${options.rds}`);
    }
    selectedRDS = rdsInstance;
    messages.clearAndReplace(`RDS (from CLI): ${options.rds}`);
  } else {
    messages.warning("Getting RDS instances...");
    const rdsInstances = await getRDSInstances(rdsClient);

    if (rdsInstances.length === 0) {
      throw new Error("No RDS instances found");
    }

    // Select RDS instance with zoxide-style real-time search
    selectedRDS = (await search({
      message: "Search and select RDS instance:",
      source: async (input) => {
        return await searchRDS(rdsInstances, input || "");
      },
      pageSize: 50,
    })) as RDSInstance;

    messages.clearLines(2); // Clear "Getting RDS instances..." and "filtered as you type"
  }

  // Use RDS port automatically
  let rdsPort: string;
  if (options.rdsPort !== undefined) {
    rdsPort = `${options.rdsPort}`;
    messages.success(`RDS Port (from CLI): ${rdsPort}`);
  } else {
    // Automatically use the port from RDS instance, fallback to engine default
    const actualRDSPort = selectedRDS.port;
    const fallbackPort = getDefaultPortForEngine(selectedRDS.engine);
    rdsPort = `${actualRDSPort || fallbackPort}`;
    messages.success(`RDS Port (auto-detected): ${rdsPort}`);
  }

  // Specify local port
  // Automatically find available port starting from 8888
  let localPort: string;
  if (options.localPort !== undefined) {
    localPort = `${options.localPort}`;
    messages.success(`Local Port (from CLI): ${localPort}`);
  } else {
    try {
      const availablePort = await findAvailablePort(8888);
      localPort = `${availablePort}`;
      messages.success(`Local Port (auto-selected): ${localPort}`);
    } catch {
      // Fallback to asking user if automatic port finding fails
      messages.warning(
        "Could not find available port automatically. Please specify manually:",
      );
      localPort = await input({
        message: "Enter local port number:",
        default: "8888",
        validate: (inputValue: string) => {
          const port = parseInt(inputValue || "8888");
          return port > 0 && port < 65536
            ? true
            : "Please enter a valid port number (1-65535)";
        },
      });
    }
  }

  // Generate reproducible command
  const reproducibleCommand = generateReproducibleCommand(
    region,
    selectedCluster.clusterName,
    selectedTask,
    selectedRDS.dbInstanceIdentifier,
    rdsPort,
    localPort,
  );

  // Start SSM session
  messages.info("Selected task:");
  messages.info(selectedTask);
  await startSSMSession(
    selectedTask,
    selectedRDS,
    rdsPort,
    localPort,
    reproducibleCommand,
  );
}

/**
 * New UI workflow with step-by-step selection
 */
export async function connectToRDSWithSimpleUI(
  options: ValidatedConnectOptions = {},
): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      await connectToRDSWithSimpleUIInternal(options);
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

async function connectToRDSWithSimpleUIInternal(
  options: ValidatedConnectOptions,
): Promise<void> {
  // Initialize state object for UI display
  const selections: {
    region?: string;
    rds?: string;
    rdsPort?: string;
    ecsTarget?: string;
    ecsCluster?: string;
    localPort?: string;
  } = {};

  // Initialize EC2 client with default region to get region list
  const defaultEc2Client = new EC2Client({ region: "us-east-1" });

  // Step 1: Select Region
  if (options.region) {
    selections.region = options.region;
  } else {
    // Show initial UI state
    messages.ui.displaySelectionState(selections);

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
  messages.ui.displaySelectionState(selections);

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region: selections.region });
  const rdsClient = new RDSClient({ region: selections.region });

  // Step 2: Select RDS Instance
  let selectedRDS: RDSInstance;
  if (options.rds) {
    selections.rds = options.rds;
    console.log(chalk.yellow("Getting RDS instances..."));
    const rdsInstances = await getRDSInstances(rdsClient);
    const rdsInstance = rdsInstances.find(
      (r) => r.dbInstanceIdentifier === options.rds,
    );
    if (!rdsInstance) {
      throw new Error(`RDS instance not found: ${options.rds}`);
    }
    selectedRDS = rdsInstance;
  } else {
    console.log(chalk.yellow("Getting RDS instances..."));
    const rdsInstances = await getRDSInstances(rdsClient);

    if (rdsInstances.length === 0) {
      throw new Error("No RDS instances found");
    }

    // Clear the loading message
    process.stdout.write("\x1b[1A");
    process.stdout.write("\x1b[2K");
    process.stdout.write("\r");

    selectedRDS = (await search({
      message: "Search and select RDS instance:",
      source: async (input) => {
        return await searchRDS(rdsInstances, input || "");
      },
      pageSize: 15,
    })) as RDSInstance;

    selections.rds = selectedRDS.dbInstanceIdentifier;
  }

  // Step 3: Auto-determine RDS Port
  const actualRDSPort = selectedRDS.port;
  const fallbackPort = getDefaultPortForEngine(selectedRDS.engine);
  const rdsPort = `${actualRDSPort || fallbackPort}`;
  selections.rdsPort = rdsPort;

  // Update UI with RDS and port selection
  messages.ui.displaySelectionState(selections);

  // Step 4: ECS Target Selection with Inference
  console.log(
    chalk.yellow(
      "Finding ECS targets with exec capability that can connect to this RDS...",
    ),
  );
  const inferenceResults = await inferECSTargets(ecsClient, selectedRDS, false);
  let selectedInference: InferenceResult;
  let selectedTask: string;

  if (inferenceResults.length > 0) {
    // Clear the loading message
    process.stdout.write("\x1b[1A");
    process.stdout.write("\x1b[2K");
    process.stdout.write("\r");

    console.log(
      chalk.green(`Found ${inferenceResults.length} potential ECS targets`),
    );
    console.log();

    if (options.cluster && options.task) {
      // Try to find matching inference result
      const matchingResult = inferenceResults.find(
        (result) =>
          result.cluster.clusterName === options.cluster &&
          result.task.taskId === options.task,
      );

      if (matchingResult) {
        selectedInference = matchingResult;
        selectedTask = matchingResult.task.taskArn;
        selections.ecsTarget = matchingResult.task.displayName;
        selections.ecsCluster = matchingResult.cluster.clusterName;
      } else {
        selectedInference = (await search({
          message: "Select ECS target:",
          source: async (input) => {
            return filterInferenceResults(inferenceResults, input || "").map(
              (result) => {
                const isUnavailable = result.reason.includes("接続不可");
                return {
                  name: formatInferenceResult(result),
                  value: result,
                  disabled: isUnavailable
                    ? "Task stopped - Cannot select"
                    : undefined,
                };
              },
            );
          },
          pageSize: 10,
        })) as InferenceResult;
        selectedTask = selectedInference.task.taskArn;
        selections.ecsTarget = selectedInference.task.displayName;
        selections.ecsCluster = selectedInference.cluster.clusterName;
      }
    } else {
      selectedInference = (await search({
        message: "Select ECS target:",
        source: async (input) => {
          return filterInferenceResults(inferenceResults, input || "").map(
            (result) => {
              const isUnavailable = result.reason.includes("接続不可");
              return {
                name: formatInferenceResult(result),
                value: result,
                disabled: isUnavailable
                  ? "Task stopped - Cannot select"
                  : undefined,
              };
            },
          );
        },
        pageSize: 10,
      })) as InferenceResult;
      selectedTask = selectedInference.task.taskArn;
      selections.ecsTarget = selectedInference.task.displayName;
      selections.ecsCluster = selectedInference.cluster.clusterName;
    }
  } else {
    throw new Error(
      "No ECS targets found with exec capability that can connect to this RDS instance",
    );
  }

  // Update UI with ECS target selection
  messages.ui.displaySelectionState(selections);

  // Step 5: Local Port Selection
  if (options.localPort !== undefined) {
    selections.localPort = `${options.localPort}`;
  } else {
    try {
      console.log(chalk.yellow("Finding available local port..."));
      const availablePort = await findAvailablePort(8888);
      selections.localPort = `${availablePort}`;

      // Clear the loading message
      process.stdout.write("\x1b[1A");
      process.stdout.write("\x1b[2K");
      process.stdout.write("\r");
    } catch {
      selections.localPort = await input({
        message: "Enter local port number:",
        default: "8888",
        validate: (inputValue: string) => {
          const port = parseInt(inputValue || "8888");
          return port > 0 && port < 65536
            ? true
            : "Please enter a valid port number (1-65535)";
        },
      });
    }
  }

  // Final display with all selections complete
  messages.ui.displaySelectionState(selections);

  // Generate reproducible command
  const reproducibleCommand = generateReproducibleCommand(
    selections.region || "",
    selections.ecsCluster || selectedInference.cluster.clusterName,
    selectedTask,
    selectedRDS.dbInstanceIdentifier,
    rdsPort,
    selections.localPort || "",
  );

  await startSSMSession(
    selectedTask,
    selectedRDS,
    rdsPort,
    selections.localPort || "",
    reproducibleCommand,
  );
}

/**
 * Filter inference results using space-separated keywords
 * Supports both English and Japanese search terms
 * Searches through cluster name, task name, service name, confidence, and reason
 *
 * Examples:
 * - "prod web" - finds tasks in production clusters with web services
 * - "staging api" - finds staging API tasks
 * - "high" - finds high confidence matches
 * - "medium 中" - finds medium confidence matches (Japanese)
 */
function filterInferenceResults(
  results: InferenceResult[],
  input: string,
): InferenceResult[] {
  if (!input || input.trim() === "") {
    return results;
  }

  // Split input into keywords and convert to lowercase
  const keywords = input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((keyword) => keyword.length > 0);

  if (keywords.length === 0) {
    return results;
  }

  return results.filter((result) => {
    // Create searchable text combining multiple fields
    const searchableText = [
      result.cluster.clusterName,
      result.task.displayName,
      result.task.serviceName,
      result.task.taskStatus,
      result.task.runtimeId,
      result.confidence,
      result.method,
      result.reason,
      formatInferenceResult(result),
      // Add confidence levels for easier searching
      result.confidence === "high" ? "high 高" : "",
      result.confidence === "medium" ? "medium 中" : "",
      result.confidence === "low" ? "low 低" : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // All keywords must be found in the searchable text
    return keywords.every((keyword) => searchableText.includes(keyword));
  });
}
