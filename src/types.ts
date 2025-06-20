import * as v from "valibot";

export interface ECSTask {
	taskArn: string;
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

// Valibot schema for ConnectOptions
export const ConnectOptionsSchema = v.object({
	region: v.optional(
		v.pipe(v.string(), v.minLength(1, "Region cannot be empty")),
	),
	cluster: v.optional(
		v.pipe(v.string(), v.minLength(1, "Cluster name cannot be empty")),
	),
	task: v.optional(
		v.pipe(v.string(), v.minLength(1, "Task ID cannot be empty")),
	),
	rds: v.optional(
		v.pipe(
			v.string(),
			v.minLength(1, "RDS instance identifier cannot be empty"),
		),
	),
	rdsPort: v.optional(
		v.pipe(
			v.string(),
			v.minLength(1, "RDS port cannot be empty"),
			v.regex(/^\d+$/, "RDS port must be a number"),
			v.transform(Number),
			v.integer("RDS port must be an integer"),
			v.minValue(1, "RDS port must be greater than 0"),
			v.maxValue(65535, "RDS port must be less than 65536"),
		),
	),
	localPort: v.optional(
		v.pipe(
			v.string(),
			v.minLength(1, "Local port cannot be empty"),
			v.regex(/^\d+$/, "Local port must be a number"),
			v.transform(Number),
			v.integer("Local port must be an integer"),
			v.minValue(1, "Local port must be greater than 0"),
			v.maxValue(65535, "Local port must be less than 65536"),
		),
	),
});

// Type derived from schema
export type ValidatedConnectOptions = v.InferOutput<
	typeof ConnectOptionsSchema
>;
