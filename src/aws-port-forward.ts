import { spawn } from "node:child_process";
import {
	DescribeClustersCommand,
	DescribeTasksCommand,
	ECSClient,
	ListClustersCommand,
	ListServicesCommand,
	ListTasksCommand,
} from "@aws-sdk/client-ecs";
import { DescribeDBInstancesCommand, RDSClient } from "@aws-sdk/client-rds";
import { search } from "@inquirer/prompts";
import chalk from "chalk";
import Fuse from "fuse.js";
import inquirer from "inquirer";

interface ECSTask {
	taskArn: string;
	displayName: string;
	runtimeId: string;
	taskId: string;
	clusterName: string;
	serviceName: string;
	taskStatus: string;
	createdAt?: Date;
}

interface ECSCluster {
	clusterName: string;
	clusterArn: string;
}

interface RDSInstance {
	identifier: string;
	endpoint: string;
	port: number;
	engine: string;
}

export async function connectToRDS(): Promise<void> {
	console.log(chalk.yellow("📋 AWS設定を確認しています..."));

	// AWS リージョンの選択
	const { region } = await inquirer.prompt([
		{
			type: "list",
			name: "region",
			message: "AWSリージョンを選択してください:",
			choices: [
				"ap-northeast-1",
				"ap-northeast-2",
				"us-east-1",
				"us-west-2",
				"eu-west-1",
			],
			default: "ap-northeast-1",
		},
	]);

	console.log(chalk.green(`✅ リージョン: ${region}`));

	// AWS クライアントの初期化
	const ecsClient = new ECSClient({ region });
	const rdsClient = new RDSClient({ region });

	try {
		// ECSクラスターの取得
		console.log(chalk.yellow("🔍 ECSクラスターを取得しています..."));
		const clusters = await getECSClusters(ecsClient);

		if (clusters.length === 0) {
			throw new Error("ECSクラスターが見つかりません");
		}

		// zoxideスタイルのリアルタイム検索でECSクラスターを選択
		console.log(
			chalk.blue(
				"💡 zoxideスタイル: 入力すると同時にリストが絞り込まれます（↑↓で選択、Enterで決定）",
			),
		);

		const selectedCluster = (await search({
			message: "🔍 ECSクラスターを検索・選択:",
			source: async (input) => {
				return await searchClusters(clusters, input || "");
			},
			pageSize: 12,
		})) as ECSCluster;

		// ECSタスクの取得
		console.log(chalk.yellow("🔍 ECSタスクを取得しています..."));
		const tasks = await getECSTasks(ecsClient, selectedCluster);

		if (tasks.length === 0) {
			throw new Error("実行中のECSタスクが見つかりません");
		}

		// zoxideスタイルのリアルタイム検索でECSタスクを選択
		const selectedTask = (await search({
			message: "🔍 ECSタスクを検索・選択:",
			source: async (input) => {
				return await searchTasks(tasks, input || "");
			},
			pageSize: 12,
		})) as string;

		// RDSインスタンスの取得
		console.log(chalk.yellow("🔍 RDSインスタンスを取得しています..."));
		const rdsInstances = await getRDSInstances(rdsClient);

		if (rdsInstances.length === 0) {
			throw new Error("RDSインスタンスが見つかりません");
		}

		// zoxideスタイルのリアルタイム検索でRDSインスタンスを選択
		const selectedRDS = (await search({
			message: "🔍 RDSインスタンスを検索・選択:",
			source: async (input) => {
				return await searchRDS(rdsInstances, input || "");
			},
			pageSize: 12,
		})) as RDSInstance;

		// ローカルポートの指定
		const { localPort } = await inquirer.prompt([
			{
				type: "input",
				name: "localPort",
				message: "ローカルポート番号を入力してください:",
				default: "8888",
				validate: (input: string) => {
					const port = parseInt(input);
					return port > 0 && port < 65536
						? true
						: "有効なポート番号を入力してください (1-65535)";
				},
			},
		]);

		// SSM セッション開始
		console.log(
			chalk.green("🚀 ポートフォワーディングセッションを開始します..."),
		);
		console.log(chalk.blue("選択されたタスク:"), selectedTask);
		await startSSMSession(selectedTask, selectedRDS, localPort);
	} catch (error) {
		console.error(chalk.red("❌ エラー:"), error);
		throw error;
	}
}

