import {
  array,
  boolean,
  custom,
  type InferOutput,
  literal,
  minLength,
  number,
  object,
  optional,
  pipe,
  string,
  transform,
  union,
} from "valibot";
import {
  ClusterArnSchema,
  ClusterNameSchema,
  type ContainerName,
  type DatabaseEngine,
  type DBEndpoint,
  type DBInstanceIdentifier,
  DBInstanceIdentifierSchema,
  DBInstanceStatusSchema,
  ECSClientSchema,
  PortNumberSchema,
  PortSchema,
  RegionNameSchema,
  RuntimeIdSchema,
  ServiceNameSchema,
  TaskArnSchema,
  TaskIdSchema,
  TaskStatusSchema,
} from "./branded.js";

// =============================================================================
// Entity Schemas
// =============================================================================

// RDS Instance schema for parsing AWS API responses
export const RDSInstanceSchema = object({
  dbInstanceIdentifier: pipe(
    string(),
    minLength(1, "DB Instance identifier cannot be empty"),
    transform((id): DBInstanceIdentifier => id as DBInstanceIdentifier),
  ),
  endpoint: pipe(
    string(),
    minLength(1, "DB endpoint cannot be empty"),
    transform((endpoint): DBEndpoint => endpoint as DBEndpoint),
  ),
  port: PortNumberSchema,
  engine: pipe(
    string(),
    minLength(1, "Database engine cannot be empty"),
    transform((engine): DatabaseEngine => engine as DatabaseEngine),
  ),
  dbInstanceClass: string(),
  dbInstanceStatus: DBInstanceStatusSchema,
  allocatedStorage: number(),
  availabilityZone: string(),
  vpcSecurityGroups: pipe(
    union([string(), array(string())]),
    transform((groups): string[] =>
      Array.isArray(groups) ? groups : [groups],
    ),
  ),
  dbSubnetGroup: optional(string()),
  createdTime: optional(
    pipe(
      string(),
      transform((dateStr): Date => new Date(dateStr)),
    ),
  ),
});

// =============================================================================
// Parameter Schemas
// =============================================================================

// Dry Run Parameter Schemas
export const ConnectDryRunParamsSchema = object({
  region: RegionNameSchema,
  cluster: ClusterNameSchema,
  task: TaskIdSchema,
  rdsInstance: RDSInstanceSchema,
  rdsPort: PortNumberSchema,
  localPort: PortNumberSchema,
});

export const ExecDryRunParamsSchema = object({
  region: RegionNameSchema,
  cluster: ClusterNameSchema,
  task: TaskIdSchema,
  container: pipe(
    string(),
    minLength(1, "Container name cannot be empty"),
    transform((container): ContainerName => container as ContainerName),
  ),
  command: pipe(string(), minLength(1, "Command cannot be empty")),
});

export const ReproducibleCommandParamsSchema = object({
  region: RegionNameSchema,
  cluster: ClusterNameSchema,
  task: TaskArnSchema,
  rds: DBInstanceIdentifierSchema,
  rdsPort: PortNumberSchema,
  localPort: PortNumberSchema,
});

export const SSMSessionParamsSchema = object({
  taskArn: TaskArnSchema,
  rdsInstance: RDSInstanceSchema,
  rdsPort: PortNumberSchema,
  localPort: PortNumberSchema,
  reproducibleCommand: optional(pipe(string(), minLength(1))),
});

export const ECSExecParamsSchema = object({
  region: RegionNameSchema,
  clusterName: ClusterNameSchema,
  taskArn: union([TaskArnSchema, TaskIdSchema]),
  containerName: pipe(
    string(),
    minLength(1, "Container name cannot be empty"),
    transform((container): ContainerName => container as ContainerName),
  ),
  command: pipe(string(), minLength(1, "Command cannot be empty")),
});

// Task scoring parameter schemas
export const TaskScoringParamsSchema = object({
  ecsClient: ECSClientSchema,
  tasks: array(
    object({
      taskArn: TaskArnSchema,
      displayName: string(),
      runtimeId: RuntimeIdSchema,
      taskId: TaskIdSchema,
      clusterName: ClusterNameSchema,
      serviceName: ServiceNameSchema,
      taskStatus: TaskStatusSchema,
    }),
  ),
  cluster: object({
    clusterName: ClusterNameSchema,
    clusterArn: ClusterArnSchema,
  }),
  rdsInstance: RDSInstanceSchema,
  analysisResults: object({
    environment: array(
      object({
        rds_identifier: string(),
        task_family: optional(string()),
        confidence: union([literal("high"), literal("medium"), literal("low")]),
        key: string(),
        value: string(),
        score: number(),
      }),
    ),
    naming: array(
      object({
        pattern: string(),
        score: number(),
        reason: string(),
      }),
    ),
    network: array(
      object({
        subnet: string(),
        score: number(),
        accessible: boolean(),
      }),
    ),
  }),
});

