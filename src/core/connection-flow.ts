import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import {
  formatInferenceResult,
  type InferenceResult,
  inferECSTargets,
} from "../inference.js";
import { startSSMSession } from "../session.js";
import type {
  ECSTask,
  RDSInstance,
  ValidatedConnectOptions,
} from "../types.js";
import {
  askRetry,
  displayFriendlyError,
  getDefaultPortForEngine,
  messages,
} from "../utils/index.js";
import { generateReproducibleCommand } from "./command-generation.js";
import {
  selectCluster,
  selectRDSInstance,
  selectRegion,
  selectTask,
} from "./resource-selection.js";
import {
  promptForInferenceResult,
  promptForLocalPort,
} from "./user-prompts.js";

/**
 * Main entry point for RDS connection workflow (manual selection)
 */
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
        messages.warning(`🔄 Retry count: ${retryCount}/${maxRetries + 1}`);
        const shouldRetry = await askRetry();

        if (!shouldRetry) {
          messages.info("👋 Process interrupted");
          return;
        }

        messages.info("🔄 Retrying...\n");
      } else {
        messages.error("❌ Maximum retry count reached. Terminating process.");
        messages.gray(
          "💡 If the problem persists, please check the above solutions.",
        );
        throw error;
      }
    }
  }
}

/**
 * Internal implementation for RDS connection workflow
 */
async function connectToRDSInternal(
  options: ValidatedConnectOptions,
): Promise<void> {
  // Get region
  const region = await selectRegion(options);

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region });
  const rdsClient = new RDSClient({ region });

  // Get ECS cluster
  const selectedCluster = await selectCluster(ecsClient, options);
  messages.success(`✅ Cluster: ${selectedCluster.clusterName}`);

  // Get ECS task
  const selectedTask = await selectTask(ecsClient, selectedCluster, options);
  messages.success(`✅ Task: ${selectedTask}`);

  // Get RDS instance
  messages.warning("🔍 Getting RDS instances...");
  const selectedRDS = await selectRDSInstance(rdsClient, options);
  messages.success(`✅ RDS: ${selectedRDS.dbInstanceIdentifier}`);

  // Use RDS port automatically
  let rdsPort: string;
  if (options.rdsPort !== undefined) {
    rdsPort = `${options.rdsPort}`;
    messages.success(`✅ RDS Port (from CLI): ${rdsPort}`);
  } else {
    // Automatically use the port from RDS instance, fallback to engine default
    const actualRDSPort = selectedRDS.port;
    const fallbackPort = getDefaultPortForEngine(selectedRDS.engine);
    rdsPort = `${actualRDSPort || fallbackPort}`;
    messages.success(`✅ RDS Port (auto-detected): ${rdsPort}`);
  }

  // Specify local port
  let localPort: string;
  if (options.localPort !== undefined) {
    localPort = `${options.localPort}`;
    messages.success(`✅ Local Port (from CLI): ${localPort}`);
  } else {
    localPort = await promptForLocalPort();
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
  messages.success("🚀 Starting port forwarding session...");
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
 * RDS-first workflow with ECS inference
 */
export async function connectToRDSWithInference(
  options: ValidatedConnectOptions = {},
): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount <= maxRetries) {
    try {
      await connectToRDSWithInferenceInternal(options);
      return; // Exit if successful
    } catch (error) {
      retryCount++;

      displayFriendlyError(error);

      if (retryCount <= maxRetries) {
        messages.warning(`🔄 Retry count: ${retryCount}/${maxRetries + 1}`);
        const shouldRetry = await askRetry();

        if (!shouldRetry) {
          messages.info("👋 Process interrupted");
          return;
        }

        messages.info("🔄 Retrying...\n");
      } else {
        messages.error("❌ Maximum retry count reached. Terminating process.");
        messages.gray(
          "💡 If the problem persists, please check the above solutions.",
        );
        throw error;
      }
    }
  }
}

/**
 * Internal implementation for RDS connection with inference workflow
 */
