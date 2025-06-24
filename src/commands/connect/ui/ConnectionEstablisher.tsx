import { Box, Text, useApp, useInput } from "ink";
import type React from "react";
import { useEffect, useState } from "react";
import { generateReproducibleCommand } from "../../../core/command-generation.js";
import { generateConnectDryRun } from "../../../core/dry-run.js";
import type { InferenceResult } from "../../../inference/index.js";
import { startSSMSession } from "../../../session.js";
import type { DryRunResult, RDSInstance } from "../../../types.js";

interface ConnectionEstablisherProps {
  region: string;
  rdsInstance: RDSInstance;
  rdsPort: string;
  inferenceResult: InferenceResult;
  localPort: string;
  isDryRun: boolean;
  onBack: () => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

type ConnectionState = "confirming" | "connecting" | "connected" | "error";

export const ConnectionEstablisher: React.FC<ConnectionEstablisherProps> = ({
  region,
  rdsInstance,
  rdsPort,
  inferenceResult,
  localPort,
  isDryRun,
  onBack,
  onComplete,
  onError,
}) => {
  const { exit } = useApp();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("confirming");
  const [reproducibleCommand, setReproducibleCommand] = useState<string>("");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  // コマンド生成
  useEffect(() => {
    const command = generateReproducibleCommand(
      region,
      inferenceResult.cluster.clusterName,
      inferenceResult.task.taskArn,
      rdsInstance.dbInstanceIdentifier,
      rdsPort,
      localPort,
    );
    setReproducibleCommand(command);
  }, [region, inferenceResult, rdsInstance, rdsPort, localPort]);

  // 接続処理
  const handleConnect = async () => {
    try {
      setConnectionState("connecting");

      if (isDryRun) {
        // Dry run実行
        const result = generateConnectDryRun(
          region,
          inferenceResult.cluster.clusterName,
          inferenceResult.task.taskArn,
          rdsInstance,
          rdsPort,
          localPort,
        );

        setDryRunResult(result);
        setConnectionState("connected");
        onComplete();
      } else {
        // 実際の接続を開始
        await startSSMSession(
          inferenceResult.task.taskArn,
          rdsInstance,
          rdsPort,
          localPort,
          reproducibleCommand,
        );
        setConnectionState("connected");
        onComplete();
      }
    } catch (error) {
      setConnectionState("error");
      onError(
        `接続エラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
      );
    }
  };

  // キーボード入力処理
  useInput((input, key) => {
    if (connectionState === "confirming") {
      if (key.return || input === "y" || input === "Y") {
        handleConnect();
      } else if (
        key.escape ||
        key.leftArrow ||
        input === "n" ||
        input === "N"
      ) {
        onBack();
      }
    } else if (connectionState === "connected" || connectionState === "error") {
      if (key.return || key.escape) {
        exit();
      }
    }
  });

  const renderConnectionSummary = () => (
    <Box
      flexDirection="column"
      marginBottom={1}
      paddingLeft={2}
      borderStyle="single"
      borderColor="cyan"
    >
      <Text color="cyan" bold>
        接続サマリー:
      </Text>
      <Text>
        リージョン: <Text color="yellow">{region}</Text>
      </Text>
      <Text>
        RDS: <Text color="yellow">{rdsInstance.dbInstanceIdentifier}</Text> :
        {rdsPort}
      </Text>
      <Text>
        ECS: <Text color="yellow">{inferenceResult.task.serviceName}</Text> [
        {inferenceResult.cluster.clusterName}]
      </Text>
      <Text>
        ローカルポート: <Text color="yellow">{localPort}</Text>
      </Text>
      <Text>
        接続URL: <Text color="green">localhost:{localPort}</Text>
      </Text>
    </Box>
  );

  const renderReproducibleCommand = () => (
    <Box
      flexDirection="column"
      marginBottom={1}
      paddingLeft={2}
      borderStyle="single"
      borderColor="gray"
    >
      <Text color="gray" bold>
        再実行用コマンド:
      </Text>
      <Text color="gray" wrap="wrap">
        {reproducibleCommand}
      </Text>
    </Box>
  );

  const renderDryRunResult = () => {
    if (!dryRunResult) return null;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
          <Text color="green" bold>
            🧪 Dry Run結果
          </Text>
        </Box>

        {/* AWS SSMコマンド */}
        <Box
          flexDirection="column"
          marginBottom={1}
          paddingLeft={2}
          borderStyle="single"
          borderColor="green"
        >
          <Text color="green" bold>
            実行されるAWSコマンド:
          </Text>
          <Text color="white" wrap="wrap">
            {dryRunResult.awsCommand}
          </Text>
        </Box>

        {/* セッション情報 */}
        <Box
          flexDirection="column"
          marginBottom={1}
          paddingLeft={2}
          borderStyle="single"
          borderColor="blue"
        >
          <Text color="blue" bold>
            セッション情報:
          </Text>
          <Text>
            リージョン:{" "}
            <Text color="yellow">{dryRunResult.sessionInfo.region}</Text>
          </Text>
          <Text>
            クラスター:{" "}
            <Text color="yellow">{dryRunResult.sessionInfo.cluster}</Text>
          </Text>
          <Text>
            タスク: <Text color="yellow">{dryRunResult.sessionInfo.task}</Text>
          </Text>
          {dryRunResult.sessionInfo.rds && (
            <Text>
              RDS: <Text color="yellow">{dryRunResult.sessionInfo.rds}</Text>
            </Text>
          )}
          {dryRunResult.sessionInfo.rdsPort && (
            <Text>
              RDSポート:{" "}
              <Text color="yellow">{dryRunResult.sessionInfo.rdsPort}</Text>
            </Text>
          )}
          {dryRunResult.sessionInfo.localPort && (
            <Text>
              ローカルポート:{" "}
              <Text color="yellow">{dryRunResult.sessionInfo.localPort}</Text>
            </Text>
          )}
        </Box>

        {/* 再実行用コマンド */}
        <Box
          flexDirection="column"
          marginBottom={1}
          paddingLeft={2}
          borderStyle="single"
          borderColor="cyan"
        >
          <Text color="cyan" bold>
            再実行用コマンド:
          </Text>
          <Text color="white" wrap="wrap">
            {dryRunResult.reproducibleCommand}
          </Text>
        </Box>

        <Text color="green">
          ✅ Dry runが正常に完了しました。上記のコマンドが実行されます。
        </Text>
      </Box>
    );
  };

  if (connectionState === "confirming") {
    return (
      <Box flexDirection="column">
        {/* ヘッダー */}
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            🚀 接続確認 {isDryRun && "(DRY RUN)"}
          </Text>
        </Box>

        {renderConnectionSummary()}
        {renderReproducibleCommand()}

        {/* 確認メッセージ */}
        <Box marginBottom={1}>
          <Text color="yellow">
            {isDryRun
              ? "Dry runを実行しますか？"
              : "この設定で接続を開始しますか？"}
          </Text>
        </Box>

        {/* ヘルプ */}
        <Box flexDirection="column">
          <Text color="gray">
            Y/Enter: {isDryRun ? "Dry run実行" : "接続開始"} N/←/Esc: 戻る
          </Text>
        </Box>
      </Box>
    );
  }

  if (connectionState === "connecting") {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="yellow">
            {isDryRun ? "Dry run実行中..." : "接続を確立中..."}
          </Text>
        </Box>

        {renderConnectionSummary()}

        <Text color="gray">
          {isDryRun
            ? "コマンドの検証とテストを実行しています"
            : "SSMセッションを開始しています。しばらくお待ちください..."}
        </Text>
      </Box>
    );
  }

  if (connectionState === "connected") {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="green" bold>
            ✅ {isDryRun ? "Dry run完了" : "接続確立完了"}
          </Text>
        </Box>

        {isDryRun ? (
          renderDryRunResult()
        ) : (
          <>
            {renderConnectionSummary()}

            <Box flexDirection="column" marginBottom={1}>
              <Text color="green">
                ポートフォワーディングが開始されました！
              </Text>
              <Text color="gray">
                localhost:{localPort} への接続でRDSにアクセスできます。
              </Text>
              <Text color="gray">
                例: mysql -h localhost -P {localPort} -u username -p
              </Text>
            </Box>

            {renderReproducibleCommand()}
          </>
        )}

        <Text color="gray">Enter/Esc: 終了</Text>
      </Box>
    );
  }

  // エラー状態
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="red" bold>
          ❌ 接続エラー
        </Text>
      </Box>

      {renderConnectionSummary()}

      <Text color="gray">Enter/Esc: 終了</Text>
    </Box>
  );
};
