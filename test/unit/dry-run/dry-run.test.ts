import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  displayDryRunResult,
  generateConnectDryRun,
  generateExecDryRun,
} from "../../../src/core/dry-run.js";
import type { RDSInstance } from "../../../src/types.js";

// Mock console.log to capture output
const mockConsoleLog = vi.fn();
vi.stubGlobal("console", { log: mockConsoleLog });

describe("Dry Run Functions", () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  describe("generateConnectDryRun", () => {
    it("should generate correct connect dry run result", () => {
      const mockRDS: RDSInstance = {
        dbInstanceIdentifier: "test-rds",
        endpoint: "test-rds.abc123.us-east-1.rds.amazonaws.com",
        port: 5432,
        engine: "postgres",
        dbInstanceClass: "db.t3.micro",
        dbInstanceStatus: "available",
        allocatedStorage: 20,
        availabilityZone: "us-east-1a",
        vpcSecurityGroups: ["sg-123456"],
      };

      const result = generateConnectDryRun(
        "us-east-1",
        "test-cluster",
        "ecs:test-cluster_test-task_abc123",
        mockRDS,
        "5432",
        "8888",
      );

      expect(result.awsCommand).toContain("aws ssm start-session");
      expect(result.awsCommand).toContain(
        "--target ecs:test-cluster_test-task_abc123",
      );
      expect(result.awsCommand).toContain(
        "test-rds.abc123.us-east-1.rds.amazonaws.com",
      );
      expect(result.awsCommand).toContain('"portNumber":["5432"]');
      expect(result.awsCommand).toContain('"localPortNumber":["8888"]');

      expect(result.reproducibleCommand).toContain("npx ecs-pf");
      expect(result.reproducibleCommand).toContain("connect");
      expect(result.reproducibleCommand).toContain("--region us-east-1");
      expect(result.reproducibleCommand).toContain("--cluster test-cluster");
      expect(result.reproducibleCommand).toContain("--rds test-rds");

      expect(result.sessionInfo.region).toBe("us-east-1");
      expect(result.sessionInfo.cluster).toBe("test-cluster");
      expect(result.sessionInfo.rds).toBe("test-rds");
      expect(result.sessionInfo.rdsPort).toBe("5432");
      expect(result.sessionInfo.localPort).toBe("8888");
    });
  });

  describe("generateExecDryRun", () => {
    it("should generate correct exec dry run result", () => {
      const result = generateExecDryRun(
        "us-east-1",
        "test-cluster",
        "arn:aws:ecs:us-east-1:123456789012:task/test-cluster/abc123",
        "web",
        "/bin/bash",
      );

      expect(result.awsCommand).toContain("aws ecs execute-command");
      expect(result.awsCommand).toContain("--region us-east-1");
      expect(result.awsCommand).toContain("--cluster test-cluster");
      expect(result.awsCommand).toContain(
        "--task arn:aws:ecs:us-east-1:123456789012:task/test-cluster/abc123",
      );
      expect(result.awsCommand).toContain("--container web");
      expect(result.awsCommand).toContain('--command "/bin/bash"');
      expect(result.awsCommand).toContain("--interactive");

      expect(result.reproducibleCommand).toContain("npx ecs-pf");
      expect(result.reproducibleCommand).toContain("exec-task");
      expect(result.reproducibleCommand).toContain("--region us-east-1");
      expect(result.reproducibleCommand).toContain("--cluster test-cluster");
      expect(result.reproducibleCommand).toContain("--container web");

      expect(result.sessionInfo.region).toBe("us-east-1");
      expect(result.sessionInfo.cluster).toBe("test-cluster");
      expect(result.sessionInfo.container).toBe("web");
      expect(result.sessionInfo.command).toBe("/bin/bash");
    });
  });

  describe("displayResult", () => {
    it("should display connect dry run result correctly", () => {
      const result = {
        awsCommand: "aws ssm start-session --target test",
        reproducibleCommand: "npx ecs-pf connect --region us-east-1",
        sessionInfo: {
          region: "us-east-1",
          cluster: "test-cluster",
          task: "test-task",
          rds: "test-rds",
          rdsPort: "5432",
          localPort: "8888",
        },
      };

      displayDryRunResult(result);

      expect(mockConsoleLog).toHaveBeenCalledWith("");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("🏃 Dry Run Mode"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("AWS Command:"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Reproducible Command:"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Session Information:"),
      );
    });

    it("should display exec dry run result correctly", () => {
      const result = {
        awsCommand: "aws ecs execute-command --region us-east-1",
        reproducibleCommand: "npx ecs-pf exec-task --region us-east-1",
        sessionInfo: {
          region: "us-east-1",
          cluster: "test-cluster",
          task: "test-task",
          container: "web",
          command: "/bin/bash",
        },
      };

      displayDryRunResult(result);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Container: web"),
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Command: /bin/bash"),
      );
    });
  });
});
