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
