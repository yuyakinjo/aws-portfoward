import {
  type BaseSchema,
  boolean,
  type InferOutput,
  integer,
  literal,
  maxValue,
  minLength,
  minValue,
  object,
  optional,
  pipe,
  regex,
  string,
  transform,
  union,
  type ValiError,
} from "valibot";

// =============================================================================
// Branded Types - 不正な状態を表現できない型システム
// =============================================================================

/**
 * Branded type utility for creating unique types from primitives
 */
declare const brand: unique symbol;
type Brand<T, TBrand extends string> = T & { [brand]: TBrand };

// AWS Resource Identifiers
export type RegionName = Brand<string, "RegionName">;
export type ClusterName = Brand<string, "ClusterName">;
export type ClusterArn = Brand<string, "ClusterArn">;
export type TaskArn = Brand<string, "TaskArn">;
export type TaskId = Brand<string, "TaskId">;
export type RuntimeId = Brand<string, "RuntimeId">;
export type ServiceName = Brand<string, "ServiceName">;
export type DBInstanceIdentifier = Brand<string, "DBInstanceIdentifier">;
export type ContainerName = Brand<string, "ContainerName">;

// Network types
export type Port = Brand<number, "Port">;
export type DBEndpoint = Brand<string, "DBEndpoint">;

// =============================================================================
// Result Type Pattern - エラーハンドリングの改善
// =============================================================================

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export type ParseResult<T> = Result<
  T,
  ValiError<BaseSchema<unknown, unknown, never>>
>;

// =============================================================================
// Domain-specific Schemas with Parse-first approach
// =============================================================================

// Port schema with proper validation and transformation
export const PortSchema = pipe(
  string(),
  regex(/^\d+$/, "Port must be a number"),
  transform(Number),
  integer("Port must be an integer"),
  minValue(1, "Port must be greater than 0"),
  maxValue(65535, "Port must be less than 65536"),
  transform((port): Port => port as Port),
);

// Region name schema
export const RegionNameSchema = pipe(
  string(),
  minLength(1, "Region name cannot be empty"),
  regex(/^[a-z0-9-]+$/, "Invalid region name format"),
  transform((region): RegionName => region as RegionName),
);

// Cluster name schema
export const ClusterNameSchema = pipe(
  string(),
  minLength(1, "Cluster name cannot be empty"),
  transform((cluster): ClusterName => cluster as ClusterName),
);

// Task status with union types for compile-time safety
export const TaskStatusSchema = union([
  literal("PROVISIONING"),
  literal("PENDING"),
  literal("ACTIVATING"),
  literal("RUNNING"),
  literal("DEACTIVATING"),
  literal("STOPPING"),
  literal("DEPROVISIONING"),
  literal("STOPPED"),
]);
export type TaskStatus = InferOutput<typeof TaskStatusSchema>;

// DB Instance status
export const DBInstanceStatusSchema = union([
  literal("available"),
  literal("backing-up"),
  literal("creating"),
  literal("deleting"),
  literal("maintenance"),
  literal("modifying"),
  literal("rebooting"),
  literal("starting"),
  literal("stopped"),
  literal("stopping"),
]);
export type DBInstanceStatus = InferOutput<typeof DBInstanceStatusSchema>;

// =============================================================================
// Domain Entities with Parse-first Design
// =============================================================================

export interface ECSTask {
  taskArn: TaskArn; // Custom format for SSM: ecs:cluster_name_task_id_runtime_id
  realTaskArn: TaskArn; // Actual AWS Task ARN
  displayName: string;
  runtimeId: RuntimeId;
  taskId: TaskId;
  clusterName: ClusterName;
  serviceName: ServiceName;
  taskStatus: TaskStatus; // Now type-safe with union types
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
  engine: string;
  dbInstanceClass: string;
  dbInstanceStatus: DBInstanceStatus; // Now type-safe with union types
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

// =============================================================================
// Parsed/Validated Types (After Successful Parsing)
// =============================================================================

export interface DryRunResult {
  awsCommand: string;
  reproducibleCommand: string;
  sessionInfo: {
    region: RegionName;
    cluster: ClusterName;
    task: TaskId;
    rds?: DBInstanceIdentifier;
    rdsPort?: Port;
    localPort?: Port;
    container?: ContainerName;
    command?: string;
  };
}

// =============================================================================
// Parse-first Schemas for CLI Options
// =============================================================================

export const ConnectOptionsSchema = object({
  region: optional(RegionNameSchema),
  cluster: optional(ClusterNameSchema),
  task: optional(
    pipe(
      string(),
      minLength(1, "Task ID cannot be empty"),
      transform((task): TaskId => task as TaskId),
    ),
  ),
  rds: optional(
    pipe(
      string(),
      minLength(1, "RDS instance identifier cannot be empty"),
      transform((rds): DBInstanceIdentifier => rds as DBInstanceIdentifier),
    ),
  ),
  rdsPort: optional(PortSchema),
  localPort: optional(PortSchema),
  dryRun: optional(boolean(), false),
});

export const ExecOptionsSchema = object({
  region: optional(RegionNameSchema),
  cluster: optional(ClusterNameSchema),
  task: optional(
    pipe(
      string(),
      minLength(1, "Task ID cannot be empty"),
      transform((task): TaskId => task as TaskId),
    ),
  ),
  container: optional(
    pipe(
      string(),
      minLength(1, "Container name cannot be empty"),
      transform((container): ContainerName => container as ContainerName),
    ),
  ),
  command: optional(pipe(string(), minLength(1, "Command cannot be empty"))),
  dryRun: optional(boolean(), false),
});

// =============================================================================
// Parsed Types - 型安全性を保証されたデータ構造
// =============================================================================

export type ValidatedConnectOptions = InferOutput<typeof ConnectOptionsSchema>;
export type ValidatedExecOptions = InferOutput<typeof ExecOptionsSchema>;

// =============================================================================
// Utility Functions for Type Guards and Parsing
// =============================================================================

/**
 * Helper function to create a successful result
 */
export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper function to create a failed result
 */
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Type guard to check if Result is successful
 */
export function isSuccess<T, E>(
  result: Result<T, E>,
): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard to check if Result is failed
 */
export function isFailure<T, E>(
  result: Result<T, E>,
): result is { success: false; error: E } {
  return !result.success;
}
