import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { generateExecDryRun } from "../../../core/dry-run.js";
import { executeECSCommand } from "../../../session.js";
import type { DryRunResult } from "../../../types.js";

interface Props {
  region: string;
  cluster: string;
  task: string;
  container: string;
  command: string;
  isDryRun: boolean;
  onBack: () => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export const ExecEstablisher = ({
  region,
  cluster,
  task,
  container,
  command,
  isDryRun,
  onBack,
  onComplete,
  onError,
}: Props) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [completed, setCompleted] = useState(false);

  // Generate dry run result
  useEffect(() => {
    if (isDryRun) {
      const result = generateExecDryRun(
        region,
        cluster,
        task,
        container,
        command,
      );
      setDryRunResult(result);
    }
  }, [region, cluster, task, container, command, isDryRun]);

  // Handle keyboard input
  useInput((input, key) => {
    if (isExecuting) return;

    if (key.return && !completed) {
      if (isDryRun) {
        onComplete();
      } else {
        executeCommand();
      }
    } else if (key.leftArrow && !completed) {
      onBack();
    }
  });

  const executeCommand = async () => {
    try {
      setIsExecuting(true);
      await executeECSCommand(region, cluster, task, container, command);
      setCompleted(true);
      onComplete();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Failed to execute command",
      );
    } finally {
      setIsExecuting(false);
    }
  };

  if (isDryRun && dryRunResult) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Dry Run Result
          </Text>
        </Box>

        <Box marginBottom={1} padding={1} borderStyle="round">
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text color="yellow" bold>
                AWS CLI Command:
              </Text>
            </Box>
            <Box marginBottom={1}>
              <Text color="white">{dryRunResult.awsCommand}</Text>
            </Box>

            <Box marginBottom={1}>
              <Text color="yellow" bold>
                Session Information:
              </Text>
            </Box>
            <Box marginBottom={1}>
              <Text color="white">
                Region: {region} | Cluster: {cluster}
              </Text>
            </Box>
            <Box marginBottom={1}>
              <Text color="white">
                Task: {task} | Container: {container}
              </Text>
            </Box>
            <Box>
              <Text color="white">Command: {command}</Text>
            </Box>
          </Box>
        </Box>

        <Box flexDirection="column">
          <Text color="gray">Enter: Complete ←: Back</Text>
        </Box>
      </Box>
    );
  }

  if (isExecuting) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Executing Command...
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray">
            Starting interactive session with ECS task container...
          </Text>
        </Box>
      </Box>
    );
  }

  if (completed) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="green" bold>
            ✓ Command execution completed successfully!
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Ready to Execute Command
        </Text>
      </Box>

      <Box marginBottom={1} padding={1} borderStyle="round">
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="yellow" bold>
              Execution Details:
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="white">
              Region: {region} | Cluster: {cluster}
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="white">
              Task: {task} | Container: {container}
            </Text>
          </Box>
          <Box>
            <Text color="white">Command: {command}</Text>
          </Box>
        </Box>
      </Box>

      <Box marginBottom={1}>
        <Text color="yellow">
          Press Enter to start interactive session with the container.
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text color="gray">Enter: Execute ←: Back</Text>
      </Box>
    </Box>
  );
};
