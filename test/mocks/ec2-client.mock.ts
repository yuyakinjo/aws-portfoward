import type { DescribeRegionsCommandInput } from "@aws-sdk/client-ec2";
import { mockAWSRegions } from "../mock-data/index.js";

interface MockCommand {
  constructor: { name: string };
  input?: unknown;
}

export class EC2Client {
  send(command: MockCommand) {
    const commandName = command.constructor.name;
    switch (commandName) {
      case "DescribeRegionsCommand":
        return Promise.resolve({
          Regions: mockAWSRegions.map((region) => ({
            RegionName: region.regionName,
            OptInStatus: region.optInStatus,
          })),
        });
      default:
        throw new Error(`Unknown command: ${commandName}`);
    }
  }
}

export class DescribeRegionsCommand {
  constructor(public input?: DescribeRegionsCommandInput) {}
}