async function getECSClusters(ecsClient: ECSClient): Promise<ECSCluster[]> {
	const listCommand = new ListClustersCommand({});
	const listResponse = await ecsClient.send(listCommand);

	if (!listResponse.clusterArns || listResponse.clusterArns.length === 0) {
		return [];
	}

	// クラスターの詳細情報を取得
	const describeCommand = new DescribeClustersCommand({
		clusters: listResponse.clusterArns,
	});
	const describeResponse = await ecsClient.send(describeCommand);

	const clusters: ECSCluster[] = [];
	if (describeResponse.clusters) {
		for (const cluster of describeResponse.clusters) {
			if (cluster.clusterName && cluster.clusterArn) {
				clusters.push({
					clusterName: cluster.clusterName,
					clusterArn: cluster.clusterArn,
				});
			}
		}
	}

	return clusters;
}

async function getECSTasks(
	ecsClient: ECSClient,
	cluster: ECSCluster,
): Promise<ECSTask[]> {
	// まずサービスを取得
	const servicesCommand = new ListServicesCommand({
		cluster: cluster.clusterName,
	});
	const servicesResponse = await ecsClient.send(servicesCommand);

	const tasks: ECSTask[] = [];

	if (servicesResponse.serviceArns) {
		// サービスごとにタスクを取得
		for (const serviceArn of servicesResponse.serviceArns) {
			const serviceName = serviceArn.split("/").pop() || serviceArn;
			const tasksCommand = new ListTasksCommand({
				cluster: cluster.clusterName,
				serviceName,
				desiredStatus: "RUNNING",
			});
			const tasksResponse = await ecsClient.send(tasksCommand);

			if (tasksResponse.taskArns) {
				// タスクの詳細を取得
				const describeCommand = new DescribeTasksCommand({
					cluster: cluster.clusterName,
					tasks: tasksResponse.taskArns,
				});
				const describeResponse = await ecsClient.send(describeCommand);

				if (describeResponse.tasks) {
					for (const task of describeResponse.tasks) {
						if (
							task.taskArn &&
							task.containers &&
							task.containers.length > 0 &&
							task.lastStatus === "RUNNING"
						) {
							const taskId = task.taskArn.split("/").pop() || task.taskArn;
							const clusterFullName =
								cluster.clusterArn.split("/").pop() || cluster.clusterName;
							// RuntimeIDを取得（最初のコンテナから）
							const runtimeId = task.containers[0]?.runtimeId || "";

							if (runtimeId) {
								// ECS Exec用のフォーマット: ecs:クラスター名_タスクID_ランタイムID
								const targetArn = `ecs:${clusterFullName}_${taskId}_${runtimeId}`;

								// より詳細な表示名を作成
								const createdAt = task.createdAt
									? new Date(task.createdAt).toLocaleString("ja-JP")
									: "";
								const displayName = `${serviceName} | ${taskId.substring(0, 8)} | ${task.lastStatus} | ${createdAt}`;

								tasks.push({
									taskArn: targetArn,
									displayName: displayName,
									runtimeId: runtimeId,
									taskId: taskId,
									clusterName: clusterFullName,
									serviceName: serviceName,
									taskStatus: task.lastStatus || "UNKNOWN",
									createdAt: task.createdAt,
								});
							}
						}
					}
				}
			}
		}
	}

	return tasks;
}