async function connectToRDSWithInferenceInternal(
  options: ValidatedConnectOptions,
): Promise<void> {
  // Get region
  const region = await selectRegion(options);
  // リージョン重複表示を削除
  // messages.success(`✅ Region: ${region}`);

  // Initialize AWS clients
  const ecsClient = new ECSClient({ region });
  const rdsClient = new RDSClient({ region });

  // Step 1: Select RDS instance first
  const selectedRDS = await selectRDSInstance(rdsClient, options);
  messages.success(`✅ RDS: ${selectedRDS.dbInstanceIdentifier}`);

  const inferenceStartTime = performance.now();
  const inferenceResults = await inferECSTargets(ecsClient, selectedRDS, false); // パフォーマンス追跡を無効化
  const inferenceEndTime = performance.now();
  const inferenceDuration = Math.round(inferenceEndTime - inferenceStartTime);

  let selectedInference: InferenceResult;
  let selectedTask: string;

  if (inferenceResults.length > 0) {
    // Show simple inference results summary
    messages.success(
      `✨ Found ${inferenceResults.length} ECS targets in ${inferenceDuration}ms`,
    );
    console.log();

    // Show brief summary of inference results
    const highConfidenceResults = inferenceResults.filter(
      (r) => r.confidence === "high",
    );
    const mediumConfidenceResults = inferenceResults.filter(
      (r) => r.confidence === "medium",
    );
    const lowConfidenceResults = inferenceResults.filter(
      (r) => r.confidence === "low",
    );

    // Show simple summary
    const validLowCount = lowConfidenceResults.filter(
      (r) => !r.reason.includes("接続不可"),
    ).length;
    const invalidLowCount = lowConfidenceResults.filter((r) =>
      r.reason.includes("接続不可"),
    ).length;

    console.log(`📊 Found ${inferenceResults.length} ECS targets:`);
    if (highConfidenceResults.length > 0) {
      console.log(`   🎯 High confidence: ${highConfidenceResults.length}個`);
    }
    if (mediumConfidenceResults.length > 0) {
      console.log(
        `   ⭐ Medium confidence: ${mediumConfidenceResults.length}個`,
      );
    }
    if (validLowCount > 0) {
      console.log(
        `   🔧 Low confidence: ${validLowCount}個${invalidLowCount > 0 ? ` (${invalidLowCount}個停止中)` : ""}`,
      );
    }

    // Show recommendation
    const recommendedResult = inferenceResults[0];
    if (recommendedResult) {
      console.log(
        `🎯 \x1b[1m\x1b[36mRecommended\x1b[0m: ${recommendedResult.cluster.clusterName} → ${recommendedResult.task.displayName} (${recommendedResult.confidence} confidence)`,
      );
    }
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
        messages.success(
          `✅ Using CLI specified target: ${formatInferenceResult(matchingResult)}`,
        );
      } else {
        // CLI options don't match inference, show warning and let user choose
        messages.warning(
          `⚠️ CLI specified cluster/task not found in recommendations. Showing all options:`,
        );
        selectedInference = await promptForInferenceResult(inferenceResults);
        selectedTask = selectedInference.task.taskArn;
      }
    } else {
      // Let user choose from recommendations
      selectedInference = await promptForInferenceResult(inferenceResults);
      selectedTask = selectedInference.task.taskArn;
    }

    messages.success(
      `✅ Selected: ${formatInferenceResult(selectedInference)}`,
    );
    messages.info(`📝 Reason: ${selectedInference.reason}`);
  } else {
    // No inference results, fall back to manual selection
    messages.warning(
      "⚠️ No specific recommendations found. Manual selection required.",
    );

    // Get ECS cluster manually
    const selectedCluster = await selectCluster(ecsClient, options);
    messages.success(`✅ Cluster: ${selectedCluster.clusterName}`);

    // Get ECS task manually
    selectedTask = await selectTask(ecsClient, selectedCluster, options);
    messages.success(`✅ Task: ${selectedTask}`);

    // Create a dummy inference result for consistency
    const dummyTask: ECSTask = {
      taskArn: selectedTask,
      displayName: "Manual selection",
      runtimeId: "",
      taskId: selectedTask.split("/").pop() || selectedTask,
      clusterName: selectedCluster.clusterName,
      serviceName: "manual",
      taskStatus: "RUNNING",
    };

    selectedInference = {
      cluster: selectedCluster,
      task: dummyTask,
      confidence: "low",
      method: "network",
      score: 0,
      reason: "Manual selection (no inference available)",
    };
  }

  // Continue with the rest of the flow (RDS port, local port, session)
  // Use RDS port automatically
  let rdsPort: string;
  if (options.rdsPort !== undefined) {
    rdsPort = `${options.rdsPort}`;
    messages.success(`✅ RDS Port (from CLI): ${rdsPort}`);
  } else {
    const actualRDSPort = selectedRDS.port;
    const fallbackPort = getDefaultPortForEngine(selectedRDS.engine);
    rdsPort = `${actualRDSPort || fallbackPort}`;
    messages.success(`✅ RDS Port (auto-detected): ${rdsPort}`);
  }

  // Specify local port
  let localPort: string;
  if (options.localPort !== undefined) {
    localPort = `${options.localPort}`;
    messages.success(`✅ Local Port (from CLI): ${localPort}`);
  } else {
    localPort = await promptForLocalPort();
  }

  // Generate reproducible command
  const reproducibleCommand = generateReproducibleCommand(
    region,
    selectedInference.cluster.clusterName,
    selectedTask,
    selectedRDS.dbInstanceIdentifier,
    rdsPort,
    localPort,
  );

  // Start SSM session with beautiful connection details
  await displayConnectionDetails(selectedRDS, selectedInference, localPort);

  await startSSMSession(
    selectedTask,
    selectedRDS,
    rdsPort,
    localPort,
    reproducibleCommand,
  );
}

