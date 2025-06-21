// 型定義をエクスポート
export interface InferenceResult {
  cluster: import("../types.js").ECSCluster;
  task: import("../types.js").ECSTask;
  confidence: "high" | "medium" | "low";
  method: "environment" | "naming" | "network";
  score: number;
  reason: string;
}

export interface InferenceMatch {
  rds_identifier: string;
  task_family?: string;
  cluster?: string;
  task_arn?: string;
  confidence: "high" | "medium" | "low";
  match_score?: number;
  similarity_score?: number;
  match_reasons?: string[];
  method?: string;
  service?: string;
  task_definition?: string;
  rds_engine?: string;
  match_details?: Record<string, unknown>;
}

// 分割されたモジュールからの再エクスポート
export type { PerformanceMetrics } from "./performance-tracker.js";
export { PerformanceTracker } from "./performance-tracker.js";
export { inferClustersFromRDSName } from "./cluster-inference.js";
export { scoreTasksByNaming, scoreTasksAgainstRDS } from "./task-scoring.js";
export { loadAnalysisResults } from "./analysis-loader.js";

// メイン推論関数とフォーマッタ
export { inferECSTargets, formatInferenceResult } from "./main-inference.js";
