import { describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLIエントリーポイントのパス（GitHub Actions対応）
const CLI_PATH = process.env.CI
  ? join(process.cwd(), "dist/index.js")
  : join(__dirname, "../../dist/index.js");

// CLIプロセス実行ヘルパー
function runCLI(
  args: string[],
  timeout = process.env.CI ? 10000 : 5000, // CI環境では長めのタイムアウト
): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn("bun", [CLI_PATH, ...args], {
      env: { ...process.env, NODE_ENV: "test" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeout);

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      resolve({ code, stdout, stderr });
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      console.error(`CLI execution error: ${error.message}`);
      console.error(`CLI path: ${CLI_PATH}`);
      console.error(`Args: ${JSON.stringify(args)}`);
      resolve({ code: -1, stdout, stderr });
    });
  });
}

// 統合テストはCLIを実際に実行するため、AWS SDKのモックは不要

describe("CLI Commands Integration", () => {
  // CLIファイルの存在確認
  it("should have built CLI file", async () => {
    const fs = await import("node:fs");
    console.log(`Checking CLI file at: ${CLI_PATH}`);
    console.log(`File exists: ${fs.existsSync(CLI_PATH)}`);
    if (fs.existsSync(CLI_PATH)) {
      const stats = fs.statSync(CLI_PATH);
      console.log(`File size: ${stats.size} bytes`);
      console.log(`File permissions: ${stats.mode.toString(8)}`);
    }
    expect(fs.existsSync(CLI_PATH)).toBe(true);
  });

  describe("Basic CLI functionality", () => {
    it("should display help when no command is provided", async () => {
      const { code, stdout, stderr } = await runCLI([]);

      expect(code).toBe(2); // 使い方の誤りは exit 2 (decopin-cli)
      // ヘルプはstdoutまたはstderrのいずれかに出力される
      const output = stdout + stderr;
      expect(output).toContain("Usage:");
      expect(output).toContain("connect");
      expect(output).toContain("exec");
    });

    it("should display version with --version flag", async () => {
      const { code, stdout } = await runCLI(["--version"]);

      expect(code).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Version pattern
    });

    it("should display help with --help flag", async () => {
      const { code, stdout } = await runCLI(["--help"]);

      expect(code).toBe(0);
      expect(stdout).toContain("Usage:");
      expect(stdout).toContain("Commands:");
    });

    it("should show error for unknown command", async () => {
      const { code, stdout, stderr } = await runCLI(["unknown-command"]);

      expect(code).toBe(2);
      const output = stdout + stderr;
      expect(output.toLowerCase()).toContain("unknown command");
    });
  });

  describe("connect command", () => {
    it("should show help for connect command", async () => {
      const { code, stdout } = await runCLI(["connect", "--help"]);

      expect(code).toBe(0);
      expect(stdout).toContain("Connect to an AWS RDS instance via ECS Exec");
      expect(stdout).toContain("--region");
      expect(stdout).toContain("--cluster");
      expect(stdout).toContain("--task");
      expect(stdout).toContain("--rds");
      expect(stdout).toContain("--rds-port");
      expect(stdout).toContain("--local-port");
      expect(stdout).not.toContain("--no-ui");
    });

    it("should handle missing required parameters with interactive UI", async () => {
      const { code } = await runCLI(["connect"], 2000);

      // インタラクティブUIコマンドは失敗するかタイムアウトするはず
      expect(code === 1 || code === null).toBe(true);
    });

    it("should validate region parameter format", async () => {
      const { code, stderr } = await runCLI(
        [
          "connect",
          "--region",
          "",
          "--cluster",
          "test-cluster",
          "--task",
          "test-task",
          "--rds",
          "test-rds",
          "--rds-port",
          "5432",
          "--local-port",
          "8888",
        ],
        2000,
      );

      expect(code).toBe(2);
      expect(stderr).toContain("--region: Invalid length");
    });

    it("should validate cluster parameter format", async () => {
      const { code, stderr } = await runCLI(
        [
          "connect",
          "--region",
          "ap-northeast-1",
          "--cluster",
          "",
          "--task",
          "test-task",
          "--rds",
          "test-rds",
          "--rds-port",
          "5432",
          "--local-port",
          "8888",
        ],
        2000,
      );

      expect(code).toBe(2);
      expect(stderr).toContain("--cluster: Invalid length");
    });

    it("should validate port number format", async () => {
      const { code, stderr } = await runCLI(
        [
          "connect",
          "--region",
          "ap-northeast-1",
          "--cluster",
          "test-cluster",
          "--task",
          "test-task",
          "--rds",
          "test-rds",
          "--rds-port",
          "invalid-port",
          "--local-port",
          "8888",
        ],
        2000,
      );

      expect(code).toBe(2);
      expect(stderr).toContain("expected a number");
    });
  });

  describe("exec command", () => {
    it("should show help for exec command", async () => {
      const { code, stdout } = await runCLI(["exec", "--help"]);

      expect(code).toBe(0);
      expect(stdout).toContain("Execute a command on an AWS ECS task");
      expect(stdout).toContain("--region");
      expect(stdout).toContain("--cluster");
      expect(stdout).toContain("--task");
      expect(stdout).toContain("--container");
      expect(stdout).toContain("--command");
      expect(stdout).not.toContain("--no-ui");
    });

    it("should handle missing required parameters with interactive UI", async () => {
      const { code } = await runCLI(["exec"], 2000);

      // インタラクティブUIモードでは失敗するかタイムアウトするはず
      expect(code === 1 || code === null).toBe(true);
    });

    it("should validate task parameter format", async () => {
      const { code, stderr } = await runCLI(
        [
          "exec",
          "--region",
          "ap-northeast-1",
          "--cluster",
          "test-cluster",
          "--task",
          "",
          "--container",
          "test-container",
          "--command",
          "/bin/bash",
        ],
        2000,
      );

      expect(code).toBe(2);
      expect(stderr).toContain("--task: Invalid length");
    });

    it("should validate container parameter format", async () => {
      const { code, stderr } = await runCLI(
        [
          "exec",
          "--region",
          "ap-northeast-1",
          "--cluster",
          "test-cluster",
          "--task",
          "test-task",
          "--container",
          "",
          "--command",
          "/bin/bash",
        ],
        2000,
      );

      expect(code).toBe(2);
      expect(stderr).toContain("--container: Invalid length");
    });

    it("should accept valid command parameter", async () => {
      const { code, stdout } = await runCLI(
        [
          "exec",
          "--region",
          "ap-northeast-1",
          "--cluster",
          "test-cluster",
          "--task",
          "test-task",
          "--container",
          "test-container",
          "--command",
          "/bin/bash",
        ],
        2000,
      );

      // 有効なパラメータの場合、バリデーションは通過するが
      // 実際のAWS呼び出しで失敗するかタイムアウトする
      expect(code === 1 || code === null).toBe(true);
      expect(stdout).toContain("ECS Execute Command Configuration");
    });
  });

  describe("enable-exec command", () => {
    it("should show help for enable-exec command", async () => {
      const { code, stdout } = await runCLI(["enable-exec", "--help"]);

      expect(code).toBe(0);
      expect(stdout).toContain(
        "Enable ECS exec for services that don't have it enabled",
      );
      expect(stdout).toContain("--region");
      expect(stdout).toContain("--cluster");
      expect(stdout).toContain("--service");
    });

    it("should start interactive mode when no region provided", async () => {
      const { code, stdout } = await runCLI(["enable-exec"], 2000);

      expect(code === 1 || code === null).toBe(true);
      // CI環境ではAWS認証がないため、リージョン取得エラーまたはリージョン選択画面のいずれかが表示される
      const hasRegionSelection = stdout.includes("Select AWS region");
      const hasRegionError =
        stdout.includes("AWS Region Error") ||
        stdout.includes("Failed to get AWS regions");
      expect(hasRegionSelection || hasRegionError).toBe(true);
    });

    it("should validate region parameter format", async () => {
      const { code, stderr } = await runCLI(
        ["enable-exec", "--region", ""],
        2000,
      );

      expect(code).toBe(2);
      expect(stderr).toContain("--region: Invalid length");
    });

    it("should handle dry-run mode", async () => {
      const { code, stdout } = await runCLI(
        [
          "enable-exec",
          "--region",
          "ap-northeast-1",
          "--cluster",
          "test-cluster",
          "--service",
          "test-service",
          "--dry-run",
        ],
        2000,
      );

      // dry-runモードでは正常に終了する
      expect(code).toBe(0);
      expect(stdout).toContain("DRY RUN");
    });

    it("should validate cluster and service combination", async () => {
      const { code, stdout } = await runCLI(
        [
          "enable-exec",
          "--region",
          "ap-northeast-1",
          "--cluster",
          "test-cluster",
          "--service",
          "test-service",
        ],
        2000,
      );

      // 有効なパラメータの場合、バリデーション通過後にAWS呼び出しでエラーが発生するが正常終了
      expect(code === 0 || code === 1 || code === null).toBe(true);
      expect(stdout).toContain("Enabling exec for service");
    });
  });

  describe("Command validation consistency", () => {
    it("should use consistent validation schemas across commands", async () => {
      // connectコマンドでのリージョンバリデーション
      const { stderr: connectError } = await runCLI(
        ["connect", "--region", ""],
        2000,
      );

      // 統合後はconnect-uiコマンドは存在しないので、exec-taskでのバリデーションと比較
      const { stderr: execTaskError } = await runCLI(
        ["exec", "--region", ""],
        2000,
      );

      // 両方とも同じ宣言 (argv.tsx) から同じ検証エラーが出るはず
      expect(connectError).toContain("--region: Invalid length");
      expect(execTaskError).toContain("--region: Invalid length");
    });

    it("should provide helpful error messages for invalid options", async () => {
      const { code, stdout, stderr } = await runCLI(
        ["connect", "--invalid-option", "value"],
        2000,
      );

      expect(code).toBe(2);
      const output = stdout + stderr;
      expect(output).toContain("Unknown option: --invalid-option");
    });
  });

  describe("Integration robustness", () => {
    it("should handle process termination gracefully", async () => {
      const { code, stdout } = await runCLI(["connect"], 1000); // 短いタイムアウト

      // プロセスは適切に終了するはず（ハングしない）
      // タイムアウトの場合はnullが返される
      expect(code === 1 || code === null).toBe(true);
      expect(stdout).toContain("Select Network Configuration");
    });

    it("should not leak sensitive information in error messages", async () => {
      const { stdout } = await runCLI(
        ["connect", "--region", "ap-northeast-1", "--cluster", "test-cluster"],
        2000,
      );

      // エラーメッセージにセンシティブな情報が含まれていないことを確認
      expect(stdout).not.toContain("password");
      expect(stdout).not.toContain("secret");
    });

    it("should maintain consistent exit codes", async () => {
      // 使い方の誤り (検証エラー・未知のコマンド) は常に終了コード 2
      const results = await Promise.all([
        runCLI(["connect", "--region", ""], 2000),
        runCLI(["exec-task", "--region", ""], 2000),
      ]);

      for (const result of results) {
        expect(result.code).toBe(2);
      }
    });
  });
});