async function getRDSInstances(rdsClient: RDSClient): Promise<RDSInstance[]> {
	const command = new DescribeDBInstancesCommand({});
	const response = await rdsClient.send(command);

	const instances: RDSInstance[] = [];

	if (response.DBInstances) {
		for (const instance of response.DBInstances) {
			if (instance.DBInstanceIdentifier && instance.Endpoint) {
				instances.push({
					identifier: instance.DBInstanceIdentifier,
					endpoint: instance.Endpoint.Address || "",
					port: instance.Endpoint.Port || 5432,
					engine: instance.Engine || "unknown",
				});
			}
		}
	}

	return instances;
}

async function startSSMSession(
	taskArn: string,
	rdsInstance: RDSInstance,
	localPort: string,
): Promise<void> {
	const parameters = {
		host: [rdsInstance.endpoint],
		portNumber: [rdsInstance.port.toString()],
		localPortNumber: [localPort],
	};

	// コマンド文字列を構築（JSONパラメータを適切にエスケープ）
	const parametersJson = JSON.stringify(parameters);
	const commandString = `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;

	console.log(chalk.blue("実行コマンド:"));
	console.log(chalk.cyan(commandString));
	console.log("");
	console.log(
		chalk.green(`🎯 localhost:${localPort} でRDS接続が利用可能になります`),
	);
	console.log(chalk.yellow("セッションを終了するには Ctrl+C を押してください"));
	console.log("");

	const child = spawn(commandString, [], {
		stdio: "inherit",
		env: process.env,
		shell: true,
	});

	child.on("error", (error) => {
		console.error(chalk.red("❌ コマンド実行エラー:"), error.message);
		if (error.message.includes("ENOENT")) {
			console.error(
				chalk.yellow("💡 AWS CLIがインストールされていない可能性があります"),
			);
		}
	});

	child.on("close", (code) => {
		if (code === 0) {
			console.log(chalk.green("✅ セッションが正常に終了しました"));
		} else {
			console.log(
				chalk.red(`❌ セッションがエラーコード ${code} で終了しました`),
			);
		}
	});

	// プロセス終了時の処理
	process.on("SIGINT", () => {
		console.log(chalk.yellow("\n🛑 セッションを終了しています..."));
		child.kill("SIGINT");
	});
}

// zoxideスタイルのファジー検索関数
function fuzzySearchClusters(clusters: ECSCluster[], input: string) {
	const fuseOptions = {
		keys: ["clusterName"],
		threshold: 0.5, // zoxideのように柔軟な検索
		distance: 200,
		includeScore: true,
		minMatchCharLength: 1,
		findAllMatches: true,
	};

	if (!input || input.trim() === "") {
		return clusters.map((cluster) => ({
			name: `${cluster.clusterName} ${chalk.dim(`(${cluster.clusterArn.split("/").pop()})`)}`,
			value: cluster,
		}));
	}

	const fuse = new Fuse(clusters, fuseOptions);
	const results = fuse.search(input);

	// zoxideスタイル: スコアが高い順に並べ替え、スコア表示
	return results
		.sort((a, b) => (a.score || 0) - (b.score || 0))
		.map((result, index) => ({
			name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.clusterName} ${chalk.dim(`(${result.item.clusterArn.split("/").pop()}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
			value: result.item,
		}));
}

// ECSタスクのファジー検索関数（zoxideスタイル）
function fuzzySearchTasks(tasks: ECSTask[], input: string) {
	const fuseOptions = {
		keys: ["serviceName", "taskId", "displayName"],
		threshold: 0.5,
		distance: 200,
		includeScore: true,
		minMatchCharLength: 1,
		findAllMatches: true,
	};

	if (!input || input.trim() === "") {
		return tasks.map((task) => ({
			name: task.displayName,
			value: task.taskArn,
		}));
	}

	const fuse = new Fuse(tasks, fuseOptions);
	const results = fuse.search(input);

	return results
		.sort((a, b) => (a.score || 0) - (b.score || 0))
		.map((result, index) => ({
			name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.displayName} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
			value: result.item.taskArn,
		}));
}

