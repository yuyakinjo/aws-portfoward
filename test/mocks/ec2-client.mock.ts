import { mockAWSRegions } from "../mock-data/index.js";

export class EC2Client {
  send(command: any) {
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
  constructor(public input?: any) {}
}
