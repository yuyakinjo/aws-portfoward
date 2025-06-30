import { DescribeRegionsCommand, type EC2Client } from "@aws-sdk/client-ec2";
import {
  DescribeClustersCommand,
  DescribeServicesCommand,
  DescribeTasksCommand,
  type ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  ListTasksCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";
import {
  DescribeDBInstancesCommand,
  type RDSClient,
} from "@aws-sdk/client-rds";
import { isEmpty } from "remeda";
import type {
  AWSRegion,
  ContainerName,
  ECSCluster,
  ECSService,
  ECSTask,
  ECSTaskContainersParams,
  EnableExecResult,
  RDSInstance,
  Result,
} from "./types.js";
import {
  failure,
  parseClusterArn,
  parseClusterName,
  parseContainerName,
  parseDatabaseEngine,
  parseDBEndpoint,
  parseDBInstanceIdentifier,
  parsePort,
  parseRegionName,
  parseRuntimeId,
  parseServiceArn,
  parseServiceName,
  parseTaskArn,
  parseTaskId,
  parseTaskStatus,
  success,
} from "./types.js";
import { messages } from "./utils/index.js";

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
      cluster: clusterName,
      tasks: [taskArn],
    });
    const response = await (ecsClient as ECSClient).send(describeCommand);
    if (!response.tasks || isEmpty(response.tasks)) {
      return failure("Task not found");
    }
    const [task] = response.tasks;
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
          const portResult = parsePort(db.Endpoint.Port || 5432);
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

/**
 * Get all ECS services in a cluster
 */
export async function getECSServices(
  ecsClient: ECSClient,
  cluster: ECSCluster,
): Promise<Result<ECSService[], string>> {
  try {
    // Get list of services
    const listCommand = new ListServicesCommand({
      cluster: cluster.clusterName,
    });
    const listResponse = await ecsClient.send(listCommand);

    if (!listResponse.serviceArns || isEmpty(listResponse.serviceArns)) {
      return success([]);
    }

    // Get detailed service information
    const describeCommand = new DescribeServicesCommand({
      cluster: cluster.clusterName,
      services: listResponse.serviceArns,
    });
    const describeResponse = await ecsClient.send(describeCommand);

    const services: ECSService[] = [];
    if (describeResponse.services) {
      for (const service of describeResponse.services) {
        if (service.serviceName && service.serviceArn) {
          const serviceNameResult = parseServiceName(service.serviceName);
          const serviceArnResult = parseServiceArn(service.serviceArn);

          if (serviceNameResult.success && serviceArnResult.success) {
            services.push({
              serviceName: serviceNameResult.data,
              serviceArn: serviceArnResult.data,
              clusterName: cluster.clusterName,
              status: service.status || "UNKNOWN",
              taskDefinition: service.taskDefinition || "",
              enableExecuteCommand: service.enableExecuteCommand || false,
              desiredCount: service.desiredCount || 0,
              runningCount: service.runningCount || 0,
              pendingCount: service.pendingCount || 0,
            });
          }
        }
      }
    }

    return success(services);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "ClusterNotFoundException") {
        return failure(`ECS cluster "${cluster.clusterName}" not found.`);
      }
      if (
        error.name === "UnauthorizedOperation" ||
        error.name === "AccessDenied"
      ) {
        return failure(
          "Access denied to ECS services. Please check your IAM policies.",
        );
      }
    }
    return failure(
      `Failed to get ECS services: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get all ECS services from all clusters (parallel processing for better performance)
 */
export async function getAllECSServices(
  ecsClient: ECSClient,
): Promise<Result<ECSService[], string>> {
  const clustersResult = await getECSClusters(ecsClient);
  if (!clustersResult.success) {
    return clustersResult;
  }

  // Process all clusters in parallel for better performance
  // Limit concurrency to avoid overwhelming the API
  const BATCH_SIZE = 5;
  const clusters = clustersResult.data;
  const allServices: ECSService[] = [];

  for (let i = 0; i < clusters.length; i += BATCH_SIZE) {
    const batch = clusters.slice(i, i + BATCH_SIZE);
    const batchStart = i + 1;
    const batchEnd = Math.min(i + BATCH_SIZE, clusters.length);

    // Show progress
    process.stdout.write(
      `\rProcessing clusters ${batchStart}-${batchEnd}/${clusters.length}...`,
    );

    const servicePromises = batch.map(async (cluster) => {
      const servicesResult = await getECSServices(ecsClient, cluster);
      return servicesResult.success ? servicesResult.data : [];
    });

    try {
      const serviceArrays = await Promise.all(servicePromises);
      allServices.push(...serviceArrays.flat());
    } catch (error) {
      return failure(
        `Failed to get services from clusters: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Clear the progress line
  messages.clearCurrentLine();

  return success(allServices);
}