// ECS target selection parameter schemas
export const ECSTargetSelectionOptionsSchema = object({
  cluster: optional(ClusterNameSchema),
  task: optional(TaskIdSchema),
});

export const ECSTargetSelectionParamsSchema = object({
  ecsClient: ECSClientSchema,
  selectedRDS: RDSInstanceSchema,
  options: ECSTargetSelectionOptionsSchema,
  selections: object({
    region: string(),
    ecsCluster: optional(string()),
    localPort: optional(string()),
  }),
});

// Environment check parameter schemas
export const TaskEnvironmentCheckParamsSchema = object({
  ecsClient: ECSClientSchema,
  task: object({
    taskArn: TaskArnSchema,
    displayName: string(),
    runtimeId: RuntimeIdSchema,
    taskId: TaskIdSchema,
    clusterName: ClusterNameSchema,
    serviceName: ServiceNameSchema,
    taskStatus: TaskStatusSchema,
  }),
  rdsInstance: RDSInstanceSchema,
});

export const TaskNamingScoringParamsSchema = object({
  tasks: array(
    object({
      taskArn: TaskArnSchema,
      displayName: string(),
      runtimeId: RuntimeIdSchema,
      taskId: TaskIdSchema,
      clusterName: ClusterNameSchema,
      serviceName: ServiceNameSchema,
      taskStatus: TaskStatusSchema,
    }),
  ),
  cluster: object({
    clusterName: ClusterNameSchema,
    clusterArn: ClusterArnSchema,
  }),
  rdsInstance: RDSInstanceSchema,
});

export const ECSTaskContainersParamsSchema = object({
  ecsClient: ECSClientSchema,
  clusterName: ClusterNameSchema,
  taskArn: TaskArnSchema,
});

// Search parameter schemas
export const SearchParamsSchema = object({
  items: array(
    union([
      object({ clusterName: ClusterNameSchema }),
      object({ dbInstanceIdentifier: DBInstanceIdentifierSchema }),
      object({ taskArn: TaskArnSchema }),
      object({ regionName: RegionNameSchema }),
    ]),
  ),
  input: pipe(string(), minLength(0)),
  defaultValue: optional(union([string(), object({})])),
});

export const ClusterInferenceParamsSchema = object({
  rdsName: DBInstanceIdentifierSchema,
  allClusters: array(
    object({
      clusterName: ClusterNameSchema,
      clusterArn: ClusterArnSchema,
    }),
  ),
});

// Search parameter schemas
export const UniversalSearchConfigSchema = object({
  items: array(
    union([
      object({ clusterName: ClusterNameSchema }),
      object({ dbInstanceIdentifier: DBInstanceIdentifierSchema }),
      object({ taskArn: TaskArnSchema }),
      object({ regionName: RegionNameSchema }),
    ]),
  ),
  searchKeys: array(string()),
  displayFormatter: custom<(item: unknown) => string>((input) => {
    return typeof input === "function";
  }, "Invalid display formatter function"),
  emptyInputFormatter: optional(
    custom<(item: unknown) => string>((input) => {
      return typeof input === "function";
    }, "Invalid empty input formatter function"),
  ),
  threshold: optional(number()),
  distance: optional(number()),
  pageSize: optional(number()),
});

export const UniversalSearchParamsSchema = object({
  config: UniversalSearchConfigSchema,
  input: string(),
  defaultValue: optional(union([string(), object({})])),
});

export const KeywordSearchParamsSchema = object({
  items: array(
    union([
      object({ clusterName: ClusterNameSchema }),
      object({ dbInstanceIdentifier: DBInstanceIdentifierSchema }),
      object({ taskArn: TaskArnSchema }),
    ]),
  ),
  input: string(),
  searchFields: custom<(item: unknown) => string[]>((input) => {
    return typeof input === "function";
  }, "Invalid search fields function"),
});

export const SearchRegionsParamsSchema = object({
  regions: array(
    object({
      regionName: RegionNameSchema,
      optInStatus: string(),
    }),
  ),
  input: string(),
  defaultRegion: optional(string()),
});

export const SearchClustersParamsSchema = object({
  clusters: array(
    object({
      clusterName: ClusterNameSchema,
      clusterArn: ClusterArnSchema,
    }),
  ),
  input: string(),
});

export const SearchTasksParamsSchema = object({
  tasks: array(
    object({
      taskArn: TaskArnSchema,
      displayName: string(),
      runtimeId: RuntimeIdSchema,
      taskId: TaskIdSchema,
      clusterName: ClusterNameSchema,
      serviceName: ServiceNameSchema,
      taskStatus: TaskStatusSchema,
    }),
  ),
  input: string(),
});

export const SearchRDSParamsSchema = object({
  rdsInstances: array(RDSInstanceSchema),
  input: string(),
});

export const SearchContainersParamsSchema = object({
  containers: array(string()),
  input: string(),
});

