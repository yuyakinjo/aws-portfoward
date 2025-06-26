import type { DescribeDBInstancesCommandInput } from "@aws-sdk/client-rds";
import { mockRDSInstances } from "../mock-data/index.js";

interface MockCommand {
  constructor: { name: string };
  input?: unknown;
}

export class RDSClient {
  send(command: MockCommand) {
    const commandName = command.constructor.name;
    switch (commandName) {
      case "DescribeDBInstancesCommand":
        return Promise.resolve({
          DBInstances: mockRDSInstances.map((instance) => ({
            DBInstanceIdentifier: instance.dbInstanceIdentifier,
            Endpoint: {
              Address: instance.endpoint,
              Port: instance.port,
            },
            Engine: instance.engine,
            DBInstanceClass: instance.dbInstanceClass,
            DBInstanceStatus: instance.dbInstanceStatus,
            AllocatedStorage: instance.allocatedStorage,
            AvailabilityZone: instance.availabilityZone,
            VpcSecurityGroups: instance.vpcSecurityGroups.map((id) => ({
              VpcSecurityGroupId: id,
            })),
            DBSubnetGroup: {
              DBSubnetGroupName: instance.dbSubnetGroup,
            },
            InstanceCreateTime: instance.createdTime,
          })),
        });
      default:
        throw new Error(`Unknown command: ${commandName}`);
    }
  }
}

export class DescribeDBInstancesCommand {
  constructor(public input?: DescribeDBInstancesCommandInput) {}
}
