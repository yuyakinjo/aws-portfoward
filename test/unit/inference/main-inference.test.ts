import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { ECSClient } from "@aws-sdk/client-ecs";
import * as awsServices from "../../../src/aws-services.js";
import * as clusterInference from "../../../src/inference/cluster-inference.js";
import { inferECSTargets } from "../../../src/inference/main-inference.js";
import * as taskScoring from "../../../src/inference/task-scoring.js";
import type { ECSCluster } from "../../../src/types.js";
import {
  mockECSClusters,
  mockECSTasks,
  mockRDSInstances,
} from "../../mock-data/index.js";

// モックの設定は各テストケース内で vi.spyOn() を使用

describe("inferECSTargets - All clusters search", () => {
  let ecsClient: ECSClient;
  const mockRDS = mockRDSInstances[0]; // prod-db-instance

  beforeEach(() => {
    ecsClient = new ECSClient({ region: "ap-northeast-1" });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("すべてのクラスターからECSターゲットを検索する", async () => {
    // 10個のクラスターを作成（推論される上位4個 + その他6個）
    const allClusters: ECSCluster[] = [
      { ...mockECSClusters[0], clusterName: "prod-web-cluster" }, // 高スコア
      { ...mockECSClusters[1], clusterName: "prod-api-cluster" }, // 高スコア
      { ...mockECSClusters[2], clusterName: "prod-app-cluster" }, // 高スコア
      { ...mockECSClusters[3], clusterName: "prod-service-cluster" }, // 高スコア
      { ...mockECSClusters[4], clusterName: "staging-web-cluster" }, // 中スコア
      { ...mockECSClusters[0], clusterName: "dev-cluster" }, // 低スコア
      { ...mockECSClusters[1], clusterName: "test-cluster" }, // 低スコア
      { ...mockECSClusters[2], clusterName: "qa-cluster" }, // 低スコア
      { ...mockECSClusters[3], clusterName: "demo-cluster" }, // 低スコア
      { ...mockECSClusters[4], clusterName: "sandbox-cluster" }, // 低スコア
    ];

    // クラスター推論のモック - prod-*クラスターを上位に
    vi.spyOn(clusterInference, "inferClustersFromRDSName").mockReturnValue([
      "prod-web-cluster",
      "prod-api-cluster",
      "prod-app-cluster",
      "prod-service-cluster",
      "staging-web-cluster",
      "dev-cluster",
      "test-cluster",
      "qa-cluster",
      "demo-cluster",
      "sandbox-cluster",
    ]);

    // モックの設定
    vi.spyOn(awsServices, "getECSClustersWithExecCapability").mockResolvedValue(
      {
        success: true,
        data: allClusters,
      },
    );

    // 各クラスターに対してタスクを返す
    vi.spyOn(awsServices, "getECSTasksWithExecCapability").mockImplementation(
      async (_, cluster) => {
        // クラスター名に基づいてタスクを返す
        const clusterName = cluster.clusterName;
        if (clusterName.includes("prod")) {
          return {
            success: true,
            data: [
              {
                ...mockECSTasks[0],
                serviceName: `${clusterName}-service`,
                displayName: `${clusterName}-task`,
              },
            ],
          };
        } else if (clusterName.includes("staging")) {
          return {
            success: true,
            data: [
              {
                ...mockECSTasks[1],
                serviceName: `${clusterName}-service`,
                displayName: `${clusterName}-task`,
              },
            ],
          };
        } else {
          return {
            success: true,
            data: [
              {
                ...mockECSTasks[2],
                serviceName: `${clusterName}-service`,
                displayName: `${clusterName}-task`,
              },
            ],
          };
        }
      },
    );

    // スコアリング関数のモック
    vi.spyOn(taskScoring, "scoreTasksAgainstRDS").mockImplementation(
      async ({ cluster }) => {
        if (cluster.clusterName.includes("prod")) {
          return [
            {
              cluster,
              task: {
                ...mockECSTasks[0],
                serviceName: `${cluster.clusterName}-service`,
                displayName: `${cluster.clusterName}-task`,
              },
              confidence: "high" as const,
              method: "environment" as const,
              score: 90,
              reason: "Production environment match",
            },
          ];
        }
        return [];
      },
    );

    vi.spyOn(taskScoring, "scoreTasksByNaming").mockImplementation(
      ({ tasks, cluster }) => {
        return tasks.map((task) => ({
          cluster,
          task,
          confidence: cluster.clusterName.includes("staging")
            ? ("medium" as const)
            : ("low" as const),
          method: "naming" as const,
          score: cluster.clusterName.includes("staging") ? 60 : 30,
          reason: "Name pattern match",
        }));
      },
    );

    // 実行
    const results = await inferECSTargets({
      ecsClient,
      selectedRDS: mockRDS,
    });

    // 検証
    // 1. すべてのクラスターが検索されたことを確認
    expect(awsServices.getECSTasksWithExecCapability).toHaveBeenCalledTimes(10);

    // 2. 結果にすべてのクラスターのタスクが含まれることを確認
    expect(results.length).toBe(10);

    // 3. 高スコアのクラスター（prod-*）が上位に来ることを確認
    const topResults = results.slice(0, 4);
    expect(
      topResults.every((r) => r.cluster.clusterName.includes("prod")),
    ).toBe(true);
    expect(topResults.every((r) => r.confidence === "high")).toBe(true);

    // 4. 低スコアのクラスターが下位に来ることを確認
    const bottomResults = results.slice(5);
    expect(
      bottomResults.every(
        (r) =>
          !r.cluster.clusterName.includes("prod") &&
          !r.cluster.clusterName.includes("staging"),
      ),
    ).toBe(true);
    expect(bottomResults.every((r) => r.confidence === "low")).toBe(true);

    // 5. スコアによる並び順を確認
    for (let i = 0; i < results.length - 1; i++) {
      const current = results[i];
      const next = results[i + 1];

      // 信頼度が同じ場合はスコアで比較
      if (current.confidence === next.confidence) {
        expect(current.score).toBeGreaterThanOrEqual(next.score);
      } else {
        // 信頼度が異なる場合は high > medium > low の順
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        expect(confidenceOrder[current.confidence]).toBeGreaterThanOrEqual(
          confidenceOrder[next.confidence],
        );
      }
    }
  });

  it("推論されなかったクラスターも低信頼度として含まれる", async () => {
    const allClusters: ECSCluster[] = [
      { ...mockECSClusters[0], clusterName: "prod-web" }, // RDS名と一致
      { ...mockECSClusters[1], clusterName: "unrelated-cluster-1" }, // 無関係
      { ...mockECSClusters[2], clusterName: "random-service" }, // 無関係
      { ...mockECSClusters[3], clusterName: "another-cluster" }, // 無関係
    ];

    // クラスター推論のモック - prod-webのみ推論される
    vi.spyOn(clusterInference, "inferClustersFromRDSName").mockReturnValue([
      "prod-web",
    ]);

    vi.spyOn(awsServices, "getECSClustersWithExecCapability").mockResolvedValue(
      {
        success: true,
        data: allClusters,
      },
    );

    vi.spyOn(awsServices, "getECSTasksWithExecCapability").mockResolvedValue({
      success: true,
      data: [mockECSTasks[0]],
    });

    // スコアリング関数のモック
    vi.spyOn(taskScoring, "scoreTasksAgainstRDS").mockImplementation(
      async ({ cluster }) => {
        if (cluster.clusterName === "prod-web") {
          return [
            {
              cluster,
              task: mockECSTasks[0],
              confidence: "high" as const,
              method: "environment" as const,
              score: 90,
              reason: "Production environment match",
            },
          ];
        }
        return [];
      },
    );

    vi.spyOn(taskScoring, "scoreTasksByNaming").mockImplementation(
      ({ tasks, cluster }) => {
        return tasks.map((task) => ({
          cluster,
          task,
          confidence: "low" as const,
          method: "naming" as const,
          score: 10,
          reason: "Name pattern match",
        }));
      },
    );

    const results = await inferECSTargets({
      ecsClient,
      selectedRDS: mockRDS,
    });

    // すべてのクラスターが検索される
    expect(awsServices.getECSTasksWithExecCapability).toHaveBeenCalledTimes(4);
    expect(results.length).toBe(4);

    // prod-webが最初に来る（高スコア）
    expect(results[0].cluster.clusterName).toBe("prod-web");
    expect(results[0].confidence).toBe("high");

    // その他のクラスターは低信頼度
    const lowConfidenceResults = results.slice(1);
    expect(lowConfidenceResults.every((r) => r.confidence === "low")).toBe(
      true,
    );
  });

  it("停止中のタスクも結果に含まれる（最後に配置）", async () => {
    const allClusters: ECSCluster[] = [mockECSClusters[0], mockECSClusters[1]];

    // クラスター推論のモック
    vi.spyOn(clusterInference, "inferClustersFromRDSName").mockReturnValue([
      mockECSClusters[0].clusterName,
      mockECSClusters[1].clusterName,
    ]);

    vi.spyOn(awsServices, "getECSClustersWithExecCapability").mockResolvedValue(
      {
        success: true,
        data: allClusters,
      },
    );

    // 混在したタスクステータスを返す
    const runningTask = { ...mockECSTasks[0], taskStatus: "RUNNING" as const };
    const stoppedTask = { ...mockECSTasks[1], taskStatus: "STOPPED" as const };
    const pendingTask = { ...mockECSTasks[2], taskStatus: "PENDING" as const };

    vi.spyOn(awsServices, "getECSTasksWithExecCapability")
      .mockResolvedValueOnce({
        success: true,
        data: [runningTask, stoppedTask],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [pendingTask],
      });

    // スコアリング関数のモック
    vi.spyOn(taskScoring, "scoreTasksAgainstRDS").mockImplementation(
      async ({ tasks, cluster }) => {
        return tasks.map((task) => ({
          cluster,
          task,
          confidence: "high" as const,
          method: "environment" as const,
          score: 80,
          reason: "Match found",
        }));
      },
    );

    vi.spyOn(taskScoring, "scoreTasksByNaming").mockImplementation(
      ({ tasks, cluster }) => {
        return tasks.map((task) => ({
          cluster,
          task,
          confidence: "medium" as const,
          method: "naming" as const,
          score: 50,
          reason: "Name pattern match",
        }));
      },
    );

    const results = await inferECSTargets({
      ecsClient,
      selectedRDS: mockRDS,
    });

    // 3つのタスクすべてが結果に含まれる
    expect(results.length).toBe(3);

    // RUNNING/PENDINGタスクが先に来る
    expect(["RUNNING", "PENDING"]).toContain(results[0].task.taskStatus);
    expect(["RUNNING", "PENDING"]).toContain(results[1].task.taskStatus);

    // STOPPEDタスクが最後に来る
    expect(results[2].task.taskStatus).toBe("STOPPED");
    expect(results[2].reason).toContain("タスク停止中 - 接続不可");
    expect(results[2].score).toBe(0);
  });

  it("エラーが発生したクラスターはスキップされる", async () => {
    const allClusters: ECSCluster[] = [
      mockECSClusters[0],
      mockECSClusters[1],
      mockECSClusters[2],
    ];

    // クラスター推論のモック
    vi.spyOn(clusterInference, "inferClustersFromRDSName").mockReturnValue([
      mockECSClusters[0].clusterName,
      mockECSClusters[1].clusterName,
      mockECSClusters[2].clusterName,
    ]);

    vi.spyOn(awsServices, "getECSClustersWithExecCapability").mockResolvedValue(
      {
        success: true,
        data: allClusters,
      },
    );

    // 2番目のクラスターでエラーを発生させる
    vi.spyOn(awsServices, "getECSTasksWithExecCapability")
      .mockResolvedValueOnce({
        success: true,
        data: [mockECSTasks[0]],
      })
      .mockRejectedValueOnce(new Error("API Error"))
      .mockResolvedValueOnce({
        success: true,
        data: [mockECSTasks[2]],
      });

    // スコアリング関数のモック
    vi.spyOn(taskScoring, "scoreTasksAgainstRDS").mockImplementation(
      async ({ tasks, cluster }) => {
        return tasks.map((task) => ({
          cluster,
          task,
          confidence: "high" as const,
          method: "environment" as const,
          score: 80,
          reason: "Match found",
        }));
      },
    );

    const results = await inferECSTargets({
      ecsClient,
      selectedRDS: mockRDS,
    });

    // エラーが発生したクラスターを除く2つのタスクが結果に含まれる
    expect(results.length).toBe(2);
    expect(results[0].task).toEqual(mockECSTasks[0]);
    expect(results[1].task).toEqual(mockECSTasks[2]);
  });

  it("タスクがないクラスターはスキップされる", async () => {
    const allClusters: ECSCluster[] = [
      mockECSClusters[0],
      mockECSClusters[1],
      mockECSClusters[2],
    ];

    // クラスター推論のモック
    vi.spyOn(clusterInference, "inferClustersFromRDSName").mockReturnValue([
      mockECSClusters[0].clusterName,
      mockECSClusters[1].clusterName,
      mockECSClusters[2].clusterName,
    ]);

    vi.spyOn(awsServices, "getECSClustersWithExecCapability").mockResolvedValue(
      {
        success: true,
        data: allClusters,
      },
    );

    // 2番目のクラスターは空のタスクリストを返す
    vi.spyOn(awsServices, "getECSTasksWithExecCapability")
      .mockResolvedValueOnce({
        success: true,
        data: [mockECSTasks[0]],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [mockECSTasks[2]],
      });

    // スコアリング関数のモック
    vi.spyOn(taskScoring, "scoreTasksAgainstRDS").mockImplementation(
      async ({ tasks, cluster }) => {
        return tasks.map((task) => ({
          cluster,
          task,
          confidence: "high" as const,
          method: "environment" as const,
          score: 80,
          reason: "Match found",
        }));
      },
    );

    const results = await inferECSTargets({
      ecsClient,
      selectedRDS: mockRDS,
    });

    // タスクがあるクラスターのみ結果に含まれる
    expect(results.length).toBe(2);
    expect(results[0].task).toEqual(mockECSTasks[0]);
    expect(results[1].task).toEqual(mockECSTasks[2]);
  });
});
