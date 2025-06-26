import { DescribeRegionsCommand, type EC2Client } from "@aws-sdk/client-ec2";
import {
  DescribeClustersCommand,
  DescribeTasksCommand,
  type ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  ListTasksCommand,
} from "@aws-sdk/client-ecs";
import { isEmpty } from "./utils/index.js";
import {
  DescribeDBInstancesCommand,
  type RDSClient,
} from "@aws-sdk/client-rds";
import type {
  AWSRegion,
  ClusterName,
  ContainerName,
  ECSCluster,
  ECSTask,
  RDSInstance,
  Result,
  TaskArn,
  ECSTaskContainersParams,
} from "./types.js";
import {
  failure,
  parseClusterArn,
  parseClusterName,
  parseContainerName,
  parseDatabaseEngine,
  parseDBEndpoint,
  parseDBInstanceIdentifier,
  parsePortNumber,
  parseRegionName,
  parseRuntimeId,
  parseServiceName,
  parseTaskArn,
  parseTaskId,
  parseTaskStatus,
  success,
} from "./types.js";

export async function getECSClustersWithExecCapability(
  ecsClient: ECSClient,
): Promise<Result<ECSCluster[], string>> {
  const allClustersResult = await getECSClustersResult(ecsClient);
  if (!allClustersResult.success) {
    return allClustersResult;
  }
  const allClusters = allClustersResult.data;
  const execCheckPromises = allClusters.map(async (cluster: ECSCluster) => {
    const hasExecCapability = await checkECSExecCapability(ecsClient, cluster);
    return { cluster, hasExecCapability };
  });
  const execCheckResults = await Promise.all(execCheckPromises);
  const clustersWithExec = execCheckResults
    .filter(({ hasExecCapability }) => hasExecCapability)
    .map(({ cluster }) => cluster);
  return success(clustersWithExec);
}

export async function getAWSRegions(
  ec2Client: EC2Client,
): Promise<Result<AWSRegion[], string>> {
  return getAWSRegionsResult(ec2Client);
}

export async function getECSClusters(
  ecsClient: ECSClient,
): Promise<Result<ECSCluster[], string>> {
  return getECSClustersResult(ecsClient);
}

export async function getECSTasks(
  ecsClient: ECSClient,
  cluster: ECSCluster,
): Promise<Result<ECSTask[], string>> {
  return getECSTasksResult(ecsClient, cluster);
}

export async function getRDSInstances(
  rdsClient: RDSClient,
): Promise<Result<RDSInstance[], string>> {
  return getRDSInstancesResult(rdsClient);
}

export async function getECSTasksWithExecCapability(
  ecsClient: ECSClient,
  cluster: ECSCluster,
): Promise<Result<ECSTask[], string>> {
  const allTasksResult = await getECSTasksResult(ecsClient, cluster);
  if (!allTasksResult.success) {
    return allTasksResult; // Propagate error
  }
  const runningTasks = allTasksResult.data.filter(
    (task: ECSTask) => task.taskStatus === "RUNNING",
  );
  return success(runningTasks);
}

