import { isEmpty, isNumber, isString } from "remeda";
import {
  type BaseSchema,
  boolean,
  type InferOutput,
  integer,
  literal,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  optional,
  pipe,
  regex,
  string,
  transform,
  union,
  type ValiError,
} from "valibot";
import {
  AWS_REGION_NAME,
  DB_ENDPOINT_FORMAT,
  DIGITS_ONLY,
  isValidDbEndpoint,
  isValidRegionName,
} from "./regex.js";

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
export type DatabaseEngine = Brand<string, "DatabaseEngine">;

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
  regex(DIGITS_ONLY, "Port must be a number"),
  transform(Number),
  integer("Port must be an integer"),
  minValue(1, "Port must be greater than 0"),
  maxValue(65535, "Port must be less than 65536"),
  transform((port): Port => {
    // Additional validation for port range
    if (port < 1 || port > 65535) {
      throw new Error('Port must be between 1 and 65535');
    }
    return port as Port;
  }),
);

// Region name schema
export const RegionNameSchema = pipe(
  string(),
  minLength(1, "Region name cannot be empty"),
  regex(AWS_REGION_NAME, "Invalid region name format"),
  transform((region): RegionName => {
    if (!isValidRegionName(region)) {
      throw new Error('Invalid AWS region name format');
    }
    return region as RegionName;
  }),
);

