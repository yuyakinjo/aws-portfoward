import { describe, expect, it } from "vitest";
import { inferClustersFromRDSName } from "../../../src/inference/cluster-inference.js";
import { mockECSClusters } from "../../mock-data/index.js";

describe("inferClustersFromRDSName", () => {
  it("完全一致するクラスター名を最優先で返す", () => {
    const result = inferClustersFromRDSName({
      rdsName: "prod-web",
      allClusters: mockECSClusters,
    });
    expect(result[0]).toBe("prod-web");
  });

  it("RDS名のプレフィックスに一致するクラスターを返す", () => {
    const result = inferClustersFromRDSName({
      rdsName: "prod-web-db",
      allClusters: mockECSClusters,
    });
    expect(result).toContain("prod-web");
    expect(result.indexOf("prod-web")).toBeLessThan(5); // 上位に位置
  });

  it("RDS名に含まれる環境名でクラスターを推論する", () => {
    const result = inferClustersFromRDSName({
      rdsName: "staging-database-mysql",
      allClusters: mockECSClusters,
    });
    const stagingClusters = result.filter((name) => name.includes("staging"));
    expect(stagingClusters.length).toBeGreaterThan(0);
    expect(stagingClusters).toContain("staging-api");
    expect(stagingClusters).toContain("staging-web");
  });

  it("複数のセグメントに一致するクラスターを高スコアで返す", () => {
    const result = inferClustersFromRDSName({
      rdsName: "prod-api-aurora",
      allClusters: mockECSClusters,
    });
    expect(result[0]).toBe("prod-api"); // prod と api の両方に一致
  });

  it("ハイフンまたはアンダースコアで区切られたセグメントを正しく処理する", () => {
    const result = inferClustersFromRDSName({
      rdsName: "test_service_postgres",
      allClusters: mockECSClusters,
    });
    expect(result).toContain("test-service");
  });

  it("共通パターン（app, web, api, service）を考慮して推論する", () => {
    const result = inferClustersFromRDSName({
      rdsName: "production-webapp-rds",
      allClusters: mockECSClusters,
    });
    const webClusters = result.filter((name) => name.includes("web"));
    expect(webClusters.length).toBeGreaterThan(0);
  });

  it("一致するクラスターがない場合は空配列を返す", () => {
    const result = inferClustersFromRDSName({
      rdsName: "unknown-xyz-123",
      allClusters: mockECSClusters,
    });
    expect(result).toEqual([]);
  });

  it("空のクラスターリストの場合は空配列を返す", () => {
    const result = inferClustersFromRDSName({
      rdsName: "prod-web-db",
      allClusters: [],
    });
    expect(result).toEqual([]);
  });

  it("大文字小文字を区別せずに推論する", () => {
    const result = inferClustersFromRDSName({
      rdsName: "PROD-WEB-DB",
      allClusters: mockECSClusters,
    });
    expect(result).toContain("prod-web");
  });

  it("スコアに基づいて結果を降順でソートする", () => {
    const result = inferClustersFromRDSName({
      rdsName: "prod-backend-db",
      allClusters: mockECSClusters,
    });
    // prod-backend が完全に一致するため最初に来るべき
    expect(result[0]).toBe("prod-backend");
    // その後に他のprod系クラスターが続く
    expect(result.slice(1)).toContain("prod-web");
    expect(result.slice(1)).toContain("prod-api");
  });
});
