import { ECSClient } from "@aws-sdk/client-ecs";
import { Box, Text, useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import {
  type InferenceResult,
  inferECSTargets,
} from "../../../inference/index.js";
import type { RDSInstance } from "../../../types.js";
import { LoadingSpinner } from "../../../ui/components/LoadingSpinner.js";

interface Props {
  region: string;
  rdsInstance: RDSInstance;
  presetCluster?: string;
  presetTask?: string;
  onSelect: (result: InferenceResult) => void;
  onBack: () => void;
  onError: (error: string) => void;
}

const confidenceColors = {
  high: "#00ff00",
  medium: "#ffff00",
  low: "#ff8800",
} as const;

const statusColors = {
  RUNNING: "#00ff00",
  PENDING: "#ffff00",
  STOPPED: "#ff0000",
  STOPPING: "#ff8800",
} as const;

export const ECSSelector = ({
  region,
  rdsInstance,
  presetCluster,
  presetTask,
  onSelect,
  onBack,
  onError,
}: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [inferenceResults, setInferenceResults] = useState<InferenceResult[]>(
    [],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // ECS推論の実行
  useEffect(() => {
    // エラー状態の場合は再実行しない
    if (hasError) return;

    const loadInferenceResults = async () => {
      try {
        setIsLoading(true);
        const ecsClient = new ECSClient({ region });
        const results = await inferECSTargets(ecsClient, rdsInstance, false); // デバッグモード無効

        if (results.length === 0) {
          setIsLoading(false); // ローディング状態を終了
          setHasError(true); // エラー状態を設定
          onError("No ECS targets found with exec capability");
          return;
        }

        setInferenceResults(results);

        // プリセット値がある場合は自動選択を試行
        if (presetCluster && presetTask) {
          const matchingResult = results.find(
            (result) =>
              result.cluster.clusterName === presetCluster &&
              result.task.taskId === presetTask,
          );

          if (matchingResult) {
            onSelect(matchingResult);
            return;
          }
        }

        setIsLoading(false);
      } catch (error) {
        setIsLoading(false); // ローディング状態を終了
        setHasError(true); // エラー状態を設定
        const errorMessage =
          error instanceof Error ? error.message : "不明なエラー";
        onError(`ECS推論エラー: ${errorMessage}`);
      }
    };

    loadInferenceResults();
  }, [
    region,
    rdsInstance,
    presetCluster,
    presetTask,
    onSelect,
    onError,
    hasError,
  ]);

  // キーボード入力処理
  useInput((input, key) => {
    if (isLoading) return;

    // ナビゲーション
    if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, inferenceResults.length - 1),
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev < inferenceResults.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    // 選択実行
    if (key.return) {
      if (inferenceResults[selectedIndex]) {
        onSelect(inferenceResults[selectedIndex]);
      }
      return;
    }

    // 戻る・キャンセル
    if (key.escape || key.leftArrow) {
      onBack();
      return;
    }

    // 詳細表示切り替え（Ctrl+D）
    if (key.ctrl && input === "d") {
      setShowDetails(!showDetails);
      return;
    }
  });

  // 選択インデックスの調整
  useEffect(() => {
    if (selectedIndex >= inferenceResults.length) {
      setSelectedIndex(Math.max(0, inferenceResults.length - 1));
    }
  }, [inferenceResults.length, selectedIndex]);

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">Running ECS inference...</Text>
        <LoadingSpinner />
        <Text color="gray">
          Searching for ECS targets that can connect to RDS "
          {rdsInstance.dbInstanceIdentifier}"
        </Text>
      </Box>
    );
  }

  const selectedResult = inferenceResults[selectedIndex];

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          📋 Select ECS Target ({inferenceResults.length} items)
        </Text>
      </Box>

      {/* Results list */}
      {inferenceResults.length === 0 ? (
        <Box marginBottom={1}>
          <Text color="red">No ECS targets found</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {(() => {
            const maxVisible = 8;
            const startIndex = Math.max(
              0,
              Math.min(
                selectedIndex - Math.floor(maxVisible / 2),
                inferenceResults.length - maxVisible,
              ),
            );
            const endIndex = Math.min(
              startIndex + maxVisible,
              inferenceResults.length,
            );
            const visibleResults = inferenceResults.slice(startIndex, endIndex);

            return (
              <>
                {startIndex > 0 && (
                  <Text color="gray">... {startIndex} more above</Text>
                )}
                {visibleResults.map((result, index) => {
                  const actualIndex = startIndex + index;
                  const isSelected = actualIndex === selectedIndex;
                  const isRunning = result.task.taskStatus === "RUNNING";

                  return (
                    <Box
                      key={`${result.cluster.clusterName}-${result.task.taskId}`}
                    >
                      <Text>
                        {isSelected ? (
                          <Text color="cyan" bold>
                            ▶
                          </Text>
                        ) : (
                          "  "
                        )}
                        <Text color={confidenceColors[result.confidence]}>
                          ●
                        </Text>{" "}
                        <Text
                          bold={isSelected}
                          color={
                            isSelected ? "cyan" : isRunning ? "white" : "gray"
                          }
                        >
                          {result.task.serviceName}
                        </Text>{" "}
                        <Text color="gray">[{result.cluster.clusterName}]</Text>
                      </Text>
                    </Box>
                  );
                })}
                {endIndex < inferenceResults.length && (
                  <Text color="gray">
                    ... and {inferenceResults.length - endIndex} more
                  </Text>
                )}
              </>
            );
          })()}
        </Box>
      )}

      {/* Detailed information */}
      {showDetails && selectedResult && (
        <Box
          flexDirection="column"
          marginBottom={1}
          paddingLeft={2}
          borderStyle="single"
          borderColor="gray"
        >
          <Text color="cyan" bold>
            Detailed Information:
          </Text>
          <Text>
            Cluster:{" "}
            <Text color="yellow">{selectedResult.cluster.clusterName}</Text>
          </Text>
          <Text>
            Service:{" "}
            <Text color="yellow">{selectedResult.task.serviceName}</Text>
          </Text>
          <Text>
            Task ID: <Text color="yellow">{selectedResult.task.taskId}</Text>
          </Text>
          <Text>
            Status:{" "}
            <Text
              color={
                statusColors[
                  selectedResult.task.taskStatus as keyof typeof statusColors
                ] || "gray"
              }
            >
              {selectedResult.task.taskStatus}
            </Text>
          </Text>
          <Text>
            Confidence:{" "}
            <Text color={confidenceColors[selectedResult.confidence]}>
              {selectedResult.confidence.toUpperCase()}
            </Text>
          </Text>
          <Text>
            Score:{" "}
            <Text color="yellow">
              {Math.round(selectedResult.score * 100)}%
            </Text>
          </Text>
          <Text>
            Method: <Text color="yellow">{selectedResult.method}</Text>
          </Text>
          <Text>
            Reason: <Text color="gray">{selectedResult.reason}</Text>
          </Text>
        </Box>
      )}

      {/* Help */}
      <Box flexDirection="column">
        <Text color="gray">
          ↑↓: Navigate Enter: Select ←/Esc: Back Ctrl+D: Toggle Details
        </Text>
        {selectedResult &&
          !selectedResult.task.taskStatus.match(/RUNNING|PENDING/) && (
            <Text color="red">
              ⚠️ Selected task is not running. Connection may fail.
            </Text>
          )}
      </Box>
    </Box>
  );
};
