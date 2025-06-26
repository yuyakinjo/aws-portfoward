import { search } from "@inquirer/prompts";
import type { InferenceResult } from "../../inference/index.js";
import { inferECSTargets } from "../../inference/index.js";
import { isTaskArnShape } from "../../regex.js";
import { searchInferenceResults } from "../../search.js";
import type { ECSTargetSelectionParams } from "../../types.js";
import { unwrapBrandedString } from "../../types.js";
import { isEmpty, messages } from "../../utils/index.js";
import { clearLoadingMessage } from "../ui/display-utils.js";

// UI Configuration constants
const DEFAULT_PAGE_SIZE = 50;

/**
 * Handle ECS target selection with inference
 */
export async function selectECSTarget(
  params: ECSTargetSelectionParams & {
    selections: {
      ecsTarget?: string;
      ecsCluster?: string;
      region?: string;
      localPort?: string;
      rds?: string;
      rdsPort?: string;
    };
  },
): Promise<{ selectedInference: InferenceResult; selectedTask: string }> {
  const { ecsClient, selectedRDS, options, selections } = params;

  messages.warning(
    "Finding ECS targets with exec capability that can connect to this RDS...",
  );

  const inferenceResults = await inferECSTargets({
    ecsClient,
    selectedRDS,
    enableNetworkAnalysis: false,
  });

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
    // options.taskがTaskArn形式かTaskId形式かで比較
    const matchingResult = inferenceResults.find((result) => {
      const clusterMatch = result.cluster.clusterName === options.cluster;
      if (isTaskArnShape(options.task)) {
        // TaskArnで比較（string化して比較）
        return (
          clusterMatch &&
          result.task.taskArn === (options.task as unknown as string)
        );
      } else {
        // TaskIdで比較
        return clusterMatch && result.task.taskId === options.task;
      }
    });

    if (matchingResult) {
      const inference = matchingResult;
      const task = matchingResult.task.taskArn;
      selections.ecsCluster = unwrapBrandedString(
        matchingResult.cluster.clusterName,
      );
      selections.ecsTarget = matchingResult.task.taskArn;
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
    pageSize: DEFAULT_PAGE_SIZE,
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
  selections.ecsCluster = unwrapBrandedString(inference.cluster.clusterName);
  selections.ecsTarget = inference.task.taskArn;

  return { selectedInference: inference, selectedTask: task };
}
