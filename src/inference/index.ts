// 型定義をエクスポート
export interface InferenceResult {
  cluster: import("../types.js").ECSCluster;
  task: import("../types.js").ECSTask;
  confidence: "high" | "medium" | "low";
  method: "environment" | "naming" | "network";
  score: number;
  reason: string;
  reasons: string[]; // Add reasons array for compatibility
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

export { loadAnalysisResults } from "./analysis-loader.js";
export { inferClustersFromRDSName } from "./cluster-inference.js";
// メイン推論関数とフォーマッタ
export { formatInferenceResult, inferECSTargets } from "./main-inference.js";
// 分割されたモジュールからの再エクスポート
export type { PerformanceMetrics } from "./performance-tracker.js";
export { PerformanceTracker } from "./performance-tracker.js";
export { scoreTasksAgainstRDS, scoreTasksByNaming } from "./task-scoring.js";
