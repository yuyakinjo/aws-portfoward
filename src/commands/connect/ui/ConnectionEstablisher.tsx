import { Box, Text, useApp, useInput } from "ink";
import { useCallback, useEffect, useState } from "react";
import { generateReproducibleCommand } from "../../../core/command-generation.js";
import { generateConnectDryRun } from "../../../core/dry-run.js";
import type { InferenceResult } from "../../../inference/index.js";
import { startSSMSessionSilent } from "../../../session.js";
import type { DryRunResult, RDSInstance } from "../../../types.js";
import { COMMAND_FORMATTING } from "../../../utils/constants.js";

interface Props {
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

type ConnectionState =
  | "confirming"
  | "connecting"
  | "connected"
  | "error"
  | "showingResults";

export const ConnectionEstablisher = ({
  region,
  rdsInstance,
  rdsPort,
  inferenceResult,
  localPort,
  isDryRun,
  onError,
}: Props) => {
  const { exit } = useApp();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("confirming");
  const [reproducibleCommand, setReproducibleCommand] = useState<string>("");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [connectionStartTime, setConnectionStartTime] = useState<Date | null>(
    null,
  );
  const [connectionEndTime, setConnectionEndTime] = useState<Date | null>(null);
  const [awsCommand, setAwsCommand] = useState<string>("");

  // Generate command
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

    // Generate AWS command for display (use echo + pipe for reliable copy-paste)
    const parameters = {
      host: [rdsInstance.endpoint],
      portNumber: [rdsPort],
      localPortNumber: [localPort],
    };
    const parametersJson = JSON.stringify(parameters);
    const { LINE_CONTINUATION } = COMMAND_FORMATTING;
    const awsCmd = `aws ssm start-session${LINE_CONTINUATION}--target ${inferenceResult.task.taskArn}${LINE_CONTINUATION}--parameters '${parametersJson}'${LINE_CONTINUATION}--document-name AWS-StartPortForwardingSessionToRemoteHost`;
    setAwsCommand(awsCmd);
  }, [region, inferenceResult, rdsInstance, rdsPort, localPort]);

  // Connection process
  const handleConnect = useCallback(async () => {
    try {
      setConnectionState("connecting");

      if (isDryRun) {
        // Execute dry run
        const result = generateConnectDryRun(
          region,
          inferenceResult.cluster.clusterName,
          inferenceResult.task.taskArn,
          rdsInstance,
          rdsPort,
          localPort,
        );

        setDryRunResult(result);
        setConnectionState("showingResults");
        // Auto-exit after showing results for dry run
        setTimeout(() => {
          exit();
        }, 100);
      } else {
        // Start actual connection with time tracking
        setConnectionStartTime(new Date());
        await startSSMSessionSilent(
          inferenceResult.task.taskArn,
          rdsInstance,
          rdsPort,
          localPort,
        );
        setConnectionEndTime(new Date());
        setConnectionState("showingResults");
        // Don't call onComplete() immediately - let user see the results
      }
    } catch (error) {
      setConnectionEndTime(new Date());
      setConnectionState("error");
      onError(
        `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }, [
    isDryRun,
    region,
    inferenceResult,
    rdsInstance,
    rdsPort,
    localPort,
    exit,
    onError,
  ]);

  // Auto-start connection when component mounts
  useEffect(() => {
    if (connectionState === "confirming") {
      handleConnect();
    }
  }, [connectionState, handleConnect]);

  // Keyboard input handling
  useInput((input, key) => {
    if (
      connectionState === "connected" ||
      connectionState === "error" ||
      connectionState === "showingResults"
    ) {
      if (key.return || key.escape) {
        exit(); // Just exit without calling onComplete to keep the results visible
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
        Connection Summary:
      </Text>
      <Text>
        Region: <Text color="yellow">{region}</Text>
      </Text>
      <Text>
        RDS: <Text color="yellow">{rdsInstance.dbInstanceIdentifier}</Text>
      </Text>
      <Text>
        RDS Port: <Text color="yellow">{rdsPort}</Text>
      </Text>
      <Text>
        ECS: <Text color="yellow">{inferenceResult.task.serviceName}</Text>
      </Text>
      <Text>
        Cluster:{" "}
        <Text color="yellow">{inferenceResult.cluster.clusterName}</Text>
      </Text>
      <Text>
        Local Port: <Text color="yellow">{localPort}</Text>
      </Text>
      <Text>
        Connection URL: <Text color="green">localhost:{localPort}</Text>
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
        Reproduction Command:
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
            🧪 Dry Run Results
          </Text>
        </Box>

        {/* AWS SSMコマンド */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green" bold>
            AWS Command to Execute:
          </Text>
          <Text wrap="wrap">{dryRunResult.awsCommand}</Text>
        </Box>

        {/* 再実行用コマンド */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color="cyan" bold>
            Reproduction Command:
          </Text>
          <Text wrap="wrap">{dryRunResult.reproducibleCommand}</Text>
        </Box>

        <Text color="green">
          ✅ Dry run was successful. The above command will be executed.
        </Text>
      </Box>
    );
  };

  if (connectionState === "connecting") {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="yellow">
            {isDryRun ? "Running Dry run..." : "Establishing connection..."}
          </Text>
        </Box>

        {renderConnectionSummary()}

        {/* Show commands for actual connection */}
        {!isDryRun && (
          <>
            {/* AWS Command to Execute */}
            <Box flexDirection="column" marginBottom={1}>
              <Text color="green" bold>
                AWS Command to Execute:
              </Text>
              <Text>{awsCommand}</Text>
            </Box>

            {/* Reproduction Command */}
            <Box flexDirection="column" marginBottom={1}>
              <Text color="cyan" bold>
                Reproduction Command:
              </Text>
              <Text wrap="wrap">{reproducibleCommand}</Text>
            </Box>
          </>
        )}

        <Text color="gray">
          {isDryRun
            ? "Running command verification and test..."
            : "Starting SSM session. Please wait..."}
        </Text>
      </Box>
    );
  }

  if (connectionState === "connected" || connectionState === "showingResults") {
    const getConnectionDuration = () => {
      if (!connectionStartTime || !connectionEndTime) return "Unknown";
      const duration =
        connectionEndTime.getTime() - connectionStartTime.getTime();
      const seconds = Math.floor(duration / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      }
      return `${remainingSeconds}s`;
    };

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="green" bold>
            ✅{" "}
            {isDryRun
              ? "Dry run completed"
              : "Connection establishment completed"}
          </Text>
        </Box>

        {isDryRun ? (
          renderDryRunResult()
        ) : (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="green">Process completed successfully</Text>
            {connectionStartTime && connectionEndTime && (
              <Text color="cyan">
                Connection duration: {getConnectionDuration()}
              </Text>
            )}
          </Box>
        )}

        <Text color="gray">Enter/Esc: Exit</Text>
      </Box>
    );
  }

  // エラー状態
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="red" bold>
          ❌ Connection error
        </Text>
      </Box>

      {renderConnectionSummary()}

      <Text color="gray">Enter/Esc: Exit</Text>
    </Box>
  );
};