// Cluster name schema
export const ClusterNameSchema = pipe(
  string(),
  minLength(1, "Cluster name cannot be empty"),
  transform((cluster): ClusterName => {
    if (cluster.trim() !== cluster) {
      throw new Error('Cluster name cannot have leading or trailing whitespace');
    }
    return cluster as ClusterName;
  }),
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
  engine: DatabaseEngine; // Now uses branded type
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
    task: TaskArn;
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

// =============================================================================
// AWS Resource Parsing Schemas
// =============================================================================

// Cluster ARN schema
export const ClusterArnSchema = pipe(
  string(),
  minLength(1, "Cluster ARN cannot be empty"),
  transform((arn): ClusterArn => arn as ClusterArn),
);

// Task ARN schema
export const TaskArnSchema = pipe(
  string(),
  minLength(1, "Task ARN cannot be empty"),
  transform((arn): TaskArn => arn as TaskArn),
);

// Task ID schema
export const TaskIdSchema = pipe(
  string(),
  minLength(1, "Task ID cannot be empty"),
  transform((id): TaskId => id as TaskId),
);

// Runtime ID schema
export const RuntimeIdSchema = pipe(
  string(),
  minLength(1, "Runtime ID cannot be empty"),
  transform((id): RuntimeId => id as RuntimeId),
);

// Service name schema
export const ServiceNameSchema = pipe(
  string(),
  minLength(1, "Service name cannot be empty"),
  transform((name): ServiceName => name as ServiceName),
);

// DB Instance Identifier schema
export const DBInstanceIdentifierSchema = pipe(
  string(),
  minLength(1, "DB Instance identifier cannot be empty"),
  transform((id): DBInstanceIdentifier => id as DBInstanceIdentifier),
);

// DB Endpoint schema
export const DBEndpointSchema = pipe(
  string(),
  minLength(1, "DB endpoint cannot be empty"),
  regex(DB_ENDPOINT_FORMAT, "Invalid DB endpoint format"),
  transform((endpoint): DBEndpoint => endpoint as DBEndpoint),
);

// Port number schema (for parsing from number)
export const PortNumberSchema = pipe(
  number(),
  integer("Port must be an integer"),
  minValue(1, "Port must be greater than 0"),
  maxValue(65535, "Port must be less than 65536"),
  transform((port): Port => port as Port),
);

// =============================================================================
// AWS Data Parsing Helper Functions
// =============================================================================

/**
 * Safely parse a cluster name from AWS API response
 */
export function parseClusterName(name: unknown): Result<ClusterName, string> {
  if (typeof name !== "string" || name.length === 0) {
    return failure("Invalid cluster name");
  }
  if (name.trim() !== name) {
    return failure("Cluster name cannot have leading or trailing whitespace");
  }
  return success(name as ClusterName);
}

/**
 * Safely parse a cluster ARN from AWS API response
 */
export function parseClusterArn(arn: unknown): Result<ClusterArn, string> {
  if (!isString(arn) || isEmpty(arn)) {
    return failure("Invalid cluster ARN");
  }
  return success(arn as ClusterArn);
}

/**
 * Safely parse a task ARN from AWS API response
 */
export function parseTaskArn(arn: unknown): Result<TaskArn, string> {
  if (!isString(arn) || isEmpty(arn)) {
    return failure("Invalid task ARN");
  }
  return success(arn as TaskArn);
}

/**
 * Safely parse a region name from AWS API response
 */
export function parseRegionName(name: unknown): Result<RegionName, string> {
  if (!isString(name) || isEmpty(name)) {
    return failure("Invalid region name");
  }
  if (!isValidRegionName(name)) {
    return failure("Invalid region name format");
  }
  return success(name as RegionName);
}

/**
 * Safely parse a service name from AWS API response
 */
export function parseServiceName(name: unknown): Result<ServiceName, string> {
  if (!isString(name) || isEmpty(name)) {
    return failure("Invalid service name");
  }
  return success(name as ServiceName);
}

/**
 * Safely parse a task ID from AWS API response
 */
export function parseTaskId(id: unknown): Result<TaskId, string> {
  if (!isString(id) || isEmpty(id)) {
    return failure("Invalid task ID");
  }
  return success(id as TaskId);
}

/**
 * Safely parse a runtime ID from AWS API response
 */
export function parseRuntimeId(id: unknown): Result<RuntimeId, string> {
  if (!isString(id) || isEmpty(id)) {
    return failure("Invalid runtime ID");
  }
  return success(id as RuntimeId);
}

/**
 * Safely parse a database engine from AWS API response
 */
export function parseDatabaseEngine(
  engine: unknown,
): Result<DatabaseEngine, string> {
  if (!isString(engine) || isEmpty(engine)) {
    return failure("Invalid database engine");
  }
  return success(engine as DatabaseEngine);
}

/**
 * Safely parse a container name from AWS API response
 */
export function parseContainerName(
  name: unknown,
): Result<ContainerName, string> {
  if (!isString(name) || isEmpty(name)) {
    return failure("Invalid container name");
  }
  return success(name as ContainerName);
}

/**
 * Safely parse a DB instance identifier from AWS API response
 */
export function parseDBInstanceIdentifier(
  id: unknown,
): Result<DBInstanceIdentifier, string> {
  if (!isString(id) || isEmpty(id)) {
    return failure("Invalid DB instance identifier");
  }
  return success(id as DBInstanceIdentifier);
}

/**
 * Safely parse a DB endpoint from AWS API response
 */
export function parseDBEndpoint(endpoint: unknown): Result<DBEndpoint, string> {
  if (!isString(endpoint) || isEmpty(endpoint)) {
    return failure("Invalid DB endpoint");
  }
  if (!isValidDbEndpoint(endpoint)) {
    return failure("Invalid DB endpoint format");
  }
  return success(endpoint as DBEndpoint);
}

/**
 * Safely parse a port number from AWS API response
 */
export function parsePortNumber(port: unknown): Result<Port, string> {
  if (!isNumber(port) || port < 1 || port > 65535 || !Number.isInteger(port)) {
    return failure("Invalid port number");
  }
  return success(port as Port);
}

// Define validTaskStatuses as a constant outside the function
const validTaskStatuses: TaskStatus[] = [
  "PROVISIONING",
  "PENDING",
  "ACTIVATING",
  "RUNNING",
  "DEACTIVATING",
  "STOPPING",
  "DEPROVISIONING",
  "STOPPED",
];

/**
 * Type guard for TaskStatus
 */
function isValidTaskStatus(status: string): status is TaskStatus {
  return validTaskStatuses.includes(status as TaskStatus);
}

/**
 * Safely parse task status from AWS API response
 */
export function parseTaskStatus(status: unknown): Result<TaskStatus, string> {
  if (!isString(status)) {
    return failure("Invalid task status");
  }

  if (isValidTaskStatus(status)) {
    return success(status);
  }

  return failure(`Unknown task status: ${status}`);
}

const validStatuses: DBInstanceStatus[] = [
  "available",
  "backing-up",
  "creating",
  "deleting",
  "maintenance",
  "modifying",
  "rebooting",
  "starting",
  "stopped",
  "stopping",
];

/**
 * Type guard for DBInstanceStatus
 */
function isValidDBInstanceStatus(status: string): status is DBInstanceStatus {
  return validStatuses.includes(status as DBInstanceStatus);
}

/**
 * Safely parse DB instance status from AWS API response
 */
export function parseDBInstanceStatus(
  status: unknown,
): Result<DBInstanceStatus, string> {
  if (!isString(status) || isEmpty(status)) {
    return failure("Invalid DB instance status");
  }

  if (isValidDBInstanceStatus(status)) {
    return success(status);
  }

  return failure(`Unknown DB instance status: ${status}`);
}
