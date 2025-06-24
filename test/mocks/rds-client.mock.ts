import { mockRDSInstances } from "../mock-data/index.js";

export class RDSClient {
  send(command: any) {
    const commandName = command.constructor.name;
    switch (commandName) {
      case "DescribeDBInstancesCommand":
        return Promise.resolve({
          DBInstances: mockRDSInstances,
        });
      default:
        throw new Error(`Unknown command: ${commandName}`);
    }
  }
}

export class DescribeDBInstancesCommand {
  constructor(public input?: any) {}
}
