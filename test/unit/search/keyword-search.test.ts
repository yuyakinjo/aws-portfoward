import { describe, expect, it } from "vitest";
import { keywordSearch } from "../../../src/search.js";
import {
  mockECSClusters,
  mockECSTasks,
  mockRDSInstances,
} from "../../mock-data/index.js";

describe("keywordSearch", () => {
  it("単一キーワードで項目をフィルタリングする", () => {
    const results = keywordSearch(mockECSClusters, "prod", (cluster) => [
      cluster.clusterName,
    ]);

    expect(results.length).toBe(3);
    expect(results.every((c) => c.clusterName.includes("prod"))).toBe(true);
  });

  it("複数キーワードでAND検索を行う", () => {
    const results = keywordSearch(mockECSTasks, "prod web", (task) => [
      task.clusterName,
      task.serviceName,
      task.displayName,
    ]);

    expect(results.length).toBe(1);
    expect(results[0].clusterName).toBe("prod-web");
    expect(results[0].serviceName).toBe("web-service");
  });

  it("空の入力の場合は全ての項目を返す", () => {
    const results = keywordSearch(mockRDSInstances, "", (rds) => [
      rds.dbInstanceIdentifier,
    ]);

    expect(results).toEqual(mockRDSInstances);
  });

  it("空白のみの入力の場合は全ての項目を返す", () => {
    const results = keywordSearch(mockRDSInstances, "   ", (rds) => [
      rds.dbInstanceIdentifier,
    ]);

    expect(results).toEqual(mockRDSInstances);
  });

  it("大文字小文字を区別せずに検索する", () => {
    const resultsLower = keywordSearch(
      mockECSClusters,
      "staging",
      (cluster) => [cluster.clusterName],
    );

    const resultsUpper = keywordSearch(
      mockECSClusters,
      "STAGING",
      (cluster) => [cluster.clusterName],
    );

    expect(resultsLower).toEqual(resultsUpper);
    // staging-api, staging-web, staging-backend の3つがマッチ
    expect(resultsLower.length).toBe(3);
  });

  it("複数の検索フィールドを正しく処理する", () => {
    const results = keywordSearch(mockECSTasks, "api", (task) => [
      task.clusterName,
      task.serviceName,
      task.displayName,
    ]);

    // clusterName, serviceName, displayNameのいずれかに"api"が含まれるタスク
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.clusterName.includes("api"))).toBe(true);
    expect(results.some((t) => t.serviceName.includes("api"))).toBe(true);
  });

  it("一致する項目がない場合は空配列を返す", () => {
    const results = keywordSearch(
      mockECSClusters,
      "nonexistent-cluster",
      (cluster) => [cluster.clusterName],
    );

    expect(results).toEqual([]);
  });

  it("特殊文字を含むキーワードも正しく処理する", () => {
    const results = keywordSearch(mockRDSInstances, "prod-web", (rds) => [
      rds.dbInstanceIdentifier,
    ]);

    expect(results.length).toBe(1);
    expect(results[0].dbInstanceIdentifier).toBe("prod-web-db");
  });

  it("部分一致で検索する", () => {
    const results = keywordSearch(mockRDSInstances, "postgres", (rds) => [
      rds.dbInstanceIdentifier,
      rds.engine,
    ]);

    expect(results.length).toBe(2);
    expect(
      results.every(
        (r) =>
          r.dbInstanceIdentifier.includes("postgres") ||
          r.engine.includes("postgres"),
      ),
    ).toBe(true);
  });

  it("複数の短いキーワードでも正しく動作する", () => {
    const results = keywordSearch(mockECSTasks, "a b c", (task) => [
      task.taskId,
    ]);

    // taskIdに"a", "b", "c"が全て含まれるタスクを検索
    const expectedCount = mockECSTasks.filter((task) => {
      const taskId = task.taskId.toLowerCase();
      return (
        taskId.includes("a") && taskId.includes("b") && taskId.includes("c")
      );
    }).length;

    expect(results.length).toBe(expectedCount);
  });
});
