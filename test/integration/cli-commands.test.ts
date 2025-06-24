import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLIエントリーポイントのパス（GitHub Actions対応）
const CLI_PATH = process.env.CI
  ? join(process.cwd(), "dist/cli.js")
  : join(__dirname, "../../dist/cli.js");

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
    const child = spawn("node", [CLI_PATH, ...args], {
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

// モックセットアップ
beforeEach(() => {
  // AWS SDK呼び出しをモック化
  vi.doMock("@aws-sdk/client-ecs", () => ({
    ECSClient: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({}),
    })),
    ListClustersCommand: vi.fn(),
    DescribeClustersCommand: vi.fn(),
    ListServicesCommand: vi.fn(),
    ListTasksCommand: vi.fn(),
    DescribeTasksCommand: vi.fn(),
  }));

  vi.doMock("@aws-sdk/client-ec2", () => ({
    EC2Client: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({}),
    })),
    DescribeRegionsCommand: vi.fn(),
  }));

  vi.doMock("@aws-sdk/client-rds", () => ({
    RDSClient: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({}),
    })),
    DescribeDBInstancesCommand: vi.fn(),
  }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CLI Commands Integration", () => {
  // CLIファイルの存在確認
  it("should have built CLI file", async () => {
    const fs = await import("fs");
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

      expect(code).toBe(1); // Commanderは引数なしの場合、終了コード1を返す
      // ヘルプはstdoutまたはstderrのいずれかに出力される
      const output = stdout + stderr;
      expect(output).toContain("Usage:");
      expect(output).toContain("connect");
      expect(output).toContain("connect-ui");
      expect(output).toContain("exec-task");
      expect(output).toContain("exec-task-ui");
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
      expect(stdout).toContain("Options:");
    });

    it("should show error for unknown command", async () => {
      const { code, stdout, stderr } = await runCLI(["unknown-command"]);

      expect(code).toBe(1);
      const output = stdout + stderr;
      expect(output).toContain("unknown command");
    });
  });

  describe("connect command", () => {
    it("should show help for connect command", async () => {
      const { code, stdout } = await runCLI(["connect", "--help"]);

      expect(code).toBe(0);
      expect(stdout).toContain("Connect to RDS via ECS");
      expect(stdout).toContain("--region");
      expect(stdout).toContain("--cluster");
      expect(stdout).toContain("--task");
      expect(stdout).toContain("--rds");
      expect(stdout).toContain("--rds-port");
      expect(stdout).toContain("--local-port");
    });

    it("should handle missing required parameters gracefully", async () => {
      const { code } = await runCLI(["connect"], 2000);

      // コマンドは失敗するはずだが、プロセスがハングしないことを確認
      // タイムアウトした場合はnullが返される
      expect(code === 1 || code === null).toBe(true);
    });

    it("should validate region parameter format", async () => {
      const { code, stdout } = await runCLI(
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

      expect(code).toBe(1);
      expect(stdout).toContain("Region cannot be empty");
    });

    it("should validate cluster parameter format", async () => {
      const { code, stdout } = await runCLI(
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

      expect(code).toBe(1);
      expect(stdout).toContain("Cluster name cannot be empty");
    });

    it("should validate port number format", async () => {
      const { code, stdout } = await runCLI(
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

      expect(code).toBe(1);
      expect(stdout).toContain("RDS port must be a number"); // 実際のValibot validation error
    });
  });

  describe("connect-ui command", () => {
    it("should show help for connect-ui command", async () => {
      const { code, stdout } = await runCLI(["connect-ui", "--help"]);

      expect(code).toBe(0);
      expect(stdout).toContain("Connect to RDS via ECS with step-by-step UI");
      expect(stdout).toContain("--region");
      expect(stdout).toContain("--cluster");
      expect(stdout).toContain("--task");
      expect(stdout).toContain("--rds");
      expect(stdout).toContain("--rds-port");
      expect(stdout).toContain("--local-port");
    });

    it("should accept optional parameters", async () => {
      const { code } = await runCLI(
        ["connect-ui", "--region", "ap-northeast-1"],
        2000,
      );

      // UIコマンドはインタラクティブなのでタイムアウトまたは失敗する
      expect([null, 1]).toContain(code);
    });

    it("should validate optional parameters", async () => {
      const { code, stdout } = await runCLI(
        ["connect-ui", "--region", ""],
        2000,
      );

      expect(code).toBe(1);
      expect(stdout).toContain("Region cannot be empty");
    });
  });

  describe("exec-task command", () => {
    it("should show help for exec-task command", async () => {
      const { code, stdout } = await runCLI(["exec-task", "--help"]);

      expect(code).toBe(0);
      expect(stdout).toContain("Execute command in ECS task container");
      expect(stdout).toContain("--region");
      expect(stdout).toContain("--cluster");
      expect(stdout).toContain("--task");
      expect(stdout).toContain("--container");
      expect(stdout).toContain("--command");
    });

    it("should handle missing required parameters for direct execution", async () => {
      const { code, stdout } = await runCLI(["exec-task"], 2000);

      // exec-taskは全パラメータが必要なので失敗するはず
      expect(code).toBe(1);
      expect(stdout).toContain("Starting AWS ECS execute command tool");
    });

    it("should validate task parameter format", async () => {
      const { code, stdout } = await runCLI(
        [
          "exec-task",
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

      expect(code === 1 || code === null).toBe(true);
      expect(stdout).toContain("Task ID cannot be empty");
    });

    it("should validate container parameter format", async () => {
      const { code, stdout } = await runCLI(
        [
          "exec-task",
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

      expect(code === 1 || code === null).toBe(true);
      expect(stdout).toContain("Container name cannot be empty");
    });

    it("should accept valid command parameter", async () => {
      const { code, stdout } = await runCLI(
        [
          "exec-task",
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
      expect(stdout).toContain("Starting AWS ECS execute command tool");
    });
  });

  describe("exec-task-ui command", () => {
    it("should show help for exec-task-ui command", async () => {
      const { code, stdout } = await runCLI(["exec-task-ui", "--help"]);

      expect(code).toBe(0);
      expect(stdout).toContain(
        "Execute command in ECS task container with step-by-step UI",
      );
      expect(stdout).toContain("--region");
      expect(stdout).toContain("--cluster");
      expect(stdout).toContain("--task");
      expect(stdout).toContain("--container");
      expect(stdout).toContain("--command");
    });

    it("should accept optional parameters", async () => {
      const { code, stdout } = await runCLI(
        ["exec-task-ui", "--region", "ap-northeast-1"],
        2000,
      );

      // UIコマンドはインタラクティブなのでタイムアウトまたは失敗する
      expect(code === 1 || code === null).toBe(true);
      expect(stdout).toContain(
        "Starting AWS ECS execute command tool with Simple UI",
      );
    });

    it("should validate optional command parameter", async () => {
      const { code, stdout } = await runCLI(
        ["exec-task-ui", "--command", ""],
        2000,
      );

      expect(code === 1 || code === null).toBe(true);
      expect(stdout).toContain("Command cannot be empty");
    });

    it("should handle partial parameters for UI mode", async () => {
      const { code, stdout } = await runCLI(
        [
          "exec-task-ui",
          "--region",
          "ap-northeast-1",
          "--cluster",
          "test-cluster",
        ],
        2000,
      );

      // UIモードでは部分的なパラメータでも受け入れられるが、最終的にはタイムアウトまたは失敗する
      expect(code === 1 || code === null).toBe(true);
      expect(stdout).toContain(
        "Starting AWS ECS execute command tool with Simple UI",
      );
    });
  });

  describe("Command validation consistency", () => {
    it("should use consistent validation schemas across commands", async () => {
      // connectコマンドでのリージョンバリデーション
      const { stdout: connectError } = await runCLI(
        ["connect", "--region", ""],
        2000,
      );

      // connect-uiコマンドでのリージョンバリデーション
      const { stdout: connectUIError } = await runCLI(
        ["connect-ui", "--region", ""],
        2000,
      );

      // 両方とも同じバリデーションエラーメッセージを表示するはず
      expect(connectError).toContain("Region cannot be empty");
      expect(connectUIError).toContain("Region cannot be empty");
    });

    it("should provide helpful error messages for invalid options", async () => {
      const { code, stdout, stderr } = await runCLI(
        ["connect", "--invalid-option", "value"],
        2000,
      );

      expect(code === 1 || code === null).toBe(true);
      const output = stdout + stderr;
      expect(output).toContain("unknown option");
    });
  });

  describe("Integration robustness", () => {
    it("should handle process termination gracefully", async () => {
      const { code, stdout } = await runCLI(["connect-ui"], 1000); // 短いタイムアウト

      // プロセスは適切に終了するはず（ハングしない）
      // タイムアウトの場合はnullが返される
      expect(code === 1 || code === null).toBe(true);
      expect(stdout).toContain(
        "Starting AWS ECS RDS connection tool with Simple UI",
      );
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
      // バリデーションエラーは常に終了コード1を返すはず（タイムアウトの場合はnull）
      const results = await Promise.all([
        runCLI(["connect", "--region", ""], 2000),
        runCLI(["connect-ui", "--region", ""], 2000),
        runCLI(["exec-task", "--region", ""], 2000),
        runCLI(["exec-task-ui", "--region", ""], 2000),
      ]);

      for (const result of results) {
        // バリデーションエラーまたはタイムアウトを許可
        expect(result.code === 1 || result.code === null).toBe(true);
      }
    });
  });
});
