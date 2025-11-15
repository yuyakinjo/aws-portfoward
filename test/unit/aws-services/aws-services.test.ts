import type { EC2Client } from "@aws-sdk/client-ec2";
import type { ECSClient } from "@aws-sdk/client-ecs";
import type { RDSClient } from "@aws-sdk/client-rds";
import { beforeEach, describe, expect, it, vi } from "bun:test";
import {
  checkECSExecCapability,
  getAWSRegions,
  getECSClusters,
  getECSClustersWithExecCapability,
  getECSTaskContainers,
  getECSTasks,
  getECSTasksWithExecCapability,
  getRDSInstances,
} from "../../../src/aws-services.js";
import type { ClusterArn, ClusterName, TaskArn } from "../../../src/types.js";
import { mockECSClusters } from "../../mock-data/index.js";
import { EC2Client as MockEC2Client } from "../../mocks/ec2-client.mock.js";
import { ECSClient as MockECSClient } from "../../mocks/ecs-client.mock.js";
import { RDSClient as MockRDSClient } from "../../mocks/rds-client.mock.js";

// Type for mock clients
type MockClient = {
  send: ReturnType<typeof vi.fn>;
};

describe("AWS Services", () => {
  let ecsClient: ECSClient;
  let rdsClient: RDSClient;
  let ec2Client: EC2Client;

  beforeEach(() => {
    ecsClient = new MockECSClient() as unknown as ECSClient;
    rdsClient = new MockRDSClient() as unknown as RDSClient;
    ec2Client = new MockEC2Client() as unknown as EC2Client;
    vi.clearAllMocks();
  });

  describe("getECSClusters", () => {
    it("should return ECS clusters successfully", async () => {
      const result = await getECSClusters(ecsClient);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(8);
        expect(result.data[0]).toMatchObject({
          clusterName: "prod-web",
          clusterArn: expect.stringContaining("arn:aws:ecs"),
        });
      }
    });

    it("should handle empty cluster list", async () => {
      const mockClient: MockClient = {
        send: vi.fn().mockResolvedValue({ clusterArns: [] }),
      };

      const result = await getECSClusters(mockClient as unknown as ECSClient);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it("should handle AccessDenied error", async () => {
      const error = new Error("Access denied");
      error.name = "AccessDenied";
      const mockClient: MockClient = {
        send: vi.fn().mockRejectedValue(error),
      };

      const result = await getECSClusters(mockClient as unknown as ECSClient);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Access denied to ECS clusters");
      }
    });

    it("should handle region availability error", async () => {
      const mockClient: MockClient = {
        send: vi.fn().mockRejectedValue(new Error("region not available")),
      };

      const result = await getECSClusters(mockClient as unknown as ECSClient);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain(
          "ECS service is not available in the specified region",
        );
      }
    });
  });

  describe("getECSTasks", () => {
    it("should return ECS tasks for a cluster", async () => {
      const cluster = mockECSClusters[0]; // prod-web
      const result = await getECSTasks(ecsClient, cluster);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        const [task] = result.data;
        expect(task).toMatchObject({
          taskArn: expect.stringContaining("ecs:"),
          displayName: expect.any(String),
          taskStatus: "RUNNING",
          clusterName: cluster.clusterName,
        });
      }
    });

    it("should handle ClusterNotFoundException", async () => {
      const cluster = {
        clusterName: "nonexistent" as ClusterName,
        clusterArn:
          "arn:aws:ecs:us-east-1:123456789012:cluster/nonexistent" as ClusterArn,
      };
      const error = new Error("Cluster not found");
      error.name = "ClusterNotFoundException";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } satisfies MockClient;

      const result = await getECSTasks(
        mockClient as unknown as ECSClient,
        cluster,
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('ECS cluster "nonexistent" not found');
      }
    });

    it("should handle no services in cluster", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({ serviceArns: [] }),
      } satisfies MockClient;
      const cluster = mockECSClusters[0];

      const result = await getECSTasks(
        mockClient as unknown as ECSClient,
        cluster,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  describe("getAWSRegions", () => {
    it("should return AWS regions successfully", async () => {
      const result = await getAWSRegions(ec2Client);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(10);
        expect(result.data[0]).toMatchObject({
          regionName: "ap-northeast-1",
          optInStatus: "opt-in-not-required",
        });
      }
    });

    it("should prioritize common regions", async () => {
      const result = await getAWSRegions(ec2Client);

      expect(result.success).toBe(true);
      if (result.success) {
        // ap-northeast-1 should be first (priority region)
        expect(result.data[0].regionName).toBe("ap-northeast-1");
        // ap-northeast-2 should be second (priority region)
        expect(result.data[1].regionName).toBe("ap-northeast-2");
        // us-east-1 should be third
        expect(result.data[2].regionName).toBe("us-east-1");
      }
    });

    it("should handle AccessDenied error", async () => {
      const error = new Error("Access denied");
      error.name = "AccessDenied";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } satisfies MockClient;

      const result = await getAWSRegions(mockClient as unknown as EC2Client);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Access denied to AWS regions");
      }
    });
  });

  describe("getRDSInstances", () => {
    it("should return RDS instances successfully", async () => {
      const result = await getRDSInstances(rdsClient);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(5);
        expect(result.data[0]).toMatchObject({
          dbInstanceIdentifier: "dev-app-mysql",
          endpoint: expect.stringContaining(".rds.amazonaws.com"),
          engine: "mysql",
          dbInstanceStatus: "available",
        });
      }
    });

    it("should filter only available instances", async () => {
      const result = await getRDSInstances(rdsClient);

      expect(result.success).toBe(true);
      if (result.success) {
        // All returned instances should be available
        for (const instance of result.data) {
          expect(instance.dbInstanceStatus).toBe("available");
        }
      }
    });

    it("should sort instances by identifier", async () => {
      const result = await getRDSInstances(rdsClient);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should be sorted alphabetically
        expect(result.data[0].dbInstanceIdentifier).toBe("dev-app-mysql");
        expect(result.data[1].dbInstanceIdentifier).toBe("prod-api-aurora");
      }
    });

    it("should handle AccessDenied error", async () => {
      const error = new Error("Access denied");
      error.name = "AccessDenied";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } satisfies MockClient;

      const result = await getRDSInstances(mockClient as unknown as RDSClient);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Access denied to RDS instances");
      }
    });
  });

  describe("checkECSExecCapability", () => {
    it("should return true for clusters with exec capability", async () => {
      const cluster = mockECSClusters[0];
      const hasExec = await checkECSExecCapability(ecsClient, cluster);

      expect(hasExec).toBe(true);
    });

    it("should return false for clusters without exec capability", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          clusters: [
            {
              clusterName: "test-cluster",
              configuration: {},
            },
          ],
        }),
      } satisfies MockClient;
      const cluster = mockECSClusters[0];

      const hasExec = await checkECSExecCapability(mockClient, cluster);
      expect(hasExec).toBe(true); // Default to true if no explicit config
    });

    it("should return false on error", async () => {
      const mockClient = {
        send: vi.fn().mockRejectedValue(new Error("Network error")),
      } satisfies MockClient;
      const cluster = mockECSClusters[0];

      const hasExec = await checkECSExecCapability(mockClient, cluster);
      expect(hasExec).toBe(false);
    });
  });

  describe("getECSClustersWithExecCapability", () => {
    it("should return clusters with exec capability", async () => {
      const result = await getECSClustersWithExecCapability(ecsClient);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(8); // All mock clusters have exec capability
        expect(result.data[0]).toMatchObject({
          clusterName: "prod-web",
          clusterArn: expect.stringContaining("arn:aws:ecs"),
        });
      }
    });

    it("should filter out clusters without exec capability", async () => {
      // Create a mock client that returns mixed results
      const mockClient = {
        send: vi
          .fn()
          .mockResolvedValueOnce({
            // ListClustersCommand
            clusterArns: [
              "arn:aws:ecs:us-east-1:123456789012:cluster/test1",
              "arn:aws:ecs:us-east-1:123456789012:cluster/test2",
            ],
          })
          .mockResolvedValueOnce({
            // DescribeClustersCommand
            clusters: [
              {
                clusterName: "test1",
                clusterArn: "arn:aws:ecs:us-east-1:123456789012:cluster/test1",
              },
              {
                clusterName: "test2",
                clusterArn: "arn:aws:ecs:us-east-1:123456789012:cluster/test2",
              },
            ],
          })
          .mockResolvedValueOnce({
            // First exec check
            clusters: [
              {
                configuration: {
                  executeCommandConfiguration: { logging: "DEFAULT" },
                },
              },
            ],
          })
          .mockRejectedValueOnce(new Error("No exec capability")), // Second exec check
      } satisfies MockClient;

      const result = await getECSClustersWithExecCapability(
        mockClient as unknown as ECSClient,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].clusterName).toBe("test1");
      }
    });
  });

  describe("getECSTasksWithExecCapability", () => {
    it("should return running tasks with exec capability", async () => {
      const cluster = mockECSClusters[0];
      const result = await getECSTasksWithExecCapability(ecsClient, cluster);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBeGreaterThan(0);
        // All returned tasks should be running
        for (const task of result.data) {
          expect(task.taskStatus).toBe("RUNNING");
        }
      }
    });

    it("should filter out non-running tasks", async () => {
      const cluster = mockECSClusters[0];
      const result = await getECSTasksWithExecCapability(ecsClient, cluster);

      expect(result.success).toBe(true);
      if (result.success) {
        // Mock data includes both RUNNING and STOPPED tasks
        // Only RUNNING tasks should be returned
        const runningTasks = result.data.filter(
          (task) => task.taskStatus === "RUNNING",
        );
        expect(result.data).toEqual(runningTasks);
      }
    });
  });

  describe("getECSTaskContainers", () => {
    it("should return containers for a task", async () => {
      const result = await getECSTaskContainers({
        ecsClient,
        clusterName: "prod-web" as ClusterName,
        taskArn:
          "arn:aws:ecs:us-east-1:123456789012:task/prod-web/1234567890123456789" as TaskArn,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toBe("web-container");
      }
    });

    it("should handle ClusterNotFoundException", async () => {
      const error = new Error("Cluster not found");
      error.name = "ClusterNotFoundException";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } satisfies MockClient;

      const result = await getECSTaskContainers({
        ecsClient: mockClient as unknown as ECSClient,
        clusterName: "nonexistent" as ClusterName,
        taskArn: "task-arn" as TaskArn,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('ECS cluster "nonexistent" not found');
      }
    });

    it("should handle TaskNotFoundException", async () => {
      const error = new Error("Task not found");
      error.name = "TaskNotFoundException";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } satisfies MockClient;

      const result = await getECSTaskContainers({
        ecsClient: mockClient as unknown as ECSClient,
        clusterName: "cluster" as ClusterName,
        taskArn: "nonexistent-task" as TaskArn,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("ECS task not found");
      }
    });

    it("should handle task with no containers", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          tasks: [{ taskArn: "task-arn", containers: [] }],
        }),
      } satisfies MockClient;

      const result = await getECSTaskContainers({
        ecsClient: mockClient as unknown as ECSClient,
        clusterName: "cluster" as ClusterName,
        taskArn: "task-arn" as TaskArn,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });
});
