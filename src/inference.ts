import fs from "node:fs";
import path from "node:path";
import type { ECSClient } from "@aws-sdk/client-ecs";
import { getECSClusters, getECSTasks } from "./aws-services.js";
import type { ECSCluster, ECSTask, RDSInstance } from "./types.js";

export interface InferenceResult {
	cluster: ECSCluster;
	task: ECSTask;
	confidence: "high" | "medium" | "low";
	method: "environment" | "naming" | "network";
	score: number;
	reason: string;
}

export interface InferenceMatch {
	rds_identifier: string;
	task_family?: string;
	cluster?: string;
	task_arn?: string;
	confidence: "high" | "medium" | "low";
	match_score?: number;
	similarity_score?: number;
	match_reasons?: string[];
	method?: string;
	service?: string;
	task_definition?: string;
	rds_engine?: string;
	match_details?: Record<string, unknown>;
}

export interface PerformanceMetrics {
	step: string;
	startTime: number;
	endTime: number;
	duration: number;
}

export class PerformanceTracker {
	private metrics: PerformanceMetrics[] = [];
	private currentStep: string | null = null;
	private stepStartTime: number | null = null;

	startStep(step: string): void {
		if (this.currentStep) {
			this.endStep();
		}
		this.currentStep = step;
		this.stepStartTime = performance.now();
	}

	endStep(): void {
		if (this.currentStep && this.stepStartTime !== null) {
			const endTime = performance.now();
			this.metrics.push({
				step: this.currentStep,
				startTime: this.stepStartTime,
				endTime,
				duration: endTime - this.stepStartTime,
			});
			this.currentStep = null;
			this.stepStartTime = null;
		}
	}

	getMetrics(): PerformanceMetrics[] {
		if (this.currentStep) {
			this.endStep();
		}
		return [...this.metrics];
	}

	getTotalDuration(): number {
		return this.metrics.reduce((total, metric) => total + metric.duration, 0);
	}

	getReport(): string {
		const metrics = this.getMetrics();
		const total = this.getTotalDuration();

		let report = "\n🕐 Performance Report\n";
		report += "=".repeat(50) + "\n";

		for (const metric of metrics) {
			const percentage =
				total > 0 ? ((metric.duration / total) * 100).toFixed(1) : "0.0";
			report += `${metric.step.padEnd(30)} ${metric.duration.toFixed(0).padStart(6)}ms (${percentage}%)\n`;
		}

		report += `${"=".repeat(50)}\n`;
		report += `${"Total".padEnd(30)} ${total.toFixed(0).padStart(6)}ms (100.0%)\n`;

		if (total > 3000) {
			report += "\n⚠️  Warning: Total time exceeds 3 seconds threshold\n";
		} else {
			report += "\n✅ Performance within acceptable range (<3s)\n";
		}

		return report;
	}
}

// RDS名からECSクラスター名を推論する関数
function inferClustersFromRDSName(
	rdsName: string,
	allClusters: ECSCluster[],
): string[] {
	const rdsSegments = rdsName.toLowerCase().split(/[-_]/);
	const rdsWords = rdsName.toLowerCase().split(/[-_\s]/);
	const rdsLower = rdsName.toLowerCase();

	const envIndicators = [
		"dev",
		"development",
		"staging",
		"stage",
		"stg",
		"prod",
		"production",
		"test",
	];

	const commonPatterns = [
		"app",
		"web",
		"api",
		"service",
		"backend",
		"frontend",
	];

	return allClusters
		.map((cluster) => {
			const clusterName = cluster.clusterName.toLowerCase();

			// スコア計算ロジックを関数型で実装
			const scoreCalculations = [
				// 完全一致
				{ condition: clusterName === rdsLower, score: 100 },
				// プレフィックス一致
				{
					condition:
						clusterName.startsWith(rdsLower) ||
						rdsLower.startsWith(clusterName),
					score: 80,
				},
				// 部分一致
				{ condition: clusterName.includes(rdsLower), score: 70 },
				// 逆部分一致
				{
					condition: rdsLower.includes(clusterName) && clusterName.length > 3,
					score: 60,
				},
			];

			// セグメント一致のスコア
			const segmentScore =
				rdsSegments.filter(
					(segment) => segment.length > 2 && clusterName.includes(segment),
				).length * 30;

			// 単語一致のスコア
			const wordScore =
				rdsWords.filter((word) => word.length > 2 && clusterName.includes(word))
					.length * 15;

			// 環境指標一致のスコア
			const envScore =
				envIndicators.filter(
					(env) => rdsLower.includes(env) && clusterName.includes(env),
				).length * 25;

			// 共通パターン一致のスコア
			const patternScore =
				commonPatterns.filter(
					(pattern) =>
						rdsLower.includes(pattern) && clusterName.includes(pattern),
				).length * 20;

			// 総スコア計算
			const baseScore = scoreCalculations
				.filter((calc) => calc.condition)
				.reduce((total, calc) => total + calc.score, 0);

			const totalScore =
				baseScore + segmentScore + wordScore + envScore + patternScore;

			return { clusterName: cluster.clusterName, score: totalScore };
		})
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score)
		.map((item) => item.clusterName);
}

