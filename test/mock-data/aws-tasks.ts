import type { ECSTask } from "../../src/types.js";

export const mockECSTasks: ECSTask[] = [
  {
    taskArn: "ecs:prod-web_a1b2c3d4e5f6_0123456789abcdef",
    realTaskArn:
      "arn:aws:ecs:ap-northeast-1:123456789012:task/prod-web/a1b2c3d4e5f6",
    displayName: "web-service",
    runtimeId: "0123456789abcdef",
    taskId: "a1b2c3d4e5f6",
    clusterName: "prod-web",
    serviceName: "web-service",
    taskStatus: "RUNNING",
    createdAt: new Date("2023-11-20T10:30:00Z"),
  },
  {
    taskArn: "ecs:staging-api_b2c3d4e5f6g7_123456789abcdef0",
    realTaskArn:
      "arn:aws:ecs:ap-northeast-1:123456789012:task/staging-api/b2c3d4e5f6g7",
    displayName: "api-service",
    runtimeId: "123456789abcdef0",
    taskId: "b2c3d4e5f6g7",
    clusterName: "staging-api",
    serviceName: "api-service",
    taskStatus: "RUNNING",
    createdAt: new Date("2023-11-20T11:00:00Z"),
  },
  {
    taskArn: "ecs:dev-app_c3d4e5f6g7h8_23456789abcdef01",
    realTaskArn:
      "arn:aws:ecs:ap-northeast-1:123456789012:task/dev-app/c3d4e5f6g7h8",
    displayName: "app-service",
    runtimeId: "23456789abcdef01",
    taskId: "c3d4e5f6g7h8",
    clusterName: "dev-app",
    serviceName: "app-service",
    taskStatus: "RUNNING",
    createdAt: new Date("2023-11-20T11:30:00Z"),
  },
  {
    taskArn: "ecs:prod-api_d4e5f6g7h8i9_3456789abcdef012",
    realTaskArn:
      "arn:aws:ecs:ap-northeast-1:123456789012:task/prod-api/d4e5f6g7h8i9",
    displayName: "api-backend",
    runtimeId: "3456789abcdef012",
    taskId: "d4e5f6g7h8i9",
    clusterName: "prod-api",
    serviceName: "api-backend",
    taskStatus: "RUNNING",
    createdAt: new Date("2023-11-20T12:00:00Z"),
  },
  {
    taskArn: "ecs:test-service_e5f6g7h8i9j0_456789abcdef0123",
    realTaskArn:
      "arn:aws:ecs:ap-northeast-1:123456789012:task/test-service/e5f6g7h8i9j0",
    displayName: "test-app",
    runtimeId: "456789abcdef0123",
    taskId: "e5f6g7h8i9j0",
    clusterName: "test-service",
    serviceName: "test-app",
    taskStatus: "RUNNING",
    createdAt: new Date("2023-11-20T12:30:00Z"),
  },
  {
    taskArn: "ecs:staging-web_f6g7h8i9j0k1_56789abcdef01234",
    realTaskArn:
      "arn:aws:ecs:ap-northeast-1:123456789012:task/staging-web/f6g7h8i9j0k1",
    displayName: "web-frontend",
    runtimeId: "56789abcdef01234",
    taskId: "f6g7h8i9j0k1",
    clusterName: "staging-web",
    serviceName: "web-frontend",
    taskStatus: "STOPPED",
    createdAt: new Date("2023-11-20T09:00:00Z"),
  },
];
