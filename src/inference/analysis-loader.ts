import fs from "node:fs";
import path from "node:path";
import { messages } from "../utils/messages.js";

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

function loadJsonFile(filePath: string): InferenceMatch[] {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (error) {
    messages.warn(
      `Could not load analysis results from ${filePath}: ${String(error)}`,
    );
  }
  return [];
}

export function loadAnalysisResults(): {
  environment: InferenceMatch[];
  naming: InferenceMatch[];
  network: InferenceMatch[];
} {
  const tempDir = path.join(process.cwd(), "temp");

  const environment = loadJsonFile(
    path.join(tempDir, "environment_match_results.json"),
  );
  const naming = loadJsonFile(
    path.join(tempDir, "naming_similarity_results.json"),
  );
  const network = loadJsonFile(
    path.join(tempDir, "network_match_results.json"),
  );

  return { environment, naming, network };
}