// タスクの環境変数を模擬的にチェックする関数（実際のプロダクションでは、タスク定義のAPIから取得）
async function checkTaskEnvironmentVariables(
	_: ECSClient,
	task: ECSTask,
	rdsInstance: RDSInstance,
): Promise<{ hasMatch: boolean; score: number; matchDetails: string[] }> {
	// 実際の実装では、ECS describe-task-definition API を使用して環境変数を取得
	// ここでは模擬的にタスク名とサービス名から推論

	const taskName = task.displayName.toLowerCase();
	const serviceName = task.serviceName.toLowerCase();
	const rdsIdentifier = rdsInstance.dbInstanceIdentifier.toLowerCase();
	const rdsSegments = rdsIdentifier.split("-").filter((s) => s.length > 2);

	// 基本マッチング条件を関数型で定義
	const basicMatches = [
		{
			condition: taskName.includes(rdsIdentifier),
			score: 40,
			detail: "Task name contains RDS identifier",
		},
		{
			condition: serviceName.includes(rdsIdentifier),
			score: 40,
			detail: "Service name contains RDS identifier",
		},
	];

	// セグメントマッチング条件を関数型で定義
	const segmentMatches = rdsSegments.flatMap((segment) => [
		{
			condition: taskName.includes(segment),
			score: 15,
			detail: `Task name segment match: ${segment}`,
		},
		{
			condition: serviceName.includes(segment),
			score: 15,
			detail: `Service name segment match: ${segment}`,
		},
	]);

	// 全マッチング条件を組み合わせて処理
	const allMatches = [...basicMatches, ...segmentMatches];
	const positiveMatches = allMatches.filter((match) => match.condition);

	const totalScore = positiveMatches.reduce(
		(sum, match) => sum + match.score,
		0,
	);
	const matchDetails = positiveMatches.map((match) => match.detail);

	return {
		hasMatch: totalScore > 20,
		score: totalScore,
		matchDetails,
	};
}

// タスクを名前の類似性でスコアリングする関数
async function scoreTasksByNaming(
	tasks: ECSTask[],
	cluster: ECSCluster,
	rdsInstance: RDSInstance,
): Promise<InferenceResult[]> {
	const rdsName = rdsInstance.dbInstanceIdentifier.toLowerCase();
	const rdsSegments = rdsName.split("-").filter((s) => s.length > 2);

	return tasks.map((task) => {
		const taskName = task.displayName.toLowerCase();
		const serviceName = task.serviceName.toLowerCase();

		// スコア計算ロジックを関数型で処理
		const scoreCalculations = [
			{
				condition: taskName.includes(rdsName),
				score: 35,
				reason: "完全名前一致",
			},
			{
				condition: serviceName.includes(rdsName),
				score: 30,
				reason: "サービス名一致",
			},
		];

		// 基本スコア計算
		const baseResults = scoreCalculations.filter((calc) => calc.condition);
		const baseScore = baseResults.reduce(
			(total, calc) => total + calc.score,
			0,
		);
		const baseReasons = baseResults.map((calc) => calc.reason);

		// セグメント一致を関数型で処理
		const segmentResults = rdsSegments
			.flatMap((segment) => [
				{
					condition: taskName.includes(segment),
					score: 20,
					reason: `セグメント一致: ${segment}`,
				},
				{
					condition: serviceName.includes(segment),
					score: 15,
					reason: `サービスセグメント一致: ${segment}`,
				},
			])
			.filter((calc) => calc.condition);

		const segmentScore = segmentResults.reduce(
			(total, calc) => total + calc.score,
			0,
		);
		const segmentReasons = segmentResults.map((calc) => calc.reason);

		// 最終スコアと理由
		const totalScore = 25 + baseScore + segmentScore; // 25はベーススコア
		const allReasons = [...baseReasons, ...segmentReasons];
		const confidence =
			totalScore >= 75 ? "high" : totalScore >= 50 ? "medium" : "low";

		return {
			cluster,
			task,
			confidence,
			method: "naming" as const,
			score: totalScore,
			reason: `名前類似性: ${allReasons.join(", ")} (${totalScore}%)`,
		};
	});
}