/**
 * Display beautiful connection details
 */
async function displayConnectionDetails(
  selectedRDS: RDSInstance,
  selectedInference: InferenceResult,
  localPort: string,
): Promise<void> {
  messages.success("🚀 Starting port forwarding session...");

  // Calculate connection establishment time
  const connectionStartTime = performance.now();

  // Display connection information in a beautiful format
  console.log();
  console.log("🎉 \x1b[1m\x1b[32mConnection Established!\x1b[0m");
  console.log("┌──────────────────────────────────────────────┐");
  console.log("│  🔗 \x1b[1mConnection Details\x1b[0m                    │");
  console.log("├──────────────────────────────────────────────┤");
  console.log(`│  Host: \x1b[36mlocalhost\x1b[0m                        │`);
  console.log(
    `│  Port: \x1b[36m${localPort}\x1b[0m                              │`,
  );
  console.log(
    `│  Database: \x1b[36m${selectedRDS.dbInstanceIdentifier}\x1b[0m              │`,
  );
  console.log(
    `│  Engine: \x1b[36m${selectedRDS.engine}\x1b[0m                     │`,
  );
  console.log(
    `│  Target: \x1b[36m${selectedInference.cluster.clusterName}\x1b[0m → \x1b[36m${selectedInference.task.displayName}\x1b[0m │`,
  );
  console.log("└──────────────────────────────────────────────┘");
  console.log();

  const connectionTime = Math.round(performance.now() - connectionStartTime);
  console.log(`⏰ \x1b[1mConnection time\x1b[0m: ${connectionTime}ms`);
  console.log(
    `🛡️  \x1b[1mSecurity\x1b[0m: AWS IAM authentication + VPC internal communication`,
  );
  console.log();

  // Show database connection examples
  console.log("💡 \x1b[1mDatabase connection examples:\x1b[0m");
  if (selectedRDS.engine.includes("postgres")) {
    console.log(
      `   PostgreSQL: \x1b[33mpsql -h localhost -p ${localPort} -U [username] -d [database]\x1b[0m`,
    );
    console.log(
      `   Connection String: \x1b[33mpostgresql://[user]:[pass]@localhost:${localPort}/[db]\x1b[0m`,
    );
  } else if (selectedRDS.engine.includes("mysql")) {
    console.log(
      `   MySQL: \x1b[33mmysql -h localhost -P ${localPort} -u [username] -p\x1b[0m`,
    );
    console.log(
      `   Connection String: \x1b[33mmysql://[user]:[pass]@localhost:${localPort}/[db]\x1b[0m`,
    );
  }
  console.log();
  console.log("✨ \x1b[1mPress Ctrl+C to disconnect\x1b[0m");
  console.log();
}
