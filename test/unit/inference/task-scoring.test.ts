import { describe, expect, it } from "vitest";
import { scoreTasksByNaming } from "../../../src/inference/task-scoring.js";
import {
  mockECSClusters,
  mockECSTasks,
  mockRDSInstances,
} from "../../mock-data/index.js";

describe("scoreTasksByNaming", () => {
  const prodWebCluster = mockECSClusters[0]; // prod-web
  const prodWebDB = mockRDSInstances[0]; // prod-web-db
  const stagingApiDB = mockRDSInstances[1]; // staging-api-postgres

  it("RDS名と完全一致するタスクに高スコアを付与する", async () => {
    const results = await scoreTasksByNaming(
      mockECSTasks.filter((t) => t.clusterName === "prod-web"),
      prodWebCluster,
      prodWebDB,
    );

    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result.cluster).toEqual(prodWebCluster);
      expect(result.method).toBe("naming");
      expect(result.score).toBeGreaterThan(0);
    });
  });

  it("信頼度レベルを正しく設定する", async () => {
    const results = await scoreTasksByNaming(
      mockECSTasks,
      prodWebCluster,
      prodWebDB,
    );

    results.forEach((result) => {
      if (result.score >= 75) {
        expect(result.confidence).toBe("high");
      } else if (result.score >= 50) {
        expect(result.confidence).toBe("medium");
      } else {
        expect(result.confidence).toBe("low");
      }
    });
  });

  it("サービス名にRDS識別子が含まれる場合にボーナススコアを付与する", async () => {
    // staging-api-postgresに対してapi-serviceタスクをテスト
    const apiTasks = mockECSTasks.filter(
      (t) => t.serviceName === "api-service",
    );
    const results = await scoreTasksByNaming(
      apiTasks,
      mockECSClusters[1],
      stagingApiDB,
    );

    expect(results.length).toBeGreaterThan(0);
    const apiServiceResult = results.find(
      (r) => r.task.serviceName === "api-service",
    );
    expect(apiServiceResult).toBeDefined();
    expect(apiServiceResult?.score).toBeGreaterThan(25); // ベーススコア以上
  });

  it("セグメント一致でもスコアを付与する", async () => {
    const devAppDB = mockRDSInstances[2]; // dev-app-mysql
    const devTasks = mockECSTasks.filter((t) => t.clusterName === "dev-app");
    const results = await scoreTasksByNaming(
      devTasks,
      mockECSClusters[2],
      devAppDB,
    );

    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result.score).toBeGreaterThan(25); // ベーススコア以上
      expect(result.reason).toBe("名前類似性関連");
    });
  });

  it("空のタスクリストの場合は空配列を返す", async () => {
    const results = await scoreTasksByNaming([], prodWebCluster, prodWebDB);
    expect(results).toEqual([]);
  });

  it("大文字小文字を区別せずにマッチングする", async () => {
    // タスク名とRDS名で大文字小文字が異なる場合でもマッチする
    const testRDS = {
      ...prodWebDB,
      dbInstanceIdentifier: "PROD-WEB-DB",
    };

    const results = await scoreTasksByNaming(
      mockECSTasks.filter((t) => t.clusterName === "prod-web"),
      prodWebCluster,
      testRDS,
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(25);
  });

  it("全てのタスクに対して結果オブジェクトを生成する", async () => {
    const tasks = mockECSTasks.slice(0, 3);
    const results = await scoreTasksByNaming(tasks, prodWebCluster, prodWebDB);

    expect(results.length).toBe(tasks.length);
    results.forEach((result, index) => {
      expect(result.task).toEqual(tasks[index]);
      expect(result.cluster).toEqual(prodWebCluster);
      expect(result.confidence).toMatch(/^(high|medium|low)$/);
      expect(result.method).toBe("naming");
      expect(result.score).toBeGreaterThanOrEqual(25);
      expect(result.reason).toBe("名前類似性関連");
    });
  });
});
