import { splitByHyphenUnderscore, splitByWordSeparators } from "../regex.js";
import type { ECSCluster } from "../types.js";

/**
 * RDS名からECSクラスター名を推論する関数
 */
export function inferClustersFromRDSName(
  rdsName: string,
  allClusters: ECSCluster[],
): string[] {
  const rdsSegments = splitByHyphenUnderscore(rdsName.toLowerCase());
  const rdsWords = splitByWordSeparators(rdsName.toLowerCase());
  const rdsLower = rdsName.toLowerCase();

  const envIndicators = [
    "dev",
    "development",
    "staging",
    "stage",
    "stg",
    "prod",
    "production",
    "test",
  ];

  const commonPatterns = [
    "app",
    "web",
    "api",
    "service",
    "backend",
    "frontend",
  ];

  return allClusters
    .map((cluster) => {
      const clusterName = cluster.clusterName.toLowerCase();

      // スコア計算ロジックを関数型で実装
      const scoreCalculations = [
        // 完全一致
        { condition: clusterName === rdsLower, score: 100 },
        // プレフィックス一致
        {
          condition:
            clusterName.startsWith(rdsLower) ||
            rdsLower.startsWith(clusterName),
          score: 80,
        },
        // 部分一致
        { condition: clusterName.includes(rdsLower), score: 70 },
        // 逆部分一致
        {
          condition: rdsLower.includes(clusterName) && clusterName.length > 3,
          score: 60,
        },
      ];

      // セグメント一致のスコア
      const segmentScore =
        rdsSegments.filter(
          (segment) => segment.length > 2 && clusterName.includes(segment),
        ).length * 30;

      // 単語一致のスコア
      const wordScore =
        rdsWords.filter((word) => word.length > 2 && clusterName.includes(word))
          .length * 15;

      // 環境指標一致のスコア
      const envScore =
        envIndicators.filter(
          (env) => rdsLower.includes(env) && clusterName.includes(env),
        ).length * 25;

      // 共通パターン一致のスコア
      const patternScore =
        commonPatterns.filter(
          (pattern) =>
            rdsLower.includes(pattern) && clusterName.includes(pattern),
        ).length * 20;

      // 総スコア計算
      const baseScore = scoreCalculations
        .filter((calc) => calc.condition)
        .reduce((total, calc) => total + calc.score, 0);

      const totalScore =
        baseScore + segmentScore + wordScore + envScore + patternScore;

      return { clusterName: cluster.clusterName, score: totalScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.clusterName);
}
