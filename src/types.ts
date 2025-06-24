import {
  type InferOutput,
  integer,
  maxValue,
  minLength,
  minValue,
  object,
  optional,
  pipe,
  regex,
  string,
  transform,
} from "valibot";

export interface ECSTask {
  taskArn: string; // Custom format for SSM: ecs:cluster_name_task_id_runtime_id
  realTaskArn: string; // Actual AWS Task ARN
  displayName: string;
  runtimeId: string;
  taskId: string;
  clusterName: string;
  serviceName: string;
  taskStatus: string;
  createdAt?: Date;
}

export interface ECSCluster {
  clusterName: string;
  clusterArn: string;
}

export interface RDSInstance {
  dbInstanceIdentifier: string;
  endpoint: string;
  port: number;
  engine: string;
  dbInstanceClass: string;
  dbInstanceStatus: string;
  allocatedStorage: number;
  availabilityZone: string;
  vpcSecurityGroups: string[];
  dbSubnetGroup?: string;
  createdTime?: Date;
}

export interface AWSRegion {
  regionName: string;
  optInStatus: string;
}

export interface ConnectOptions {
  region?: string;
  cluster?: string;
  task?: string;
  rds?: string;
  rdsPort?: string;
  localPort?: string;
}

export interface ExecOptions {
  region?: string;
  cluster?: string;
  task?: string;
  container?: string;
  command?: string;
}

// Valibot schema for ConnectOptions
export const ConnectOptionsSchema = object({
  region: optional(pipe(string(), minLength(1, "Region cannot be empty"))),
  cluster: optional(
    pipe(string(), minLength(1, "Cluster name cannot be empty")),
  ),
  task: optional(pipe(string(), minLength(1, "Task ID cannot be empty"))),
  rds: optional(
    pipe(string(), minLength(1, "RDS instance identifier cannot be empty")),
  ),
  rdsPort: optional(
    pipe(
      string(),
      minLength(1, "RDS port cannot be empty"),
      regex(/^\d+$/, "RDS port must be a number"),
      transform(Number),
      integer("RDS port must be an integer"),
      minValue(1, "RDS port must be greater than 0"),
      maxValue(65535, "RDS port must be less than 65536"),
    ),
  ),
  localPort: optional(
    pipe(
      string(),
      minLength(1, "Local port cannot be empty"),
      regex(/^\d+$/, "Local port must be a number"),
      transform(Number),
      integer("Local port must be an integer"),
      minValue(1, "Local port must be greater than 0"),
      maxValue(65535, "Local port must be less than 65536"),
    ),
  ),
});

// Type derived from schema
export type ValidatedConnectOptions = InferOutput<typeof ConnectOptionsSchema>;

// Valibot schema for ExecOptions
export const ExecOptionsSchema = object({
  region: optional(pipe(string(), minLength(1, "Region cannot be empty"))),
  cluster: optional(
    pipe(string(), minLength(1, "Cluster name cannot be empty")),
  ),
  task: optional(pipe(string(), minLength(1, "Task ID cannot be empty"))),
  container: optional(
    pipe(string(), minLength(1, "Container name cannot be empty")),
  ),
  command: optional(pipe(string(), minLength(1, "Command cannot be empty"))),
});

// Type derived from schema
export type ValidatedExecOptions = InferOutput<typeof ExecOptionsSchema>;
