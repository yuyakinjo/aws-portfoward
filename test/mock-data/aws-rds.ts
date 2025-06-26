import { parse } from "valibot";
import type { RDSInstance } from "../../src/types.js";
import { RDSInstanceSchema } from "../../src/types.js";

const rawMockData = [
  {
    dbInstanceIdentifier: "prod-web-db",
    endpoint: "prod-web-db.cluster-xyz.ap-northeast-1.rds.amazonaws.com",
    port: 3306,
    engine: "mysql",
    dbInstanceClass: "db.r5.large",
    dbInstanceStatus: "available",
    allocatedStorage: 100,
    availabilityZone: "ap-northeast-1a",
    vpcSecurityGroups: ["sg-12345678"],
    dbSubnetGroup: "prod-subnet-group",
    createdTime: new Date("2023-01-15T10:00:00Z"),
  },
  {
    dbInstanceIdentifier: "staging-api-postgres",
    endpoint: "staging-api.cluster-abc.ap-northeast-1.rds.amazonaws.com",
    port: 5432,
    engine: "postgres",
    dbInstanceClass: "db.t3.medium",
    dbInstanceStatus: "available",
    allocatedStorage: 50,
    availabilityZone: "ap-northeast-1c",
    vpcSecurityGroups: ["sg-87654321"],
    dbSubnetGroup: "staging-subnet-group",
    createdTime: new Date("2023-03-20T14:30:00Z"),
  },
  {
    dbInstanceIdentifier: "dev-app-mysql",
    endpoint: "dev-app-mysql.cluster-def.ap-northeast-1.rds.amazonaws.com",
    port: 3306,
    engine: "mysql",
    dbInstanceClass: "db.t3.small",
    dbInstanceStatus: "available",
    allocatedStorage: 20,
    availabilityZone: "ap-northeast-1a",
    vpcSecurityGroups: ["sg-11111111"],
    dbSubnetGroup: "dev-subnet-group",
    createdTime: new Date("2023-05-10T09:15:00Z"),
  },
  {
    dbInstanceIdentifier: "prod-api-aurora",
    endpoint: "prod-api-aurora.cluster-ghi.ap-northeast-1.rds.amazonaws.com",
    port: 3306,
    engine: "aurora-mysql",
    dbInstanceClass: "db.r6g.xlarge",
    dbInstanceStatus: "available",
    allocatedStorage: 200,
    availabilityZone: "ap-northeast-1a",
    vpcSecurityGroups: ["sg-22222222"],
    dbSubnetGroup: "prod-subnet-group",
    createdTime: new Date("2023-02-28T16:45:00Z"),
  },
  {
    dbInstanceIdentifier: "test-service-postgres",
    endpoint: "test-service.cluster-jkl.ap-northeast-1.rds.amazonaws.com",
    port: 5432,
    engine: "postgres",
    dbInstanceClass: "db.t3.micro",
    dbInstanceStatus: "available",
    allocatedStorage: 10,
    availabilityZone: "ap-northeast-1c",
    vpcSecurityGroups: ["sg-33333333"],
    dbSubnetGroup: "test-subnet-group",
    createdTime: new Date("2023-06-05T11:20:00Z"),
  },
];

// Parse mock data with schemas for type safety
export const mockRDSInstances: RDSInstance[] = rawMockData.map(instance => 
  parse(RDSInstanceSchema, instance)
);
