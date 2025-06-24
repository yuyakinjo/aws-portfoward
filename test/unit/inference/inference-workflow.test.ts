import { describe, expect, it } from "vitest";
import { filterInferenceResults } from "../../../src/core/inference-workflow.js";
import type { InferenceResult } from "../../../src/inference/index.js";
import { mockECSClusters, mockECSTasks } from "../../mock-data/index.js";

describe("filterInferenceResults", () => {
  // テスト用の推論結果を作成
  const mockInferenceResults: InferenceResult[] = [
    {
      cluster: mockECSClusters[0], // prod-web
      task: mockECSTasks[0], // web-service
      confidence: "high",
      method: "environment",
      score: 85,
      reason: "環境変数に一致",
    },
    {
      cluster: mockECSClusters[1], // staging-api
      task: mockECSTasks[1], // api-service
      confidence: "medium",
      method: "naming",
      score: 65,
      reason: "名前パターンに一致",
    },
    {
      cluster: mockECSClusters[2], // dev-app
      task: mockECSTasks[2], // app-service
      confidence: "low",
      method: "network",
      score: 35,
      reason: "ネットワーク分析による推論",
    },
    {
      cluster: mockECSClusters[3], // prod-api
      task: mockECSTasks[3], // api-backend
      confidence: "high",
      method: "environment",
      score: 90,
      reason: "環境変数とサービス名に一致",
    },
    {
      cluster: mockECSClusters[4], // test-service
      task: mockECSTasks[4], // test-app
      confidence: "medium",
      method: "naming",
      score: 55,
      reason: "テスト環境の推論",
    },
  ];

  it("空の入力または空白文字の場合は全ての結果を返す", () => {
    expect(filterInferenceResults(mockInferenceResults, "")).toEqual(
      mockInferenceResults,
    );
    expect(filterInferenceResults(mockInferenceResults, "   ")).toEqual(
      mockInferenceResults,
    );
  });

  it("クラスター名でフィルタリングする", () => {
    const results = filterInferenceResults(mockInferenceResults, "prod");
    expect(results.length).toBe(2);
    expect(results.every((r) => r.cluster.clusterName.includes("prod"))).toBe(
      true,
    );
  });

  it("タスク名でフィルタリングする", () => {
    const results = filterInferenceResults(mockInferenceResults, "api");
    expect(results.length).toBe(2);
    expect(
      results.every(
        (r) =>
          r.task.displayName.includes("api") ||
          r.task.serviceName.includes("api") ||
          r.cluster.clusterName.includes("api"),
      ),
    ).toBe(true);
  });

  it("信頼度レベルでフィルタリングする", () => {
    const highResults = filterInferenceResults(mockInferenceResults, "high");
    expect(highResults.length).toBe(2);
    expect(highResults.every((r) => r.confidence === "high")).toBe(true);

    const mediumResults = filterInferenceResults(
      mockInferenceResults,
      "medium",
    );
    expect(mediumResults.length).toBe(2);
    expect(mediumResults.every((r) => r.confidence === "medium")).toBe(true);
  });

  it("日本語の信頼度レベルでもフィルタリングする", () => {
    const highResults = filterInferenceResults(mockInferenceResults, "高");
    expect(highResults.length).toBe(2);
    expect(highResults.every((r) => r.confidence === "high")).toBe(true);

    const mediumResults = filterInferenceResults(mockInferenceResults, "中");
    expect(mediumResults.length).toBe(2);
    expect(mediumResults.every((r) => r.confidence === "medium")).toBe(true);

    const lowResults = filterInferenceResults(mockInferenceResults, "低");
    expect(lowResults.length).toBe(1);
    expect(lowResults.every((r) => r.confidence === "low")).toBe(true);
  });

  it("複数のキーワードでAND検索する", () => {
    const results = filterInferenceResults(mockInferenceResults, "prod web");
    expect(results.length).toBe(1);
    expect(results[0].cluster.clusterName).toBe("prod-web");
    expect(results[0].task.serviceName).toBe("web-service");
  });

  it("推論方法でフィルタリングする", () => {
    const envResults = filterInferenceResults(
      mockInferenceResults,
      "environment",
    );
    expect(envResults.length).toBe(2);
    expect(envResults.every((r) => r.method === "environment")).toBe(true);

    const namingResults = filterInferenceResults(
      mockInferenceResults,
      "naming",
    );
    expect(namingResults.length).toBe(2);
    expect(namingResults.every((r) => r.method === "naming")).toBe(true);
  });

  it("理由のテキストでフィルタリングする", () => {
    const results = filterInferenceResults(mockInferenceResults, "環境変数");
    expect(results.length).toBe(2);
    expect(results.every((r) => r.reason.includes("環境変数"))).toBe(true);
  });

  it("タスクステータスでフィルタリングする", () => {
    const results = filterInferenceResults(mockInferenceResults, "RUNNING");
    expect(results.length).toBe(5);
    expect(results.every((r) => r.task.taskStatus === "RUNNING")).toBe(true);
  });

  it("大文字小文字を区別せずにフィルタリングする", () => {
    const results1 = filterInferenceResults(mockInferenceResults, "PROD");
    const results2 = filterInferenceResults(mockInferenceResults, "prod");
    expect(results1).toEqual(results2);
  });

  it("一致する結果がない場合は空配列を返す", () => {
    const results = filterInferenceResults(mockInferenceResults, "nonexistent");
    expect(results).toEqual([]);
  });
});
