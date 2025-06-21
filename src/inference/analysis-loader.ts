import fs from "node:fs";
import path from "node:path";

// 型定義（循環インポートを避けるため直接定義）
interface InferenceMatch {
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

/**
 * Load analysis results from temp directory
 */
export function loadAnalysisResults(): {
  environment: InferenceMatch[];
  naming: InferenceMatch[];
  network: InferenceMatch[];
} {
  const tempDir = path.join(process.cwd(), "temp");

  let environment: InferenceMatch[] = [];
  let naming: InferenceMatch[] = [];
  let network: InferenceMatch[] = [];

  try {
    const envPath = path.join(tempDir, "environment_match_results.json");
    if (fs.existsSync(envPath)) {
      environment = JSON.parse(fs.readFileSync(envPath, "utf-8"));
    }
  } catch (error) {
    console.warn("Could not load environment analysis results:", error);
  }

  try {
    const namingPath = path.join(tempDir, "naming_similarity_results.json");
    if (fs.existsSync(namingPath)) {
      naming = JSON.parse(fs.readFileSync(namingPath, "utf-8"));
    }
  } catch (error) {
    console.warn("Could not load naming analysis results:", error);
  }

  try {
    const networkPath = path.join(tempDir, "network_match_results.json");
    if (fs.existsSync(networkPath)) {
      network = JSON.parse(fs.readFileSync(networkPath, "utf-8"));
    }
  } catch (error) {
    console.warn("Could not load network analysis results:", error);
  }

  return { environment, naming, network };
}
