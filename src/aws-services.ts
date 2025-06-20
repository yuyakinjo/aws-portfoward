import { DescribeRegionsCommand, type EC2Client } from "@aws-sdk/client-ec2";
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
import type { AWSRegion, ECSCluster, ECSTask, RDSInstance } from "./types.js";

export async function getECSClusters(
	ecsClient: ECSClient,
): Promise<ECSCluster[]> {
	try {
		const listCommand = new ListClustersCommand({});
		const listResponse = await ecsClient.send(listCommand);

		if (!listResponse.clusterArns || listResponse.clusterArns.length === 0) {
			return [];
		}

		// Get detailed cluster information
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
	} catch (error) {
		if (error instanceof Error) {
			// Provide more specific error messages
			if (
				error.name === "UnauthorizedOperation" ||
				error.name === "AccessDenied"
			) {
				throw new Error(
					"Access denied to ECS clusters. Please check your IAM policies.",
				);
			}
			if (error.message.includes("region")) {
				throw new Error(
					"ECS service is not available in the specified region.",
				);
			}
		}
		throw new Error(
			`Failed to get ECS clusters: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export async function getECSTasks(
	ecsClient: ECSClient,
	cluster: ECSCluster,
): Promise<ECSTask[]> {
	try {
		// Get services first
		const servicesCommand = new ListServicesCommand({
			cluster: cluster.clusterName,
		});
		const servicesResponse = await ecsClient.send(servicesCommand);

		const tasks: ECSTask[] = [];

		if (servicesResponse.serviceArns) {
			// Get tasks for each service
			for (const serviceArn of servicesResponse.serviceArns) {
				const serviceName = serviceArn.split("/").pop() || serviceArn;
				const tasksCommand = new ListTasksCommand({
					cluster: cluster.clusterName,
					serviceName,
					desiredStatus: "RUNNING",
				});
				const tasksResponse = await ecsClient.send(tasksCommand);

				if (tasksResponse.taskArns) {
					// Get task details
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
								// Get RuntimeID (from first container)
								const runtimeId = task.containers[0]?.runtimeId || "";

								if (runtimeId) {
									// Format for ECS Exec: ecs:cluster_name_task_id_runtime_id
									const targetArn = `ecs:${clusterFullName}_${taskId}_${runtimeId}`;

									// Create more detailed display name
									const createdAt = task.createdAt
										? new Date(task.createdAt).toLocaleString("en-US")
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
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === "ClusterNotFoundException") {
				throw new Error(
					`ECS cluster "${cluster.clusterName}" not found. Please verify the cluster exists.`,
				);
			}
			if (
				error.name === "UnauthorizedOperation" ||
				error.name === "AccessDenied"
			) {
				throw new Error(
					"Access denied to ECS tasks. Please check your IAM policies.",
				);
			}
		}
		throw new Error(
			`Failed to get ECS tasks: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export async function getAWSRegions(
	ec2Client: EC2Client,
): Promise<AWSRegion[]> {
	try {
		const command = new DescribeRegionsCommand({});
		const response = await ec2Client.send(command);

		const regions: AWSRegion[] = [];

		if (response.Regions) {
			for (const region of response.Regions) {
				if (region.RegionName) {
					regions.push({
						regionName: region.RegionName,
						optInStatus: region.OptInStatus || "opt-in-not-required",
					});
				}
			}
		}

		// Place commonly used regions at the top
		const priorityRegions = [
			"ap-northeast-1",
			"us-east-1",
			"us-west-2",
			"eu-west-1",
			"ap-northeast-2",
		];

		return regions.sort((a, b) => {
			const aIndex = priorityRegions.indexOf(a.regionName);
			const bIndex = priorityRegions.indexOf(b.regionName);

			if (aIndex !== -1 && bIndex !== -1) {
				return aIndex - bIndex;
			} else if (aIndex !== -1) {
				return -1;
			} else if (bIndex !== -1) {
				return 1;
			} else {
				return a.regionName.localeCompare(b.regionName);
			}
		});
	} catch (error) {
		if (error instanceof Error) {
			if (
				error.name === "UnauthorizedOperation" ||
				error.name === "AccessDenied"
			) {
				throw new Error(
					"Access denied to AWS regions. Please check your AWS credentials and IAM permissions.",
				);
			}
		}
		throw new Error(
			`Failed to get AWS regions: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export async function getRDSInstances(
	rdsClient: RDSClient,
): Promise<RDSInstance[]> {
	try {
		const command = new DescribeDBInstancesCommand({});
		const response = await rdsClient.send(command);

		const rdsInstances: RDSInstance[] = [];

		if (response.DBInstances) {
			for (const db of response.DBInstances) {
				if (
					db.DBInstanceIdentifier &&
					db.Endpoint?.Address &&
					db.Engine &&
					db.DBInstanceStatus === "available"
				) {
					rdsInstances.push({
						dbInstanceIdentifier: db.DBInstanceIdentifier,
						endpoint: db.Endpoint.Address,
						port: db.Endpoint.Port || 5432, // Default to PostgreSQL port if not available
						engine: db.Engine,
						dbInstanceClass: db.DBInstanceClass || "unknown",
						dbInstanceStatus: db.DBInstanceStatus,
						allocatedStorage: db.AllocatedStorage || 0,
						availabilityZone: db.AvailabilityZone || "unknown",
						vpcSecurityGroups:
							db.VpcSecurityGroups?.map((sg) => sg.VpcSecurityGroupId || "") ||
							[],
						dbSubnetGroup: db.DBSubnetGroup?.DBSubnetGroupName || undefined,
						createdTime: db.InstanceCreateTime || undefined,
					});
				}
			}
		}

		// Sort by name
		return rdsInstances.sort((a, b) =>
			a.dbInstanceIdentifier.localeCompare(b.dbInstanceIdentifier),
		);
	} catch (error) {
		if (error instanceof Error) {
			if (
				error.name === "UnauthorizedOperation" ||
				error.name === "AccessDenied"
			) {
				throw new Error(
					"Access denied to RDS instances. Please check your IAM policies.",
				);
			}
		}
		throw new Error(
			`Failed to get RDS instances: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
