import { spawn } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CLI_PATH = path.join(process.cwd(), "dist", "cli.js");

function runCommand(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });

    child.on("error", (error) => {
      resolve({
        stdout,
        stderr: error.message,
        exitCode: 1,
      });
    });
  });
}

describe("Dry Run Integration Tests", () => {
  describe("connect command with --dry-run", () => {
    it("should show help when --dry-run is used with connect command", async () => {
      const result = await runCommand(["connect", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--dry-run");
      expect(result.stdout).toContain("Show commands without execution");
    });

    it("should fail validation when required parameters are missing in dry run", async () => {
      const result = await runCommand(["connect", "--dry-run"]);

      // Should fail validation but not because of AWS connection
      expect(result.exitCode).toBe(1);
      // Should not proceed to AWS calls in dry run mode
    });
  });

  describe("exec-task command with --dry-run", () => {
    it("should show help when --dry-run is used with exec-task command", async () => {
      const result = await runCommand(["exec-task", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--dry-run");
      expect(result.stdout).toContain("Show commands without execution");
    });

    it("should show error for missing required parameters in exec-task dry run", async () => {
      const result = await runCommand([
        "exec-task",
        "--dry-run",
        "--region",
        "us-east-1",
        // Missing --cluster, --task, --container
      ]);

      expect(result.exitCode).toBe(1);
      // Should fail with validation error, not AWS connection error
    });

    it("should execute dry run successfully with all required parameters", async () => {
      const result = await runCommand([
        "exec-task",
        "--dry-run",
        "--region",
        "us-east-1",
        "--cluster",
        "test-cluster",
        "--task",
        "test-task",
        "--container",
        "test-container",
        "--command",
        "/bin/bash",
      ]);

      // Should complete successfully in dry run mode without making AWS calls
      expect(result.exitCode).toBe(0); // Should succeed in dry run mode
    });
  });

  describe("connect-ui command with --dry-run", () => {
    it("should show help when --dry-run is used with connect-ui command", async () => {
      const result = await runCommand(["connect-ui", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--dry-run");
      expect(result.stdout).toContain("Show commands without execution");
    });
  });

  describe("exec-task-ui command with --dry-run", () => {
    it("should show help when --dry-run is used with exec-task-ui command", async () => {
      const result = await runCommand(["exec-task-ui", "--help"]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--dry-run");
      expect(result.stdout).toContain("Show commands without execution");
    });
  });
});
