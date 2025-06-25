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

type FilterMode = "all" | "high" | "medium" | "low" | "running";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
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
          onError("ECS exec機能を持つターゲットが見つかりませんでした");
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

  // フィルタリング・検索ロジック
  const filteredResults = useMemo(() => {
    return inferenceResults
      .filter((result) => {
        // フィルタリング
        switch (filterMode) {
          case "high":
            return result.confidence === "high";
          case "medium":
            return result.confidence === "medium";
          case "low":
            return result.confidence === "low";
          case "running":
            return result.task.taskStatus === "RUNNING";
          default:
            return true;
        }
      })
      .filter((result) => {
        // 検索クエリでフィルタリング
        if (!searchQuery.trim()) return true;

        const searchText = [
          result.cluster.clusterName,
          result.task.serviceName,
          result.task.taskId,
          result.reason,
          result.method,
        ]
          .join(" ")
          .toLowerCase();

        return searchQuery
          .toLowerCase()
          .split(" ")
          .every((term) => searchText.includes(term));
      });
  }, [inferenceResults, filterMode, searchQuery]);

  // キーボード入力処理
  useInput((input, key) => {
    if (isLoading) return;

    // ナビゲーション（最優先）
    if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, filteredResults.length - 1),
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev < filteredResults.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    // 選択実行
    if (key.return) {
      if (filteredResults[selectedIndex]) {
        onSelect(filteredResults[selectedIndex]);
      }
      return;
    }

    // 戻る・キャンセル
    if (key.escape || (key.leftArrow && !searchQuery)) {
      onBack();
      return;
    }

    // 検索クエリ削除
    if (key.backspace || key.delete) {
      setSearchQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    // 特殊機能キー（Ctrl+キーのみ）
    if (key.ctrl && input === "f") {
      // 検索クリア（Ctrl+F）
      setSearchQuery("");
      setSelectedIndex(0);
      return;
    }

    if (key.ctrl && input === "d") {
      // 詳細表示切り替え（Ctrl+D）
      setShowDetails(!showDetails);
      return;
    }

    if (key.ctrl && input === "r") {
      // フィルタ切り替え（Ctrl+R）
      const modes: FilterMode[] = ["all", "high", "medium", "low", "running"];
      const currentIndex = modes.indexOf(filterMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      const nextMode = modes[nextIndex];
      if (nextMode) {
        setFilterMode(nextMode);
        setSelectedIndex(0);
      }
      return;
    }

    // 通常の文字入力（検索）
    if (input && input.length === 1 && !key.ctrl && !key.meta && !key.shift) {
      setSearchQuery((prev) => prev + input);
      setSelectedIndex(0);
      return;
    }
  });

  // 選択インデックスの調整
  useEffect(() => {
    if (selectedIndex >= filteredResults.length) {
      setSelectedIndex(Math.max(0, filteredResults.length - 1));
    }
  }, [filteredResults.length, selectedIndex]);

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">ECS推論を実行中...</Text>
        <LoadingSpinner />
        <Text color="gray">
          RDS "{rdsInstance.dbInstanceIdentifier}"
          に接続可能なECSターゲットを検索しています
        </Text>
      </Box>
    );
  }

  const selectedResult = filteredResults[selectedIndex];

  return (
    <Box flexDirection="column">
      {/* ヘッダー */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          📋 ECSターゲット選択 ({filteredResults.length}/
          {inferenceResults.length}件)
        </Text>
      </Box>

      {/* フィルタ・検索状態 */}
      <Box marginBottom={1}>
        <Text color="gray">
          フィルタ: <Text color="yellow">{filterMode}</Text>
          {searchQuery && (
            <>
              {" "}
              | 検索: <Text color="yellow">"{searchQuery}"</Text>
            </>
          )}{" "}
          | 詳細:{" "}
          <Text color={showDetails ? "green" : "gray"}>
            {showDetails ? "ON" : "OFF"}
          </Text>
        </Text>
      </Box>

      {/* 結果リスト */}
      {filteredResults.length === 0 ? (
        <Box marginBottom={1}>
          <Text color="red">
            {searchQuery
              ? `"${searchQuery}" にマッチするECSターゲットが見つかりませんでした`
              : `フィルタ "${filterMode}" にマッチするECSターゲットが見つかりませんでした`}
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {filteredResults.slice(0, 8).map((result, index) => {
            const isSelected = index === selectedIndex;
            const isRunning = result.task.taskStatus === "RUNNING";

            return (
              <Box key={`${result.cluster.clusterName}-${result.task.taskId}`}>
                <Text
                  color={isSelected ? "black" : "white"}
                  backgroundColor={isSelected ? "cyan" : undefined}
                >
                  {isSelected ? "▶ " : "  "}
                  <Text color={confidenceColors[result.confidence]}>●</Text>{" "}
                  <Text bold={isRunning} color={isRunning ? undefined : "gray"}>
                    {result.task.serviceName}
                  </Text>{" "}
                  <Text color="gray">[{result.cluster.clusterName}]</Text>{" "}
                  <Text
                    color={
                      statusColors[
                        result.task.taskStatus as keyof typeof statusColors
                      ] || "gray"
                    }
                  >
                    {result.task.taskStatus}
                  </Text>{" "}
                  <Text color="yellow">{Math.round(result.score * 100)}%</Text>
                </Text>
              </Box>
            );
          })}

          {filteredResults.length > 8 && (
            <Text color="gray">... 他 {filteredResults.length - 8} 件</Text>
          )}
        </Box>
      )}

      {/* 詳細情報 */}
      {showDetails && selectedResult && (
        <Box
          flexDirection="column"
          marginBottom={1}
          paddingLeft={2}
          borderStyle="single"
          borderColor="gray"
        >
          <Text color="cyan" bold>
            詳細情報:
          </Text>
          <Text>
            クラスター:{" "}
            <Text color="yellow">{selectedResult.cluster.clusterName}</Text>
          </Text>
          <Text>
            サービス:{" "}
            <Text color="yellow">{selectedResult.task.serviceName}</Text>
          </Text>
          <Text>
            タスクID: <Text color="yellow">{selectedResult.task.taskId}</Text>
          </Text>
          <Text>
            ステータス:{" "}
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
            信頼度:{" "}
            <Text color={confidenceColors[selectedResult.confidence]}>
              {selectedResult.confidence.toUpperCase()}
            </Text>
          </Text>
          <Text>
            スコア:{" "}
            <Text color="yellow">
              {Math.round(selectedResult.score * 100)}%
            </Text>
          </Text>
          <Text>
            推論方法: <Text color="yellow">{selectedResult.method}</Text>
          </Text>
          <Text>
            理由: <Text color="gray">{selectedResult.reason}</Text>
          </Text>
        </Box>
      )}

      {/* ヘルプ */}
      <Box flexDirection="column">
        <Text color="gray">
          ↑↓: 選択 Enter: 決定 ←/Esc: 戻る 文字入力: 検索 Backspace: 削除
        </Text>
        <Text color="gray">
          Ctrl+R: フィルタ切替 Ctrl+D: 詳細表示 Ctrl+F: 検索クリア
        </Text>
        <Text color="gray">
          フィルタ: all → high → medium → low → running → all
        </Text>
        {selectedResult &&
          !selectedResult.task.taskStatus.match(/RUNNING|PENDING/) && (
            <Text color="red">
              ⚠️ 選択されたタスクは停止中です。接続できない可能性があります。
            </Text>
          )}
      </Box>
    </Box>
  );
};
