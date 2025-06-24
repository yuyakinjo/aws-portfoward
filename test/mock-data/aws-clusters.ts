import type { ECSCluster } from "../../src/types.js";

export const mockECSClusters: ECSCluster[] = [
  {
    clusterName: "prod-web",
    clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/prod-web",
  },
  {
    clusterName: "staging-api",
    clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/staging-api",
  },
  {
    clusterName: "dev-app",
    clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/dev-app",
  },
  {
    clusterName: "prod-api",
    clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/prod-api",
  },
  {
    clusterName: "staging-web",
    clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/staging-web",
  },
  {
    clusterName: "test-service",
    clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/test-service",
  },
  {
    clusterName: "prod-backend",
    clusterArn: "arn:aws:ecs:ap-northeast-1:123456789012:cluster/prod-backend",
  },
  {
    clusterName: "staging-backend",
    clusterArn:
      "arn:aws:ecs:ap-northeast-1:123456789012:cluster/staging-backend",
  },
];
