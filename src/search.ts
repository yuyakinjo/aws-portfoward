import chalk from "chalk";
import Fuse from "fuse.js";
import type { ECSCluster, ECSTask, RDSInstance } from "./types.js";

// zoxideスタイルのファジー検索関数
export function fuzzySearchClusters(clusters: ECSCluster[], input: string) {
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
export function fuzzySearchTasks(tasks: ECSTask[], input: string) {
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
export function fuzzySearchRDS(rdsInstances: RDSInstance[], input: string) {
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
export async function searchClusters(clusters: ECSCluster[], input: string) {
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
export async function searchTasks(tasks: ECSTask[], input: string) {
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
export async function searchRDS(rdsInstances: RDSInstance[], input: string) {
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