// RDSインスタンスのファジー検索関数（zoxideスタイル）
function fuzzySearchRDS(rdsInstances: RDSInstance[], input: string) {
	const fuseOptions = {
		keys: ["identifier", "engine", "endpoint"],
		threshold: 0.5,
		distance: 200,
		includeScore: true,
		minMatchCharLength: 1,
		findAllMatches: true,
	};

	if (!input || input.trim() === "") {
		return rdsInstances.map((rds) => ({
			name: `${rds.identifier} (${rds.engine}) - ${rds.endpoint}:${rds.port}`,
			value: rds,
		}));
	}

	const fuse = new Fuse(rdsInstances, fuseOptions);
	const results = fuse.search(input);

	return results
		.sort((a, b) => (a.score || 0) - (b.score || 0))
		.map((result, index) => ({
			name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.identifier} (${result.item.engine}) - ${result.item.endpoint}:${result.item.port} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
			value: result.item,
		}));
}

// zoxideスタイルのリアルタイム検索関数
async function searchClusters(clusters: ECSCluster[], input: string) {
	const fuseOptions = {
		keys: ["clusterName"],
		threshold: 0.5,
		distance: 200,
		includeScore: true,
		minMatchCharLength: 1,
		findAllMatches: true,
	};

	// 入力が空の場合は全て表示
	if (!input || input.trim() === "") {
		return clusters.map((cluster) => ({
			name: `${cluster.clusterName} ${chalk.dim(`(${cluster.clusterArn.split("/").pop()})`)}`,
			value: cluster,
		}));
	}

	// Fuseでリアルタイムファジー検索
	const fuse = new Fuse(clusters, fuseOptions);
	const results = fuse.search(input);

	// zoxideスタイル: スコア順に並べ替え
	return results
		.sort((a, b) => (a.score || 0) - (b.score || 0))
		.map((result, index) => ({
			name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.clusterName} ${chalk.dim(`(${result.item.clusterArn.split("/").pop()}) [${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
			value: result.item,
		}));
}

// zoxideスタイルのリアルタイム検索関数 - ECSタスク用
async function searchTasks(tasks: ECSTask[], input: string) {
	const fuseOptions = {
		keys: ["serviceName", "taskId", "displayName"],
		threshold: 0.5,
		distance: 200,
		includeScore: true,
		minMatchCharLength: 1,
		findAllMatches: true,
	};

	if (!input || input.trim() === "") {
		return tasks.map((task) => ({
			name: task.displayName,
			value: task.taskArn,
		}));
	}

	const fuse = new Fuse(tasks, fuseOptions);
	const results = fuse.search(input);

	return results
		.sort((a, b) => (a.score || 0) - (b.score || 0))
		.map((result, index) => ({
			name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.displayName} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
			value: result.item.taskArn,
		}));
}

// zoxideスタイルのリアルタイム検索関数 - RDS用
async function searchRDS(rdsInstances: RDSInstance[], input: string) {
	const fuseOptions = {
		keys: ["identifier", "engine", "endpoint"],
		threshold: 0.5,
		distance: 200,
		includeScore: true,
		minMatchCharLength: 1,
		findAllMatches: true,
	};

	if (!input || input.trim() === "") {
		return rdsInstances.map((rds) => ({
			name: `${rds.identifier} (${rds.engine}) - ${rds.endpoint}:${rds.port}`,
			value: rds,
		}));
	}

	const fuse = new Fuse(rdsInstances, fuseOptions);
	const results = fuse.search(input);

	return results
		.sort((a, b) => (a.score || 0) - (b.score || 0))
		.map((result, index) => ({
			name: `${index === 0 ? chalk.green("🎯") : "  "} ${result.item.identifier} (${result.item.engine}) - ${result.item.endpoint}:${result.item.port} ${chalk.dim(`[${((1 - (result.score || 0)) * 100).toFixed(0)}%]`)}`,
			value: result.item,
		}));
}
