import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { search } from "@inquirer/prompts";
import chalk from "chalk";
import inquirer from "inquirer";
import {
	getECSClusters,
	getECSTasks,
	getRDSInstances,
} from "./aws-services.js";
import { searchClusters, searchRDS, searchTasks } from "./search.js";
import { startSSMSession } from "./session.js";
import type { ECSCluster, RDSInstance } from "./types.js";
import { getDefaultPortForEngine } from "./utils.js";

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

		// RDSポートの指定
		const defaultRDSPort = getDefaultPortForEngine(selectedRDS.engine);
		const { rdsPort } = await inquirer.prompt([
			{
				type: "input",
				name: "rdsPort",
				message: `RDSポート番号を入力してください (${selectedRDS.engine}):`,
				default: defaultRDSPort.toString(),
				placeholder: `例: ${defaultRDSPort} (${selectedRDS.engine}のデフォルト)`,
				validate: (input: string) => {
					const port = parseInt(input || defaultRDSPort.toString());
					return port > 0 && port < 65536
						? true
						: "有効なポート番号を入力してください (1-65535)";
				},
			},
		]);

		// ローカルポートの指定
		const { localPort } = await inquirer.prompt([
			{
				type: "input",
				name: "localPort",
				message: "ローカルポート番号を入力してください:",
				default: "8888",
				placeholder: "例: 8888 (デフォルト)",
				validate: (input: string) => {
					const port = parseInt(input || "8888");
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
		await startSSMSession(selectedTask, selectedRDS, rdsPort, localPort);
	} catch (error) {
		console.error(chalk.red("❌ エラー:"), error);
		throw error;
	}
}
