import { parse } from "valibot";
import type { AWSRegion } from "../../src/types.js";
import { RegionNameSchema } from "../../src/types.js";

const rawMockData = [
  { regionName: "ap-northeast-1", optInStatus: "opt-in-not-required" },
  { regionName: "us-east-1", optInStatus: "opt-in-not-required" },
  { regionName: "us-west-2", optInStatus: "opt-in-not-required" },
  { regionName: "eu-west-1", optInStatus: "opt-in-not-required" },
  { regionName: "ap-northeast-2", optInStatus: "opt-in-not-required" },
  { regionName: "ap-southeast-1", optInStatus: "opt-in-not-required" },
  { regionName: "eu-central-1", optInStatus: "opt-in-not-required" },
  { regionName: "us-east-2", optInStatus: "opt-in-not-required" },
  { regionName: "ap-south-1", optInStatus: "opt-in-not-required" },
  { regionName: "eu-west-2", optInStatus: "opt-in-not-required" },
];

// Parse mock data with schemas for type safety
export const mockAWSRegions: AWSRegion[] = rawMockData.map(region => ({
  regionName: parse(RegionNameSchema, region.regionName),
  optInStatus: region.optInStatus,
}));
