import { safeParse } from "valibot";
import { isTaskArnShape } from "../regex.js";
import {
  type ClusterArn,
  ClusterArnSchema,
  type ClusterName,
  ClusterNameSchema,
  type ContainerName,
  ContainerNameSchema,
  type DatabaseEngine,
  DatabaseEngineSchema,
  type DBEndpoint,
  DBEndpointSchema,
  type DBInstanceIdentifier,
  DBInstanceIdentifierSchema,
  type DBInstanceStatus,
  DBInstanceStatusSchema,
  failure,
  type Port,
  PortSchema,
  type RegionName,
  RegionNameSchema,
  type Result,
  type RuntimeId,
  RuntimeIdSchema,
  type ServiceName,
  ServiceNameSchema,
  success,
  type TaskArn,
  TaskArnSchema,
  type TaskId,
  TaskIdSchema,
  type TaskStatus,
  TaskStatusSchema,
} from "./branded.js";
import {
  type HandleConnectionParams,
  HandleConnectionParamsSchema,
  type SelectionState,
  SelectionStateSchema,
} from "./schemas.js";

// =============================================================================
// AWS Data Parsing Helper Functions
// =============================================================================

/**
 * Safely parse a cluster name from AWS API response
 */
export function parseClusterName(name: unknown): Result<ClusterName, string> {
  const result = safeParse(ClusterNameSchema, name);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid cluster name");
}

/**
 * Safely parse a cluster ARN from AWS API response
 */
export function parseClusterArn(arn: unknown): Result<ClusterArn, string> {
  const result = safeParse(ClusterArnSchema, arn);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid cluster ARN");
}

/**
 * Safely parse a task ARN from AWS API response
 */
export function parseTaskArn(arn: unknown): Result<TaskArn, string> {
  const result = safeParse(TaskArnSchema, arn);
  if (isTaskArnShape(arn) && result.success) {
    return success(result.output);
  }
  return failure("Invalid task ARN");
}

/**
 * Safely parse a region name from AWS API response
 */
export function parseRegionName(name: unknown): Result<RegionName, string> {
  const result = safeParse(RegionNameSchema, name);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid region name");
}

/**
 * Safely parse a service name from AWS API response
 */
export function parseServiceName(name: unknown): Result<ServiceName, string> {
  const result = safeParse(ServiceNameSchema, name);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid service name");
}

/**
 * Safely parse a task ID from AWS API response
 */
export function parseTaskId(id: unknown): Result<TaskId, string> {
  const result = safeParse(TaskIdSchema, id);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid task ID");
}

/**
 * Safely parse a runtime ID from AWS API response
 */
export function parseRuntimeId(id: unknown): Result<RuntimeId, string> {
  const result = safeParse(RuntimeIdSchema, id);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid runtime ID");
}

/**
 * Safely parse a database engine from AWS API response
 */
export function parseDatabaseEngine(
  engine: unknown,
): Result<DatabaseEngine, string> {
  const result = safeParse(DatabaseEngineSchema, engine);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid database engine");
}

/**
 * Safely parse a container name from AWS API response
 */
export function parseContainerName(
  name: unknown,
): Result<ContainerName, string> {
  const result = safeParse(ContainerNameSchema, name);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid container name");
}

/**
 * Safely parse a DB instance identifier from AWS API response
 */
export function parseDBInstanceIdentifier(
  id: unknown,
): Result<DBInstanceIdentifier, string> {
  const result = safeParse(DBInstanceIdentifierSchema, id);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid DB instance identifier");
}

/**
 * Safely parse a DB endpoint from AWS API response
 */
export function parseDBEndpoint(endpoint: unknown): Result<DBEndpoint, string> {
  const result = safeParse(DBEndpointSchema, endpoint);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid DB endpoint");
}

/**
 * Safely parse a port number from AWS API response
 */
export function parsePortNumber(port: unknown): Result<Port, string> {
  const result = safeParse(PortSchema, port);
  if (result.success) {
    return success(result.output);
  }
  return failure("Invalid port number");
}

/**
 * Safely parse task status from AWS API response
 */
export function parseTaskStatus(status: unknown): Result<TaskStatus, string> {
  const result = safeParse(TaskStatusSchema, status);
  if (result.success) {
    return success(result.output);
  }
  return failure(`Invalid task status: ${status}`);
}

/**
 * Safely parse DB instance status from AWS API response
 */
export function parseDBInstanceStatus(
  status: unknown,
): Result<DBInstanceStatus, string> {
  const result = safeParse(DBInstanceStatusSchema, status);
  if (result.success) {
    return success(result.output);
  }
  return failure(`Invalid DB instance status: ${status}`);
}

/**
 * Safely parse a runtime ID from AWS API response
 */
export function parseSelectionState(
  state: unknown,
): Result<SelectionState, string> {
  const result = safeParse(SelectionStateSchema, state);
  if (result.success) {
    return success(result.output);
  }
  return failure(`Invalid selection state: ${state}`);
}

export function parseHandleConnectionParams(
  params: unknown,
): Result<HandleConnectionParams, string> {
  const result = safeParse(HandleConnectionParamsSchema, params);
  if (result.success) {
    return success(result.output);
  }
  return failure(`Invalid handle connection params: ${params}`);
}
