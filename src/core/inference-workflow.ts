import { isEmpty } from "../utils/index.js";
import {
  formatInferenceResult,
  type InferenceResult,
} from "../inference/index.js";
import { splitByWhitespace } from "../regex.js";
import type { ECSCluster } from "../types.js";

export interface InferenceWorkflowResult {
  selectedInference?: InferenceResult;
  selectedTask: string;
  selectedCluster: ECSCluster;
}

/**
 * Filter inference results based on user input
 * Searches through cluster name, task name, service name, confidence, and reason
 *
 * Examples:
 * - "prod web" - finds tasks in production clusters with web services
 * - "staging api" - finds staging API tasks
 * - "high" - finds high confidence matches
 * - "medium 中" - finds medium confidence matches (Japanese)
 */
export function filterInferenceResults(
  results: InferenceResult[],
  input: string,
): InferenceResult[] {
  if (!input || isEmpty(input.trim())) {
    return results;
  }

  // Split input into keywords and convert to lowercase
  const keywords = splitByWhitespace(input.trim().toLowerCase()).filter(
    (keyword) => keyword.length > 0,
  );

  if (isEmpty(keywords)) {
    return results;
  }

  return results.filter((result) => {
    // Create searchable text combining multiple fields
    const searchableText = [
      result.cluster.clusterName,
      result.task.displayName,
      result.task.serviceName,
      result.task.taskStatus,
      result.task.runtimeId,
      result.confidence,
      result.method,
      result.reason,
      formatInferenceResult(result),
      // Add confidence levels for easier searching
      result.confidence === "high" ? "high 高" : "",
      result.confidence === "medium" ? "medium 中" : "",
      result.confidence === "low" ? "low 低" : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // All keywords must be found in the searchable text
    return keywords.every((keyword) => searchableText.includes(keyword));
  });
}