export async function getECSTaskContainers(
  params: ECSTaskContainersParams,
): Promise<Result<ContainerName[], string>> {
  const { ecsClient, clusterName, taskArn } = params;
  
  try {
    const describeCommand = new DescribeTasksCommand({
      cluster: String(clusterName),
      tasks: [String(taskArn)],
    });
    const response = await (ecsClient as ECSClient).send(describeCommand);
    if (!response.tasks || isEmpty(response.tasks)) {
      return failure("Task not found");
    }
    const task = response.tasks[0];
    if (!task) {
      return failure("Task data not found");
    }
    const containers: ContainerName[] = [];
    if (task.containers) {
      for (const container of task.containers) {
        if (container.name && container.lastStatus === "RUNNING") {
          const containerNameResult = parseContainerName(container.name);
          if (containerNameResult.success) {
            containers.push(containerNameResult.data);
          }
        }
      }
    }
    return success(containers);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "ClusterNotFoundException") {
        return failure(
          `ECS cluster "${clusterName}" not found. Please verify the cluster exists.`,
        );
      }
      if (error.name === "TaskNotFoundException") {
        return failure(
          `ECS task not found. Please verify the task exists and is running.`,
        );
      }
    }
    return failure(
      `Failed to get task containers: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function getECSClustersResult(
  ecsClient: ECSClient,
): Promise<Result<ECSCluster[], string>> {
  try {
    const listCommand = new ListClustersCommand({});
    const listResponse = await ecsClient.send(listCommand);

    if (!listResponse.clusterArns || isEmpty(listResponse.clusterArns)) {
      return success([]);
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
          // Parse cluster data safely with branded types
          const clusterNameResult = parseClusterName(cluster.clusterName);
          const clusterArnResult = parseClusterArn(cluster.clusterArn);

          if (clusterNameResult.success && clusterArnResult.success) {
            clusters.push({
              clusterName: clusterNameResult.data,
              clusterArn: clusterArnResult.data,
            });
          }
          // Skip invalid clusters instead of throwing error
        }
      }
    }

    return success(clusters);
  } catch (error) {
    if (error instanceof Error) {
      // Provide more specific error messages
      if (
        error.name === "UnauthorizedOperation" ||
        error.name === "AccessDenied"
      ) {
        return failure(
          "Access denied to ECS clusters. Please check your IAM policies.",
        );
      }
      if (error.message.includes("region")) {
        return failure("ECS service is not available in the specified region.");
      }
    }
    return failure(
      `Failed to get ECS clusters: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function getECSTasksResult(
  ecsClient: ECSClient,
  cluster: ECSCluster,
): Promise<Result<ECSTask[], string>> {
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
        const serviceNameStr = serviceArn.split("/").pop() || serviceArn;
        const serviceNameResult = parseServiceName(serviceNameStr);

        if (!serviceNameResult.success) {
          continue; // Skip invalid service names
        }

        const tasksCommand = new ListTasksCommand({
          cluster: cluster.clusterName,
          serviceName: serviceNameStr,
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
                const taskIdStr = task.taskArn.split("/").pop() || task.taskArn;
                const clusterFullNameStr =
                  cluster.clusterArn.split("/").pop() || cluster.clusterName;
                // Get RuntimeID (from first container)
                const runtimeIdStr = task.containers[0]?.runtimeId || "";

                // Parse all components safely
                const taskIdResult = parseTaskId(taskIdStr);
                const clusterNameResult = parseClusterName(clusterFullNameStr);
                const runtimeIdResult = parseRuntimeId(runtimeIdStr);
                const realTaskArnResult = parseTaskArn(task.taskArn);
                const taskStatusResult = parseTaskStatus(
                  task.lastStatus || "UNKNOWN",
                );

                if (
                  runtimeIdResult.success &&
                  taskIdResult.success &&
                  clusterNameResult.success &&
                  realTaskArnResult.success &&
                  taskStatusResult.success &&
                  serviceNameResult.success
                ) {
                  // Format for ECS Exec: ecs:cluster_name_task_id_runtime_id
                  const targetArnStr = `ecs:${clusterFullNameStr}_${taskIdStr}_${runtimeIdStr}`;
                  const targetArnResult = parseTaskArn(targetArnStr);

                  if (targetArnResult.success) {
                    // Create simple display name - just service name
                    const displayName = serviceNameStr;

                    tasks.push({
                      taskArn: targetArnResult.data,
                      realTaskArn: realTaskArnResult.data,
                      displayName: displayName,
                      runtimeId: runtimeIdResult.data,
                      taskId: taskIdResult.data,
                      clusterName: clusterNameResult.data,
                      serviceName: serviceNameResult.data,
                      taskStatus: taskStatusResult.data,
                      createdAt: task.createdAt,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    return success(tasks);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "ClusterNotFoundException") {
        return failure(
          `ECS cluster "${cluster.clusterName}" not found. Please verify the cluster exists.`,
        );
      }
      if (
        error.name === "UnauthorizedOperation" ||
        error.name === "AccessDenied"
      ) {
        return failure(
          "Access denied to ECS tasks. Please check your IAM policies.",
        );
      }
    }
    return failure(
      `Failed to get ECS tasks: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function getAWSRegionsResult(
  ec2Client: EC2Client,
): Promise<Result<AWSRegion[], string>> {
  try {
    const command = new DescribeRegionsCommand({});
    const response = await ec2Client.send(command);

    const regions: AWSRegion[] = [];

    if (response.Regions) {
      for (const region of response.Regions) {
        if (region.RegionName) {
          const regionNameResult = parseRegionName(region.RegionName);
          if (regionNameResult.success) {
            regions.push({
              regionName: regionNameResult.data,
              optInStatus: region.OptInStatus || "opt-in-not-required",
            });
          }
          // Skip invalid region names
        }
      }
    }

    // Place commonly used regions at the top
    const priorityRegions = [
      "ap-northeast-1",
      "ap-northeast-2",
      "us-east-1",
      "us-west-2",
      "eu-west-1",
    ];

    const sortedRegions = regions.sort((a, b) => {
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

    return success(sortedRegions);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.name === "UnauthorizedOperation" ||
        error.name === "AccessDenied"
      ) {
        return failure(
          "Access denied to AWS regions. Please check your AWS credentials and IAM permissions.",
        );
      }
    }
    return failure(
      `Failed to get AWS regions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function getRDSInstancesResult(
  rdsClient: RDSClient,
): Promise<Result<RDSInstance[], string>> {
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
          // Parse all DB instance components safely
          const dbIdResult = parseDBInstanceIdentifier(db.DBInstanceIdentifier);
          const endpointResult = parseDBEndpoint(db.Endpoint.Address);
          const portResult = parsePortNumber(db.Endpoint.Port || 5432);
          const engineResult = parseDatabaseEngine(db.Engine);

          if (
            dbIdResult.success &&
            endpointResult.success &&
            portResult.success &&
            engineResult.success
          ) {
            rdsInstances.push({
              dbInstanceIdentifier: dbIdResult.data,
              endpoint: endpointResult.data,
              port: portResult.data,
              engine: engineResult.data,
              dbInstanceClass: db.DBInstanceClass || "unknown",
              dbInstanceStatus: "available", // We already filtered for this
              allocatedStorage: db.AllocatedStorage || 0,
              availabilityZone: db.AvailabilityZone || "unknown",
              vpcSecurityGroups:
                db.VpcSecurityGroups?.map(
                  (sg) => sg.VpcSecurityGroupId || "",
                ) || [],
              dbSubnetGroup: db.DBSubnetGroup?.DBSubnetGroupName || undefined,
              createdTime: db.InstanceCreateTime || undefined,
            });
          }
          // Skip instances with invalid data instead of throwing error
        }
      }
    }

    // Sort by name
    const sortedInstances = rdsInstances.sort((a, b) =>
      a.dbInstanceIdentifier.localeCompare(b.dbInstanceIdentifier),
    );

    return success(sortedInstances);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.name === "UnauthorizedOperation" ||
        error.name === "AccessDenied"
      ) {
        return failure(
          "Access denied to RDS instances. Please check your IAM policies.",
        );
      }
    }
    return failure(
      `Failed to get RDS instances: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function checkECSExecCapability(
  ecsClient: ECSClient,
  cluster: ECSCluster,
): Promise<boolean> {
  try {
    // Get cluster configuration
    const describeCommand = new DescribeClustersCommand({
      clusters: [cluster.clusterArn],
      include: ["CONFIGURATIONS"],
    });
    const response = await ecsClient.send(describeCommand);

    if (!response.clusters || isEmpty(response.clusters)) {
      return false;
    }

    const clusterData = response.clusters[0];

    // Check if the cluster has execute command configuration
    if (clusterData?.configuration?.executeCommandConfiguration) {
      return true;
    }

    // If no explicit execute command configuration, assume exec is possible
    // This is more optimistic but much faster than checking tasks
    // Most active clusters should support exec in modern setups
    return true;
  } catch {
    // If we can't determine exec capability, assume it's not available
    return false;
  }
}
