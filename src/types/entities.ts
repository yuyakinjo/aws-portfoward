import type {
  ClusterArn,
  ClusterName,
  ContainerName,
  DatabaseEngine,
  DBEndpoint,
  DBInstanceIdentifier,
  DBInstanceStatus,
  Port,
  RegionName,
  RuntimeId,
  ServiceArn,
  ServiceName,
  TaskArn,
  TaskId,
  TaskStatus,
} from "./branded.js";

// =============================================================================
// Domain Entities
// =============================================================================

export interface ECSTask {
  taskArn: TaskArn; // Custom format for SSM: ecs:cluster_name_task_id_runtime_id
  realTaskArn: TaskArn; // Actual AWS Task ARN
  displayName: string;
  runtimeId: RuntimeId;
  taskId: TaskId;
  clusterName: ClusterName;
  serviceName: ServiceName;
  taskStatus: TaskStatus;
  createdAt?: Date;
}

export interface ECSCluster {
  clusterName: ClusterName;
  clusterArn: ClusterArn;
}

export interface RDSInstance {
  dbInstanceIdentifier: DBInstanceIdentifier;
  endpoint: DBEndpoint;
  port: Port;
  engine: DatabaseEngine;
  dbInstanceClass: string;
  dbInstanceStatus: DBInstanceStatus;
  allocatedStorage: number;
  availabilityZone: string;
  vpcSecurityGroups: string[];
  dbSubnetGroup?: string;
  createdTime?: Date;
}

export interface AWSRegion {
  regionName: RegionName;
  optInStatus: string;
}

export interface InferenceResult {
  cluster: ECSCluster;
  score: number;
  reasons: string[];
}

export interface DryRunResult {
  awsCommand: string;
  reproducibleCommand: string;
  sessionInfo: {
    region: RegionName;
    cluster: ClusterName;
    task: TaskArn;
    rds?: DBInstanceIdentifier;
    rdsPort?: Port;
    localPort?: Port;
    container?: ContainerName;
    command?: string;
  };
}

// =============================================================================
// Input Options (Before Parsing)
// =============================================================================

export interface ConnectOptions {
  region?: string;
  cluster?: string;
  task?: string;
  rds?: string;
  rdsPort?: string;
  localPort?: string;
  dryRun?: boolean;
}

export interface ExecOptions {
  region?: string;
  cluster?: string;
  task?: string;
  container?: string;
  command?: string;
  dryRun?: boolean;
}

export interface EnableExecOptions {
  region?: string;
  cluster?: string;
  service?: string;
  dryRun?: boolean;
}

export interface ECSService {
  serviceName: ServiceName;
  serviceArn: ServiceArn;
  clusterName: ClusterName;
  status: string;
  taskDefinition: string;
  enableExecuteCommand: boolean;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
}

export interface EnableExecResult {
  serviceName: ServiceName;
  clusterName: ClusterName;
  previousState: boolean;
  newState: boolean;
  success: boolean;
  error?: string;
}

export interface ProcessClusterServicesParams {
  ecsClient: import("@aws-sdk/client-ecs").ECSClient;
  cluster: ECSCluster;
  options: EnableExecOptions;
}