export const SearchInferenceResultsParamsSchema = object({
  results: array(
    object({
      cluster: object({
        clusterName: ClusterNameSchema,
        clusterArn: ClusterArnSchema,
      }),
      score: number(),
      reasons: array(string()),
    }),
  ),
  input: string(),
});

// Parse-first Schemas for CLI Options
export const ConnectOptionsSchema = object({
  region: optional(RegionNameSchema),
  cluster: optional(ClusterNameSchema),
  task: optional(
    pipe(
      string(),
      minLength(1, "Task ID cannot be empty"),
      transform(
        (task): import("./branded.js").TaskId =>
          task as import("./branded.js").TaskId,
      ),
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
      transform(
        (task): import("./branded.js").TaskId =>
          task as import("./branded.js").TaskId,
      ),
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
// UI Selection State Schema
// =============================================================================
export const SelectionStateSchema = object({
  region: optional(RegionNameSchema),
  rds: optional(DBInstanceIdentifierSchema),
  rdsPort: optional(PortNumberSchema),
  ecsTarget: optional(string()),
  ecsCluster: optional(string()),
  localPort: optional(PortNumberSchema),
});

// =============================================================================
// InferenceResult Schema
// =============================================================================
export const ECSClusterSchema = object({
  clusterName: ClusterNameSchema,
  clusterArn: ClusterArnSchema,
});

export const InferenceResultSchema = object({
  cluster: ECSClusterSchema,
  score: number(),
  reasons: array(string()),
  task: object({
    taskArn: TaskArnSchema,
    displayName: string(),
    runtimeId: RuntimeIdSchema,
    taskId: TaskIdSchema,
    clusterName: ClusterNameSchema,
    serviceName: ServiceNameSchema,
    taskStatus: TaskStatusSchema,
    createdAt: optional(string()), // Date型はstringで受けて後で変換
  }),
});

/**
 * handleConnection用スキーマ
 */
export const HandleConnectionParamsSchema = object({
  selections: SelectionStateSchema,
  selectedRDS: RDSInstanceSchema,
  selectedTask: string(),
  selectedInference: InferenceResultSchema,
  rdsPort: PortNumberSchema,
  options: object({ dryRun: optional(boolean()) }),
});

// =============================================================================
// Type Exports
// =============================================================================

export type ConnectDryRunParams = InferOutput<typeof ConnectDryRunParamsSchema>;
export type ExecDryRunParams = InferOutput<typeof ExecDryRunParamsSchema>;
export type ReproducibleCommandParams = InferOutput<
  typeof ReproducibleCommandParamsSchema
>;
export type SSMSessionParams = InferOutput<typeof SSMSessionParamsSchema>;
export type ECSExecParams = InferOutput<typeof ECSExecParamsSchema>;
export type TaskScoringParams = InferOutput<typeof TaskScoringParamsSchema>;
export type ECSTargetSelectionOptions = InferOutput<
  typeof ECSTargetSelectionOptionsSchema
>;
export type ECSTargetSelectionParams = InferOutput<
  typeof ECSTargetSelectionParamsSchema
>;
export type TaskEnvironmentCheckParams = InferOutput<
  typeof TaskEnvironmentCheckParamsSchema
>;
export type TaskNamingScoringParams = InferOutput<
  typeof TaskNamingScoringParamsSchema
>;
export type ECSTaskContainersParams = InferOutput<
  typeof ECSTaskContainersParamsSchema
>;
export type SearchParams = InferOutput<typeof SearchParamsSchema>;
export type ClusterInferenceParams = InferOutput<
  typeof ClusterInferenceParamsSchema
>;
export type UniversalSearchConfig = InferOutput<
  typeof UniversalSearchConfigSchema
>;
export type UniversalSearchParams = InferOutput<
  typeof UniversalSearchParamsSchema
>;
export type KeywordSearchParams = InferOutput<typeof KeywordSearchParamsSchema>;
export type SearchRegionsParams = InferOutput<typeof SearchRegionsParamsSchema>;
export type SearchClustersParams = InferOutput<
  typeof SearchClustersParamsSchema
>;
export type SearchTasksParams = InferOutput<typeof SearchTasksParamsSchema>;
export type SearchRDSParams = InferOutput<typeof SearchRDSParamsSchema>;
export type SearchContainersParams = InferOutput<
  typeof SearchContainersParamsSchema
>;
export type SearchInferenceResultsParams = InferOutput<
  typeof SearchInferenceResultsParamsSchema
>;
export type ValidatedConnectOptions = InferOutput<typeof ConnectOptionsSchema>;
export type ValidatedExecOptions = InferOutput<typeof ExecOptionsSchema>;

export type SelectionState = InferOutput<typeof SelectionStateSchema>;

export type HandleConnectionParams = InferOutput<
  typeof HandleConnectionParamsSchema
>;
