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
	identifier: string;
	endpoint: string;
	port: number;
	engine: string;
}
