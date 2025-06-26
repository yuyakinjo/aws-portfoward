import { isNumber, isString } from "remeda";
import { parse } from "valibot";
import { isEmpty } from "../utils/index.js";
import { isValidDbEndpoint, isValidRegionName } from "../regex.js";
import {
  failure,
  success,
  RuntimeIdSchema,
  type ClusterArn,
  type ClusterName,
  type ContainerName,
  type DatabaseEngine,
  type DBEndpoint,
  type DBInstanceIdentifier,
  type DBInstanceStatus,
  type Port,
  type RegionName,
  type Result,
  type RuntimeId,
  type ServiceName,
  type TaskArn,
  type TaskId,
  type TaskStatus,
} from "./branded.js";

// =============================================================================
// AWS Data Parsing Helper Functions
// =============================================================================

/**
 * Safely parse a cluster name from AWS API response
 */
export function parseClusterName(name: unknown): Result<ClusterName, string> {
  if (typeof name !== "string" || isEmpty(name)) {
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
  return success(parse(RuntimeIdSchema, id));
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