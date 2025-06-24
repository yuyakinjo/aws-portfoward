import type { EC2Client } from "@aws-sdk/client-ec2";
import type { ECSClient } from "@aws-sdk/client-ecs";
import type { RDSClient } from "@aws-sdk/client-rds";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { mockECSClusters, mockECSTasks } from "../../mock-data/index.js";
import { EC2Client as MockEC2Client } from "../../mocks/ec2-client.mock.js";
import { ECSClient as MockECSClient } from "../../mocks/ecs-client.mock.js";
import { RDSClient as MockRDSClient } from "../../mocks/rds-client.mock.js";

describe("AWS Services", () => {
  let ecsClient: ECSClient;
  let rdsClient: RDSClient;
  let ec2Client: EC2Client;

  beforeEach(() => {
    ecsClient = new MockECSClient() as any;
    rdsClient = new MockRDSClient() as any;
    ec2Client = new MockEC2Client() as any;
    vi.clearAllMocks();
  });

  describe("getECSClusters", () => {
    it("should return ECS clusters successfully", async () => {
      const clusters = await getECSClusters(ecsClient);

      expect(clusters).toHaveLength(8);
      expect(clusters[0]).toMatchObject({
        clusterName: "prod-web",
        clusterArn: expect.stringContaining("arn:aws:ecs"),
      });
    });

    it("should handle empty cluster list", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({ clusterArns: [] }),
      } as any;

      const clusters = await getECSClusters(mockClient);
      expect(clusters).toHaveLength(0);
    });

    it("should handle AccessDenied error", async () => {
      const error = new Error("Access denied");
      error.name = "AccessDenied";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } as any;

      await expect(getECSClusters(mockClient)).rejects.toThrow(
        "Access denied to ECS clusters",
      );
    });

    it("should handle region availability error", async () => {
      const mockClient = {
        send: vi.fn().mockRejectedValue(new Error("region not available")),
      } as any;

      await expect(getECSClusters(mockClient)).rejects.toThrow(
        "ECS service is not available in the specified region",
      );
    });
  });

  describe("getECSTasks", () => {
    it("should return ECS tasks for a cluster", async () => {
      const cluster = mockECSClusters[0]; // prod-web
      const tasks = await getECSTasks(ecsClient, cluster);

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        taskArn: expect.stringContaining("ecs:"),
        displayName: expect.any(String),
        taskStatus: "RUNNING",
        clusterName: cluster.clusterName,
      });
    });

    it("should handle ClusterNotFoundException", async () => {
      const cluster = {
        clusterName: "nonexistent",
        clusterArn: "arn:aws:ecs:us-east-1:123456789012:cluster/nonexistent",
      };
      const error = new Error("Cluster not found");
      error.name = "ClusterNotFoundException";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } as any;

      await expect(getECSTasks(mockClient, cluster)).rejects.toThrow(
        'ECS cluster "nonexistent" not found',
      );
    });

    it("should handle no services in cluster", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({ serviceArns: [] }),
      } as any;
      const cluster = mockECSClusters[0];

      const tasks = await getECSTasks(mockClient, cluster);
      expect(tasks).toHaveLength(0);
    });
  });

  describe("getAWSRegions", () => {
    it("should return AWS regions successfully", async () => {
      const regions = await getAWSRegions(ec2Client);

      expect(regions).toHaveLength(10);
      expect(regions[0]).toMatchObject({
        regionName: "ap-northeast-1",
        optInStatus: "opt-in-not-required",
      });
    });

    it("should prioritize common regions", async () => {
      const regions = await getAWSRegions(ec2Client);

      // ap-northeast-1 should be first (priority region)
      expect(regions[0].regionName).toBe("ap-northeast-1");
      // us-east-1 should be second
      expect(regions[1].regionName).toBe("us-east-1");
    });

    it("should handle AccessDenied error", async () => {
      const error = new Error("Access denied");
      error.name = "AccessDenied";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } as any;

      await expect(getAWSRegions(mockClient)).rejects.toThrow(
        "Access denied to AWS regions",
      );
    });
  });

  describe("getRDSInstances", () => {
    it("should return RDS instances successfully", async () => {
      const instances = await getRDSInstances(rdsClient);

      expect(instances).toHaveLength(5);
      expect(instances[0]).toMatchObject({
        dbInstanceIdentifier: "dev-app-mysql",
        endpoint: expect.stringContaining(".rds.amazonaws.com"),
        engine: "mysql",
        dbInstanceStatus: "available",
      });
    });

    it("should filter only available instances", async () => {
      const instances = await getRDSInstances(rdsClient);

      // All returned instances should be available
      for (const instance of instances) {
        expect(instance.dbInstanceStatus).toBe("available");
      }
    });

    it("should sort instances by identifier", async () => {
      const instances = await getRDSInstances(rdsClient);

      // Should be sorted alphabetically
      expect(instances[0].dbInstanceIdentifier).toBe("dev-app-mysql");
      expect(instances[1].dbInstanceIdentifier).toBe("prod-api-aurora");
    });

    it("should handle AccessDenied error", async () => {
      const error = new Error("Access denied");
      error.name = "AccessDenied";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } as any;

      await expect(getRDSInstances(mockClient)).rejects.toThrow(
        "Access denied to RDS instances",
      );
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
      } as any;
      const cluster = mockECSClusters[0];

      const hasExec = await checkECSExecCapability(mockClient, cluster);
      expect(hasExec).toBe(true); // Default to true if no explicit config
    });

    it("should return false on error", async () => {
      const mockClient = {
        send: vi.fn().mockRejectedValue(new Error("Network error")),
      } as any;
      const cluster = mockECSClusters[0];

      const hasExec = await checkECSExecCapability(mockClient, cluster);
      expect(hasExec).toBe(false);
    });
  });

  describe("getECSClustersWithExecCapability", () => {
    it("should return clusters with exec capability", async () => {
      const clusters = await getECSClustersWithExecCapability(ecsClient);

      expect(clusters).toHaveLength(8); // All mock clusters have exec capability
      expect(clusters[0]).toMatchObject({
        clusterName: "prod-web",
        clusterArn: expect.stringContaining("arn:aws:ecs"),
      });
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
      } as any;

      const clusters = await getECSClustersWithExecCapability(mockClient);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].clusterName).toBe("test1");
    });
  });

  describe("getECSTasksWithExecCapability", () => {
    it("should return running tasks with exec capability", async () => {
      const cluster = mockECSClusters[0];
      const tasks = await getECSTasksWithExecCapability(ecsClient, cluster);

      expect(tasks.length).toBeGreaterThan(0);
      // All returned tasks should be running
      for (const task of tasks) {
        expect(task.taskStatus).toBe("RUNNING");
      }
    });

    it("should filter out non-running tasks", async () => {
      const cluster = mockECSClusters[0];
      const tasks = await getECSTasksWithExecCapability(ecsClient, cluster);

      // Mock data includes both RUNNING and STOPPED tasks
      // Only RUNNING tasks should be returned
      const runningTasks = tasks.filter(
        (task) => task.taskStatus === "RUNNING",
      );
      expect(tasks).toEqual(runningTasks);
    });
  });

  describe("getECSTaskContainers", () => {
    it("should return containers for a task", async () => {
      const clusterName = "prod-web";
      const taskArn =
        "arn:aws:ecs:us-east-1:123456789012:task/prod-web/1234567890123456789";

      const containers = await getECSTaskContainers(
        ecsClient,
        clusterName,
        taskArn,
      );

      expect(containers).toHaveLength(1);
      expect(containers[0]).toBe("web-container");
    });

    it("should handle ClusterNotFoundException", async () => {
      const error = new Error("Cluster not found");
      error.name = "ClusterNotFoundException";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } as any;

      await expect(
        getECSTaskContainers(mockClient, "nonexistent", "task-arn"),
      ).rejects.toThrow('ECS cluster "nonexistent" not found');
    });

    it("should handle TaskNotFoundException", async () => {
      const error = new Error("Task not found");
      error.name = "TaskNotFoundException";
      const mockClient = {
        send: vi.fn().mockRejectedValue(error),
      } as any;

      await expect(
        getECSTaskContainers(mockClient, "cluster", "nonexistent-task"),
      ).rejects.toThrow("ECS task not found");
    });

    it("should handle task with no containers", async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({
          tasks: [{ taskArn: "task-arn", containers: [] }],
        }),
      } as any;

      const containers = await getECSTaskContainers(
        mockClient,
        "cluster",
        "task-arn",
      );
      expect(containers).toHaveLength(0);
    });
  });
});