/**
 * Get all ECS services that do not have exec enabled from all clusters
 */
export async function getAllECSServicesWithoutExec(
  ecsClient: ECSClient,
): Promise<Result<ECSService[], string>> {
  const servicesResult = await getAllECSServices(ecsClient);
  if (!servicesResult.success) {
    return servicesResult;
  }

  const servicesWithoutExec = servicesResult.data.filter(
    (service) => !service.enableExecuteCommand,
  );

  return success(servicesWithoutExec);
}

/**
 * Get ECS services that do not have exec enabled
 */
export async function getECSServicesWithoutExec(
  ecsClient: ECSClient,
  cluster: ECSCluster,
): Promise<Result<ECSService[], string>> {
  const servicesResult = await getECSServices(ecsClient, cluster);
  if (!servicesResult.success) {
    return servicesResult;
  }

  const servicesWithoutExec = servicesResult.data.filter(
    (service) => !service.enableExecuteCommand,
  );

  return success(servicesWithoutExec);
}

/**
 * Enable ECS exec for a specific service
 */
export async function enableECSExecForService(
  ecsClient: ECSClient,
  clusterName: string,
  serviceName: string,
): Promise<Result<EnableExecResult, string>> {
  try {
    // First, get current service state
    const describeCommand = new DescribeServicesCommand({
      cluster: clusterName,
      services: [serviceName],
    });
    const describeResponse = await ecsClient.send(describeCommand);

    if (!describeResponse.services || isEmpty(describeResponse.services)) {
      return failure(
        `Service "${serviceName}" not found in cluster "${clusterName}"`,
      );
    }

    const service = describeResponse.services[0];
    const previousState = service?.enableExecuteCommand || false;

    // If already enabled, return success without making changes
    if (previousState) {
      const serviceNameResult = parseServiceName(serviceName);
      const clusterNameResult = parseClusterName(clusterName);

      if (!serviceNameResult.success || !clusterNameResult.success) {
        return failure("Invalid service or cluster name format");
      }

      return success({
        serviceName: serviceNameResult.data,
        clusterName: clusterNameResult.data,
        previousState: true,
        newState: true,
        success: true,
      });
    }

    // Update service to enable exec
    const updateCommand = new UpdateServiceCommand({
      cluster: clusterName,
      service: serviceName,
      enableExecuteCommand: true,
    });

    await ecsClient.send(updateCommand);

    const serviceNameResult = parseServiceName(serviceName);
    const clusterNameResult = parseClusterName(clusterName);

    if (!serviceNameResult.success || !clusterNameResult.success) {
      return failure("Invalid service or cluster name format");
    }

    return success({
      serviceName: serviceNameResult.data,
      clusterName: clusterNameResult.data,
      previousState: false,
      newState: true,
      success: true,
    });
  } catch (error) {
    const serviceNameResult = parseServiceName(serviceName);
    const clusterNameResult = parseClusterName(clusterName);

    if (!serviceNameResult.success || !clusterNameResult.success) {
      return failure("Invalid service or cluster name format");
    }

    let errorMessage = `Failed to enable exec for service "${serviceName}": `;
    if (error instanceof Error) {
      if (error.name === "ServiceNotFoundException") {
        errorMessage += "Service not found";
      } else if (error.name === "ClusterNotFoundException") {
        errorMessage += "Cluster not found";
      } else if (
        error.name === "UnauthorizedOperation" ||
        error.name === "AccessDenied"
      ) {
        errorMessage += "Access denied. Please check your IAM policies";
      } else {
        errorMessage += error.message;
      }
    } else {
      errorMessage += String(error);
    }

    return success({
      serviceName: serviceNameResult.data,
      clusterName: clusterNameResult.data,
      previousState: false,
      newState: false,
      success: false,
      error: errorMessage,
    });
  }
}

/**
 * Enable ECS exec for multiple services
 */
export async function enableECSExecForServices(
  ecsClient: ECSClient,
  clusterName: string,
  serviceNames: string[],
): Promise<Result<EnableExecResult[], string>> {
  const results: EnableExecResult[] = [];

  for (const serviceName of serviceNames) {
    const result = await enableECSExecForService(
      ecsClient,
      clusterName,
      serviceName,
    );
    if (result.success) {
      results.push(result.data);
    } else {
      // Continue with other services even if one fails
      const serviceNameResult = parseServiceName(serviceName);
      const clusterNameResult = parseClusterName(clusterName);

      if (serviceNameResult.success && clusterNameResult.success) {
        results.push({
          serviceName: serviceNameResult.data,
          clusterName: clusterNameResult.data,
          previousState: false,
          newState: false,
          success: false,
          error: result.error,
        });
      }
    }
  }

  return success(results);
}
