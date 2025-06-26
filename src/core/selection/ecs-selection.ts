import type { ECSClient } from "@aws-sdk/client-ecs";
import { search } from "@inquirer/prompts";
import type { InferenceResult } from "../../inference/index.js";
import { inferECSTargets } from "../../inference/index.js";
import { searchInferenceResults } from "../../search.js";
import type { RDSInstance } from "../../types.js";
import { unwrapBrandedString } from "../../types.js";
import { isEmpty, messages } from "../../utils/index.js";
import { clearLoadingMessage } from "../ui/display-utils.js";
import type { SelectionState } from "../ui/selection-ui.js";

/**
 * Handle ECS target selection with inference
 */
export async function selectECSTarget(
  ecsClient: ECSClient,
  selectedRDS: RDSInstance,
  options: { cluster?: string; task?: string },
  selections: SelectionState,
): Promise<{ selectedInference: InferenceResult; selectedTask: string }> {
  messages.warning(
    "Finding ECS targets with exec capability that can connect to this RDS...",
  );

  const inferenceResults = await inferECSTargets(ecsClient, selectedRDS, false);

  if (isEmpty(inferenceResults)) {
    throw new Error(
      "No ECS targets found with exec capability that can connect to this RDS instance",
    );
  }

  // Clear the loading message
  clearLoadingMessage();

  messages.success(`Found ${inferenceResults.length} potential ECS targets`);
  messages.empty();

  if (options.cluster && options.task) {
    // Try to find matching inference result
    const matchingResult = inferenceResults.find(
      (result) =>
        result.cluster.clusterName === options.cluster &&
        result.task.taskId === options.task,
    );

    if (matchingResult) {
      const inference = matchingResult;
      const task = matchingResult.task.taskArn;
      selections.ecsTarget = unwrapBrandedString(matchingResult.task.serviceName);
      selections.ecsCluster = unwrapBrandedString(matchingResult.cluster.clusterName);
      messages.success(`✓ ECS cluster (from CLI): ${options.cluster}`);
      messages.success(`✓ ECS task (from CLI): ${options.task}`);
      return { selectedInference: inference, selectedTask: task };
    }

    messages.warning(`Specified cluster/task not found in inference results`);
  }

  // If no matching result or no CLI options provided, show search prompt
  const selectedInference = await search({
    message: "Select ECS target:",
    source: async (input) => {
      return await searchInferenceResults(inferenceResults, input || "");
    },
    pageSize: 10,
  });

  if (
    !selectedInference ||
    typeof selectedInference !== "object" ||
    !("task" in selectedInference)
  ) {
    throw new Error("Invalid inference selection");
  }

  const inference = selectedInference as InferenceResult;
  const task = inference.task.taskArn;
  selections.ecsTarget = unwrapBrandedString(inference.task.serviceName);
  selections.ecsCluster = unwrapBrandedString(inference.cluster.clusterName);

  return { selectedInference: inference, selectedTask: task };
}
