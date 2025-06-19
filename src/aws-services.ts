import {
	DescribeClustersCommand,
	DescribeTasksCommand,
	type ECSClient,
	ListClustersCommand,
	ListServicesCommand,
	ListTasksCommand,
} from "@aws-sdk/client-ecs";
import {
	DescribeDBInstancesCommand,
	type RDSClient,
} from "@aws-sdk/client-rds";
import type { ECSCluster, ECSTask, RDSInstance } from "./types.js";

export async function getECSClusters(
	ecsClient: ECSClient,
): Promise<ECSCluster[]> {
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

export async function getECSTasks(
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

export async function getRDSInstances(
	rdsClient: RDSClient,
): Promise<RDSInstance[]> {
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
