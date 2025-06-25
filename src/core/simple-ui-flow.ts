import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { input, search } from "@inquirer/prompts";
import chalk from "chalk";
import { isDefined, isEmpty } from "remeda";
import { getAWSRegions, getRDSInstances } from "../aws-services.js";
import { type InferenceResult, inferECSTargets } from "../inference/index.js";
import { searchInferenceResults, searchRDS, searchRegions } from "../search.js";
import { startSSMSession } from "../session.js";
import type { RDSInstance, ValidatedConnectOptions } from "../types.js";
import {
  askRetry,
  displayFriendlyError,
  findAvailablePort,
  getDefaultPortForEngine,
  messages,
} from "../utils/index.js";
import { generateReproducibleCommand } from "./command-generation.js";
import { displayDryRunResult, generateConnectDryRun } from "./dry-run.js";

/**
 * Simple UI workflow with step-by-step selection
 */
export async function connectToRDSWithSimpleUI(
  options: ValidatedConnectOptions = { dryRun: false },
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
  // Check if dry run mode is enabled and show appropriate message
  if (options.dryRun) {
    messages.info(
      "Starting AWS ECS RDS connection tool with Simple UI (DRY RUN)...",
    );
  } else {
    messages.info("Starting AWS ECS RDS connection tool with Simple UI...");
  }

  // Show CLI arguments if provided
  const cliArgs = [];
  if (options.region) cliArgs.push(`--region ${options.region}`);
  if (options.cluster) cliArgs.push(`--cluster ${options.cluster}`);
  if (options.task) cliArgs.push(`--task ${options.task}`);
  if (options.rds) cliArgs.push(`--rds ${options.rds}`);
  if (options.rdsPort) cliArgs.push(`--rds-port ${options.rdsPort}`);
  if (options.localPort) cliArgs.push(`--local-port ${options.localPort}`);

  if (cliArgs.length > 0) {
    messages.info(`CLI arguments: ${cliArgs.join(" ")}`);
  }

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
    messages.success(`✓ Region (from CLI): ${options.region}`);
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

    selections.region = (await search({
      message: "Search and select AWS region:",
      source: async (input) => {
        return await searchRegions(regions, input || "");
      },
      pageSize: 50,
    })) as string;
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
    messages.success(`✓ RDS (from CLI): ${options.rds}`);
    messages.info("Validating RDS instance...");
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
      pageSize: 50,
    })) as RDSInstance;

    selections.rds = selectedRDS.dbInstanceIdentifier;
  }

  // Step 3: Determine RDS Port
  let rdsPort: string;
  if (options.rdsPort) {
    rdsPort = `${options.rdsPort}`;
    selections.rdsPort = rdsPort;
    messages.success(`✓ RDS port (from CLI): ${options.rdsPort}`);
  } else {
    const actualRDSPort = selectedRDS.port;
    const fallbackPort = getDefaultPortForEngine(selectedRDS.engine);
    rdsPort = `${actualRDSPort || fallbackPort}`;
    selections.rdsPort = rdsPort;
    messages.success(`✓ RDS port (auto-detected): ${rdsPort}`);
  }

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
    messages.empty();

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
        selections.ecsTarget = matchingResult.task.serviceName;
        selections.ecsCluster = matchingResult.cluster.clusterName;
        messages.success(`✓ ECS cluster (from CLI): ${options.cluster}`);
        messages.success(`✓ ECS task (from CLI): ${options.task}`);
      } else {
        messages.warning(
          `Specified cluster/task not found in inference results`,
        );
        selectedInference = (await search({
          message: "Select ECS target:",
          source: async (input) => {
            return await searchInferenceResults(inferenceResults, input || "");
          },
          pageSize: 10,
        })) as InferenceResult;
        selectedTask = selectedInference.task.taskArn;
        selections.ecsTarget = selectedInference.task.serviceName;
        selections.ecsCluster = selectedInference.cluster.clusterName;
      }
    } else {
      selectedInference = (await search({
        message: "Select ECS target:",
        source: async (input) => {
          return await searchInferenceResults(inferenceResults, input || "");
        },
        pageSize: 10,
      })) as InferenceResult;
      selectedTask = selectedInference.task.taskArn;
      selections.ecsTarget = selectedInference.task.serviceName;
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
  if (isDefined(options.localPort)) {
    selections.localPort = `${options.localPort}`;
    messages.success(`✓ Local port (from CLI): ${options.localPort}`);
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

  // Check if dry run mode is enabled
  if (options.dryRun) {
    // Generate and display dry run result
    const dryRunResult = generateConnectDryRun(
      selections.region || "",
      selections.ecsCluster || selectedInference.cluster.clusterName,
      selectedTask,
      selectedRDS,
      rdsPort,
      selections.localPort || "",
    );

    displayDryRunResult(dryRunResult);
    messages.success("Dry run completed successfully.");
  } else {
    await startSSMSession(
      selectedTask,
      selectedRDS,
      rdsPort,
      selections.localPort || "",
      reproducibleCommand,
    );
  }
}
