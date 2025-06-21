import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { input, search } from "@inquirer/prompts";
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
	ECSTask,
	RDSInstance,
	ValidatedConnectOptions,
} from "./types.js";
import {
	askRetry,
	displayFriendlyError,
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

async function connectToRDSInternal(
	options: ValidatedConnectOptions,
): Promise<void> {
	messages.warning("📋 Checking AWS configuration...");

	// Initialize EC2 client with default region to get region list
	const defaultEc2Client = new EC2Client({ region: "us-east-1" });

	// Get region
	let region: string;
	if (options.region) {
		region = options.region;
		messages.success(`✅ Region (from CLI): ${region}`);
	} else {
		messages.warning("🌍 Getting available AWS regions...");
		const regions = await getAWSRegions(defaultEc2Client);

		if (isEmpty(regions)) {
			throw new Error("Failed to get AWS regions");
		}

		// Select AWS region with zoxide-style real-time search
		messages.info(
			"💡 zoxide-style: List is filtered as you type (↑↓ to select, Enter to confirm)",
		);

		region = await search({
			message: "🌍 Search and select AWS region:",
			source: async (input) => {
				return await searchRegions(regions, input || "");
			},
			pageSize: 50,
		});
		messages.success(`✅ Region: ${region}`);
	}

	// Initialize AWS clients
	const ecsClient = new ECSClient({ region });
	const rdsClient = new RDSClient({ region });

	// Get ECS cluster
	let selectedCluster: ECSCluster;
	if (options.cluster) {
		messages.warning("🔍 Getting ECS clusters...");
		const clusters = await getECSClusters(ecsClient);
		const cluster = clusters.find((c) => c.clusterName === options.cluster);
		if (!cluster) {
			throw new Error(`ECS cluster not found: ${options.cluster}`);
		}
		selectedCluster = cluster;
		messages.success(`✅ Cluster (from CLI): ${options.cluster}`);
	} else {
		messages.warning("🔍 Getting ECS clusters...");
		const clusters = await getECSClusters(ecsClient);

		if (clusters.length === 0) {
			throw new Error("No ECS clusters found");
		}

		// Select ECS cluster with zoxide-style real-time search
		messages.info(
			"💡 zoxide-style: List is filtered as you type (↑↓ to select, Enter to confirm)",
		);

		selectedCluster = (await search({
			message: "🔍 Search and select ECS cluster:",
			source: async (input) => {
				return await searchClusters(clusters, input || "");
			},
			pageSize: 50,
		})) as ECSCluster;
	}

	// Get ECS task
	let selectedTask: string;
	if (options.task) {
		selectedTask = options.task;
		messages.success(`✅ Task (from CLI): ${options.task}`);
	} else {
		messages.warning("🔍 Getting ECS tasks...");
		const tasks = await getECSTasks(ecsClient, selectedCluster);

		if (tasks.length === 0) {
			throw new Error("No running ECS tasks found");
		}

		// Select ECS task with zoxide-style real-time search
		selectedTask = (await search({
			message: "🔍 Search and select ECS task:",
			source: async (input) => {
				return await searchTasks(tasks, input || "");
			},
			pageSize: 50,
		})) as string;
	}

	// Get RDS instance
	let selectedRDS: RDSInstance;
	if (options.rds) {
		messages.warning("🔍 Getting RDS instances...");
		const rdsInstances = await getRDSInstances(rdsClient);
		const rdsInstance = rdsInstances.find(
			(r) => r.dbInstanceIdentifier === options.rds,
		);
		if (!rdsInstance) {
			throw new Error(`RDS instance not found: ${options.rds}`);
		}
		selectedRDS = rdsInstance;
		messages.success(`✅ RDS (from CLI): ${options.rds}`);
	} else {
		messages.warning("🔍 Getting RDS instances...");
		const rdsInstances = await getRDSInstances(rdsClient);

		if (rdsInstances.length === 0) {
			throw new Error("No RDS instances found");
		}

		// Select RDS instance with zoxide-style real-time search
		selectedRDS = (await search({
			message: "🔍 Search and select RDS instance:",
			source: async (input) => {
				return await searchRDS(rdsInstances, input || "");
			},
			pageSize: 50,
		})) as RDSInstance;
	}

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

async function connectToRDSWithInferenceInternal(
	options: ValidatedConnectOptions,
): Promise<void> {
	messages.warning("📋 Checking AWS configuration...");

	// Initialize EC2 client with default region to get region list
	const defaultEc2Client = new EC2Client({ region: "us-east-1" });

	// Get region
	let region: string;
	if (options.region) {
		region = options.region;
		messages.success(`✅ Region (from CLI): ${region}`);
	} else {
		messages.warning("🌍 Getting available AWS regions...");
		const regions = await getAWSRegions(defaultEc2Client);

		if (isEmpty(regions)) {
			throw new Error("Failed to get AWS regions");
		}

		region = await search({
			message: "🌍 Search and select AWS region:",
			source: async (input) => {
				return await searchRegions(regions, input || "");
			},
			pageSize: 50,
		});
		messages.success(`✅ Region: ${region}`);
	}

	// Initialize AWS clients
	const ecsClient = new ECSClient({ region });
	const rdsClient = new RDSClient({ region });

	// Step 1: Select RDS instance first
	let selectedRDS: RDSInstance;
	if (options.rds) {
		messages.warning("🔍 Getting RDS instances...");
		const rdsInstances = await getRDSInstances(rdsClient);
		const rdsInstance = rdsInstances.find(
			(r) => r.dbInstanceIdentifier === options.rds,
		);
		if (!rdsInstance) {
			throw new Error(`RDS instance not found: ${options.rds}`);
		}
		selectedRDS = rdsInstance;
		messages.success(`✅ RDS (from CLI): ${options.rds}`);
	} else {
		messages.warning("🔍 Getting RDS instances...");
		const rdsInstances = await getRDSInstances(rdsClient);

		if (rdsInstances.length === 0) {
			throw new Error("No RDS instances found");
		}

		selectedRDS = (await search({
			message: "🔍 Search and select RDS instance:",
			source: async (input) => {
				return await searchRDS(rdsInstances, input || "");
			},
			pageSize: 50,
		})) as RDSInstance;
	}

	// Step 2: Infer ECS targets based on selected RDS
	messages.warning("🔮 Inferring ECS targets based on RDS selection...");

	const inferenceStartTime = performance.now();
	const inferenceResults = await inferECSTargets(ecsClient, selectedRDS, false); // パフォーマンス追跡を無効化
	const inferenceEndTime = performance.now();
	const inferenceDuration = Math.round(inferenceEndTime - inferenceStartTime);

	let selectedInference: InferenceResult;
	let selectedTask: string;

	if (inferenceResults.length > 0) {
		// Show simple inference results summary
		messages.success(`✨ Found ${inferenceResults.length} ECS targets in ${inferenceDuration}ms`);
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
		const validLowCount = lowConfidenceResults.filter(r => !r.reason.includes('接続不可')).length;
		const invalidLowCount = lowConfidenceResults.filter(r => r.reason.includes('接続不可')).length;

		console.log(`📊 Found ${inferenceResults.length} ECS targets:`);
		if (highConfidenceResults.length > 0) {
			console.log(`   🎯 High confidence: ${highConfidenceResults.length}個`);
		}
		if (mediumConfidenceResults.length > 0) {
			console.log(`   ⭐ Medium confidence: ${mediumConfidenceResults.length}個`);
		}
		if (validLowCount > 0) {
			console.log(`   🔧 Low confidence: ${validLowCount}個${invalidLowCount > 0 ? ` (${invalidLowCount}個停止中)` : ''}`);
		}

		// Show recommendation
		const recommendedResult = inferenceResults[0];
		if (recommendedResult) {
			console.log(
				`🎯 \x1b[1m\x1b[36mRecommended\x1b[0m: ${recommendedResult.cluster.clusterName} → ${recommendedResult.task.displayName} (${recommendedResult.confidence} confidence)`,
			);
		}
		console.log();

		// Add comprehensive hint about filtering functionality
		messages.info("💡 Filter Examples:");
		console.log("   🔍 'prod web' - production web services");
		console.log("   🔍 'staging api' - staging API tasks");
		console.log("   🔍 'high env' - high confidence environment matches");
		console.log("   🔍 'naming 中' - medium confidence naming matches");
		console.log("   🔍 'running' - only running tasks");
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
				selectedInference = (await search({
					message: "🎯 Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
					source: async (input) => {
						return filterInferenceResults(inferenceResults, input || "")
							.map((result) => {
								const isUnavailable = result.reason.includes('接続不可');
								return {
									name: formatInferenceResult(result),
									value: result,
									description: result.reason,
									disabled: isUnavailable ? '⚠️ タスク停止中 - 選択不可' : undefined
								};
							});
					},
					pageSize: 15,
				})) as InferenceResult;
				selectedTask = selectedInference.task.taskArn;
			}
		} else {
			// Let user choose from recommendations
			selectedInference = (await search({
				message: "🎯 Select ECS target (filter with keywords like 'prod web' or 'staging api'):",
				source: async (input) => {
					return filterInferenceResults(inferenceResults, input || "")
						.map((result) => {
							const isUnavailable = result.reason.includes('接続不可');
							return {
								name: formatInferenceResult(result),
								value: result,
								description: result.reason,
								disabled: isUnavailable ? '⚠️ タスク停止中 - 選択不可' : undefined
							};
						});
				},
				pageSize: 15,
			})) as InferenceResult;
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
		let selectedCluster: ECSCluster;
		if (options.cluster) {
			messages.warning("🔍 Getting ECS clusters...");
			const clusters = await getECSClusters(ecsClient);
			const cluster = clusters.find((c) => c.clusterName === options.cluster);
			if (!cluster) {
				throw new Error(`ECS cluster not found: ${options.cluster}`);
			}
			selectedCluster = cluster;
			messages.success(`✅ Cluster (from CLI): ${options.cluster}`);
		} else {
			messages.warning("🔍 Getting ECS clusters...");
			const clusters = await getECSClusters(ecsClient);

			if (clusters.length === 0) {
				throw new Error("No ECS clusters found");
			}

			selectedCluster = (await search({
				message: "🔍 Search and select ECS cluster:",
				source: async (input) => {
					return await searchClusters(clusters, input || "");
				},
				pageSize: 50,
			})) as ECSCluster;
		}

		// Get ECS task manually
		if (options.task) {
			selectedTask = options.task;
			messages.success(`✅ Task (from CLI): ${options.task}`);
		} else {
			messages.warning("🔍 Getting ECS tasks...");
			const tasks = await getECSTasks(ecsClient, selectedCluster);

			if (tasks.length === 0) {
				throw new Error("No running ECS tasks found");
			}

			const selectedTaskObject = (await search({
				message: "🔍 Search and select ECS task:",
				source: async (input) => {
					return await searchTasks(tasks, input || "");
				},
				pageSize: 50,
			}));

			selectedTask = selectedTaskObject;
		}

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
		const { input } = await import("@inquirer/prompts");
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

	await startSSMSession(
		selectedTask,
		selectedRDS,
		rdsPort,
		localPort,
		reproducibleCommand,
	);
}

/**
 * Filter inference results using space-separated keywords
 * Supports both English and Japanese search terms
 * Searches through cluster name, task name, service name, method, confidence, and reason
 *
 * Examples:
 * - "prod web" - finds tasks in production clusters with web services
 * - "staging api" - finds staging API tasks
 * - "high env" - finds high confidence matches from environment analysis
 * - "名前 中" - finds medium confidence naming matches (Japanese)
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
		.filter(keyword => keyword.length > 0);

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
			// Add method labels for easier searching
			result.method === "environment" ? "環境変数 env" : "",
			result.method === "naming" ? "名前類似性 naming" : "",
			result.method === "network" ? "ネットワーク network" : "",
			// Add confidence levels for easier searching
			result.confidence === "high" ? "high 高" : "",
			result.confidence === "medium" ? "medium 中" : "",
			result.confidence === "low" ? "low 低" : "",
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		// All keywords must be found in the searchable text
		return keywords.every(keyword => searchableText.includes(keyword));
	});
}


