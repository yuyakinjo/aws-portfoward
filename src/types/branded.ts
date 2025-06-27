import type { ECSClient } from "@aws-sdk/client-ecs";
import { isFunction } from "remeda";
import {
  array,
  type BaseSchema,
  brand,
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
  unknown,
  type ValiError,
} from "valibot";
import { AWS_REGION_NAME, DB_ENDPOINT_FORMAT, DIGITS_ONLY } from "../regex.js";

// =============================================================================
// Branded Types - 不正な状態を表現できない型システム
// =============================================================================

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
// Basic Schemas
// =============================================================================

// Port schema with proper validation and branding
export const PortSchema = pipe(
  string(),
  regex(DIGITS_ONLY, "Port must be a number"),
  transform(Number),
  integer("Port must be an integer"),
  minValue(1, "Port must be greater than 0"),
  maxValue(65535, "Port must be less than 65536"),
  brand("Port"),
);
export type Port = InferOutput<typeof PortSchema>;

// Port number schema (for parsing from number)
export const PortNumberSchema = pipe(
  number(),
  integer("Port must be an integer"),
  minValue(1, "Port must be greater than 0"),
  maxValue(65535, "Port must be less than 65536"),
  brand("Port"),
);

// Region name schema
export const RegionNameSchema = pipe(
  string(),
  minLength(1, "Region name cannot be empty"),
  regex(AWS_REGION_NAME, "Invalid region name format"),
  brand("RegionName"),
);
export type RegionName = InferOutput<typeof RegionNameSchema>;

// Cluster name schema
export const ClusterNameSchema = pipe(
  string(),
  minLength(1, "Cluster name cannot be empty"),
  transform((cluster) => {
    if (cluster.trim() !== cluster) {
      throw new Error(
        "Cluster name cannot have leading or trailing whitespace",
      );
    }
    return cluster;
  }),
  brand("ClusterName"),
);
export type ClusterName = InferOutput<typeof ClusterNameSchema>;

// Cluster ARN schema
export const ClusterArnSchema = pipe(
  string(),
  minLength(1, "Cluster ARN cannot be empty"),
  brand("ClusterArn"),
);
export type ClusterArn = InferOutput<typeof ClusterArnSchema>;

// Task ARN schema
export const TaskArnSchema = pipe(
  string(),
  minLength(1, "Task ARN cannot be empty"),
  brand("TaskArn"),
);
export type TaskArn = InferOutput<typeof TaskArnSchema>;

// Task ID schema
export const TaskIdSchema = pipe(
  string(),
  minLength(1, "Task ID cannot be empty"),
  brand("TaskId"),
);
export type TaskId = InferOutput<typeof TaskIdSchema>;

// Runtime ID schema
export const RuntimeIdSchema = pipe(
  string(),
  minLength(1, "Runtime ID cannot be empty"),
  brand("RuntimeId"),
);
export type RuntimeId = InferOutput<typeof RuntimeIdSchema>;

// Service name schema
export const ServiceNameSchema = pipe(
  string(),
  minLength(1, "Service name cannot be empty"),
  brand("ServiceName"),
);
export type ServiceName = InferOutput<typeof ServiceNameSchema>;

// DB Instance Identifier schema
export const DBInstanceIdentifierSchema = pipe(
  string(),
  minLength(1, "DB Instance identifier cannot be empty"),
  brand("DBInstanceIdentifier"),
);
export type DBInstanceIdentifier = InferOutput<
  typeof DBInstanceIdentifierSchema
>;

// DB Endpoint schema
export const DBEndpointSchema = pipe(
  string(),
  minLength(1, "DB endpoint cannot be empty"),
  regex(DB_ENDPOINT_FORMAT, "Invalid DB endpoint format"),
  brand("DBEndpoint"),
);
export type DBEndpoint = InferOutput<typeof DBEndpointSchema>;

// Additional branded types
export const ContainerNameSchema = pipe(
  string(),
  minLength(1, "Container name cannot be empty"),
  brand("ContainerName"),
);
export type ContainerName = InferOutput<typeof ContainerNameSchema>;

export const DatabaseEngineSchema = pipe(
  string(),
  minLength(1, "Database engine cannot be empty"),
  brand("DatabaseEngine"),
);
export type DatabaseEngine = InferOutput<typeof DatabaseEngineSchema>;

// Command schema for CLI commands
export const CommandSchema = pipe(
  string(),
  minLength(1, "Command cannot be empty"),
);
export type Command = InferOutput<typeof CommandSchema>;

// Optional command schema for CLI commands
export const OptionalCommandSchema = optional(CommandSchema);

// Non-empty string schema for reusable validation
export const NonEmptyStringSchema = pipe(
  string(),
  minLength(1, "String cannot be empty"),
);

// VPC Security Groups schema (can be string or array of strings)
export const VpcSecurityGroupsSchema = pipe(
  union([string(), array(string())]),
  transform((groups): string[] => (Array.isArray(groups) ? groups : [groups])),
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

// AWS SDK Custom Schemas
export const ECSClientSchema = pipe(
  object({
    send: unknown(),
  }),
  transform((input) => {
    if (!isFunction(input.send)) {
      throw new Error("Invalid ECS Client: send method is not a function");
    }
    return input as ECSClient;
  }),
);

// =============================================================================
// Utility Functions
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

/**
 * Safely unwrap a branded type to its underlying string value
 */
export function unwrapBrandedString<T extends string>(
  value: T | undefined,
): string | undefined {
  return value;
}

/**
 * Safely unwrap a branded type to its underlying number value
 */
export function unwrapBrandedNumber<T extends number>(
  value: T | undefined,
): number | undefined {
  return value;
}
