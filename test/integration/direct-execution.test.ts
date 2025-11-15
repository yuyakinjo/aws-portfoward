import { execSync } from "node:child_process";
import { describe, expect, it } from "bun:test";

describe("Direct Execution (Success Path)", () => {
  const cliPath = "bun dist/cli.js";

  it("should execute dry run directly without interactive prompts when all parameters provided", () => {
    const command = [
      cliPath,
      "connect",
      "--region",
      "ap-northeast-1",
      "--cluster",
      "test-cluster",
      "--task",
      "ecs:test-cluster_task123_task123",
      "--rds",
      "test-rds-instance",
      "--rds-port",
      "5432",
      "--local-port",
      "8888",
      "--dry-run",
    ].join(" ");

    const result = execSync(command, {
      encoding: "utf8",
      timeout: 5000, // 5秒でタイムアウト
    });

    // 対話的プロンプトが表示されないことを確認
    expect(result).not.toContain("?");
    expect(result).not.toContain("Select");

    // dry-run結果が表示されることを確認
    expect(result).toContain("Running dry run with provided parameters");
    expect(result).toContain("Dry Run Mode - Commands that would be executed");
    expect(result).toContain("AWS Command:");
    expect(result).toContain("aws ssm start-session");
    expect(result).toContain("Dry run completed successfully");
  });

  it("should fall back to interactive UI when required parameters are missing in dry-run", () => {
    const command = [
      cliPath,
      "connect",
      "--region",
      "ap-northeast-1",
      "--dry-run",
    ].join(" ");

    // 対話的UIが起動することを確認（タイムアウトで終了）
    let result: string;

    try {
      result = execSync(command, {
        encoding: "utf8",
        timeout: 2000,
        stdio: "pipe",
      });
    } catch (error: any) {
      result = error.stdout || "";
    }

    // 対話的UIメッセージが表示されることを確認
    expect(result).toContain(
      "Starting AWS ECS RDS connection tool with Simple UI (DRY RUN)",
    );
    // 直接実行メッセージが表示されないことを確認
    expect(result).not.toContain("Running dry run with provided parameters");
  });

  it("should handle TaskId format correctly in direct dry-run", () => {
    const command = [
      cliPath,
      "connect",
      "--region",
      "us-east-1",
      "--cluster",
      "my-cluster",
      "--task",
      "simple-task-id",
      "--rds",
      "my-database",
      "--rds-port",
      "3306",
      "--local-port",
      "3307",
      "--dry-run",
    ].join(" ");

    const result = execSync(command, {
      encoding: "utf8",
      timeout: 5000,
    });

    expect(result).toContain("Running dry run with provided parameters");
    expect(result).toContain(
      "Task: ecs:my-cluster_simple-task-id_simple-task-id",
    );
    expect(result).toContain("Dry run completed successfully");
  });

});
