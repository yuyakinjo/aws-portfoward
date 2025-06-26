import { describe, expect, it, vi } from "vitest";
import { connectToRDSWithSimpleUI } from "../../../src/core/simple-ui-flow.js";

// Mock the dry-run functions
vi.mock("../../../src/core/dry-run.js", () => ({
  generateConnectDryRun: vi.fn(() => ({
    awsCommand: "mock aws command",
    reproducibleCommand: "mock reproducible command",
    sessionInfo: {
      region: "ap-northeast-1",
      cluster: "test-cluster",
      task: "test-task",
      rds: "test-rds",
      rdsPort: 5432,
      localPort: 8888,
    },
  })),
  displayDryRunResult: vi.fn(),
}));

// Mock messages
vi.mock("../../../src/utils/index.js", () => ({
  messages: {
    info: vi.fn(),
    success: vi.fn(),
  },
  askRetry: vi.fn(),
  displayFriendlyError: vi.fn(),
}));

describe("Direct Dry Run Unit Tests", () => {
  it("should detect when all required parameters are provided for dry-run", async () => {
    const options = {
      region: "ap-northeast-1",
      cluster: "test-cluster",
      task: "test-task",
      rds: "test-rds",
      rdsPort: 5432,
      localPort: 8888,
      dryRun: true,
    };

    // Should not throw and complete quickly
    await expect(connectToRDSWithSimpleUI(options)).resolves.toBeUndefined();

    const { messages } = await import("../../../src/utils/index.js");
    expect(messages.info).toHaveBeenCalledWith(
      "Running dry run with provided parameters...",
    );
    expect(messages.success).toHaveBeenCalledWith(
      "Dry run completed successfully.",
    );
  });

  it("should handle missing parameters by falling back to interactive UI", async () => {
    const options = {
      region: "ap-northeast-1",
      dryRun: true,
      // Missing required parameters
    };

    // This would normally start interactive UI, but we'll mock it to avoid hanging
    const { messages } = await import("../../../src/utils/index.js");

    // We expect this to call the interactive UI path
    await expect(connectToRDSWithSimpleUI(options)).rejects.toThrow();

    expect(messages.info).toHaveBeenCalledWith(
      "Starting AWS ECS RDS connection tool with Simple UI (DRY RUN)...",
    );
  });
});