// タスクをRDSとの関連性でスコアリングする関数
async function scoreTasksAgainstRDS(
	ecsClient: ECSClient,
	tasks: ECSTask[],
	cluster: ECSCluster,
	rdsInstance: RDSInstance,
	analysisResults: {
		environment: InferenceMatch[];
		naming: InferenceMatch[];
		network: InferenceMatch[];
	},
): Promise<InferenceResult[]> {
	// 各タスクの環境変数チェック結果を並列で取得
	const envCheckPromises = tasks.map(async (task) => {
		const envCheck = await checkTaskEnvironmentVariables(
			ecsClient,
			task,
			rdsInstance,
		);
		return { task, envCheck };
	});

	const envCheckResults = await Promise.all(envCheckPromises);

	// 環境変数マッチの結果を生成
	const envResults = envCheckResults
		.filter(({ envCheck }) => envCheck.hasMatch)
		.map(({ task, envCheck }) => {
			const confidence =
				envCheck.score >= 80 ? "high" : envCheck.score >= 50 ? "medium" : "low";
			return {
				cluster,
				task,
				confidence: confidence as "high" | "medium" | "low",
				method: "environment" as const,
				score: envCheck.score,
				reason: `環境変数推論: ${envCheck.matchDetails.join(", ")}`,
			};
		});

	// 分析結果からのマッチを生成
	const analysisMatchResults = tasks.flatMap((task) => {
		// 関連する環境マッチを検索
		const relevantMatches = analysisResults.environment.filter(
			(match) =>
				match.rds_identifier === rdsInstance.dbInstanceIdentifier &&
				match.task_family &&
				(task.taskId.includes(match.task_family) ||
					task.serviceName.includes(match.task_family)),
		);

		// 各マッチを結果に変換
		return relevantMatches.map((match) => {
			const score =
				match.confidence === "high"
					? 95
					: match.confidence === "medium"
						? 75
						: 45;
			return {
				cluster,
				task,
				confidence: match.confidence as "high" | "medium" | "low",
				method: "environment" as const,
				score,
				reason: `分析結果: ${match.match_reasons?.join(", ") || "データベース接続"}`,
			};
		});
	});

	return [...envResults, ...analysisMatchResults];
}

/**
 * Load analysis results from temp directory
 */
function loadAnalysisResults(): {
	environment: InferenceMatch[];
	naming: InferenceMatch[];
	network: InferenceMatch[];
} {
	const tempDir = path.join(process.cwd(), "temp");

	let environment: InferenceMatch[] = [];
	let naming: InferenceMatch[] = [];
	let network: InferenceMatch[] = [];

	try {
		const envPath = path.join(tempDir, "environment_match_results.json");
		if (fs.existsSync(envPath)) {
			environment = JSON.parse(fs.readFileSync(envPath, "utf-8"));
		}
	} catch (error) {
		console.warn("Could not load environment analysis results:", error);
	}

	try {
		const namingPath = path.join(tempDir, "naming_similarity_results.json");
		if (fs.existsSync(namingPath)) {
			naming = JSON.parse(fs.readFileSync(namingPath, "utf-8"));
		}
	} catch (error) {
		console.warn("Could not load naming analysis results:", error);
	}

	try {
		const networkPath = path.join(tempDir, "network_match_results.json");
		if (fs.existsSync(networkPath)) {
			network = JSON.parse(fs.readFileSync(networkPath, "utf-8"));
		}
	} catch (error) {
		console.warn("Could not load network analysis results:", error);
	}

	return { environment, naming, network };
}

/**
 * Infer ECS cluster and task recommendations for a given RDS instance
 */
export async function inferECSTargets(
	ecsClient: ECSClient,
	rdsInstance: RDSInstance,
	enablePerformanceTracking = false,
): Promise<InferenceResult[]> {
	const tracker = new PerformanceTracker();
	const results: InferenceResult[] = [];

	try {
		tracker.startStep("Load analysis results");
		const analysisResults = loadAnalysisResults();
		tracker.endStep();

		tracker.startStep("Get ECS clusters");
		const allClusters = await getECSClusters(ecsClient);
		const clusterMap = new Map(allClusters.map((c) => [c.clusterName, c]));
		tracker.endStep();

		tracker.startStep("RDS name-based cluster inference");
		// Phase 0: Infer likely ECS clusters from RDS name (performance optimization)
		const likelyClusterNames = inferClustersFromRDSName(
			rdsInstance.dbInstanceIdentifier,
			allClusters,
		);
		const likelyClusters = likelyClusterNames
			.map((name: string) => clusterMap.get(name))
			.filter(Boolean) as ECSCluster[];

		console.log(
			`🎯 RDS "${rdsInstance.dbInstanceIdentifier}" から推論されたクラスター: ${likelyClusterNames.length}個`,
		);
		for (const clusterName of likelyClusterNames.slice(0, 5)) {
			console.log(`   📋 ${clusterName}`);
		}
		tracker.endStep();

		// Phase 1: 推論されたクラスターでタスク検索（最優先）
		tracker.startStep("Search tasks in inferred clusters");
		const primaryClusters = likelyClusters.slice(0, 3); // 上位3つのクラスターのみ
		console.log(
			`🔍 優先クラスターでタスク検索: ${primaryClusters.length}個のクラスター`,
		);

		// 並列でタスクを取得し、スコアリングを実行
		const primaryClusterResults = await Promise.all(
			primaryClusters.map(async (cluster) => {
				console.log(
					`   ⏱️  クラスター "${cluster.clusterName}" でタスク検索中...`,
				);
				try {
					const tasks = await getECSTasks(ecsClient, cluster);
					if (tasks.length > 0) {
						console.log(`   ✅ ${tasks.length}個のタスクを発見`);
						const scored = await scoreTasksAgainstRDS(
							ecsClient,
							tasks,
							cluster,
							rdsInstance,
							analysisResults,
						);
						return scored;
					} else {
						console.log(`   ⚪ タスクなし`);
						return [];
					}
				} catch (error) {
					const errorMsg =
						error instanceof Error ? error.message : String(error);
					if (!errorMsg.includes("Tasks cannot be empty")) {
						console.log(`   ❌ エラー: ${errorMsg}`);
					}
					return [];
				}
			}),
		);

		// 結果をフラット化
		results.push(...primaryClusterResults.flat());
		tracker.endStep();

		// Phase 2: 不十分な場合のフォールバック検索
		tracker.startStep("Fallback search if needed");
		if (results.length < 3) {
			console.log(`⚠️  結果が少ないため、追加のクラスターを検索します...`);
			const remainingClusters = likelyClusters.slice(3, 8); // 次の5個のクラスター

			const fallbackResults = await Promise.all(
				remainingClusters.map(async (cluster) => {
					console.log(
						`   🔍 フォールバック: クラスター "${cluster.clusterName}" でタスク検索中...`,
					);
					try {
						const tasks = await getECSTasks(ecsClient, cluster);
						if (tasks.length > 0) {
							console.log(`   ✅ ${tasks.length}個のタスクを発見`);
							const scored = await scoreTasksByNaming(
								tasks,
								cluster,
								rdsInstance,
							);
							return scored;
						} else {
							console.log(`   ⚪ タスクなし`);
							return [];
						}
					} catch (error) {
						const errorMsg =
							error instanceof Error ? error.message : String(error);
						if (!errorMsg.includes("Tasks cannot be empty")) {
							console.log(`   ❌ エラー: ${errorMsg}`);
						}
						return [];
					}
				}),
			);

			results.push(...fallbackResults.flat());
		}
		tracker.endStep();

		// 有効なタスクと無効なタスクを分離
		const validResults = results.filter((result) => {
			return (
				result.task.taskStatus === "RUNNING" ||
				result.task.taskStatus === "PENDING"
			);
		});

		const invalidResults = results.filter((result) => {
			return (
				result.task.taskStatus !== "RUNNING" &&
				result.task.taskStatus !== "PENDING"
			);
		});

		// 有効な結果を信頼度とスコアでソート
		const sortedValidResults = validResults.sort((a, b) => {
			const confidenceOrder = { high: 3, medium: 2, low: 1 };
			const confidenceDiff =
				confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
			if (confidenceDiff !== 0) return confidenceDiff;
			return b.score - a.score;
		});

		// 無効な結果を最後に追加（disabled状態として）
		const finalResults = [
			...sortedValidResults,
			...invalidResults.map((result) => ({
				...result,
				confidence: "low" as const,
				score: 0,
				reason: `${result.reason} (タスク停止中 - 接続不可)`,
			})),
		];

		// Debug: 推論結果のサマリーを表示
		if (enablePerformanceTracking) {
			console.log(`\n📊 推論結果サマリー:`);
			console.log(`  - 推論クラスター: ${likelyClusterNames.length}個`);
			console.log(`  - 検索済みタスク: ${results.length}個`);
			console.log(`  - 接続可能: ${validResults.length}個`);
			console.log(`  - 接続不可: ${invalidResults.length}個`);
		}

		return finalResults;
	} catch (error) {
		console.error("Error during ECS target inference:", error);
		throw error;
	} finally {
		if (enablePerformanceTracking) {
			console.log(tracker.getReport());
		}
	}
}

/**
 * Format inference result for display
 */
export function formatInferenceResult(result: InferenceResult): string {
	const confidenceIcon = {
		high: "🎯",
		medium: "⭐",
		low: "🔧",
	}[result.confidence];

	const methodLabel = {
		environment: "環境変数",
		naming: "名前類似性",
		network: "ネットワーク",
	}[result.method];

	return `${confidenceIcon} ${result.cluster.clusterName} → ${result.task.displayName} (${methodLabel}: ${result.score}%)`;
}
