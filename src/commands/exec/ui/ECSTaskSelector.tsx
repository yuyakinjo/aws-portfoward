import { ECSClient } from "@aws-sdk/client-ecs";
import { Box, Text, useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import { getECSTasksWithExecCapability } from "../../../aws-services.js";
import type { ECSCluster, ECSTask } from "../../../types.js";
import { LoadingSpinner } from "../../../ui/components/index.js";

interface Props {
  region: string;
  cluster: string;
  onSelect: (task: string) => void;
  preselectedTask?: string;
  onCancel: () => void;
  onBack: () => void;
}

export const ECSTaskSelector = ({
  region,
  cluster,
  onSelect,
  preselectedTask,
  onCancel,
  onBack,
}: Props) => {
  const [tasks, setTasks] = useState<ECSTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        const ecsClient = new ECSClient({ region });
        const clusterObj: ECSCluster = { clusterName: cluster, clusterArn: "" };
        const taskList = await getECSTasksWithExecCapability(
          ecsClient,
          clusterObj,
        );
        setTasks(taskList);

        // Auto-select if preset task matches
        if (preselectedTask) {
          const presetIndex = taskList.findIndex(
            (task) =>
              task.taskId === preselectedTask ||
              task.taskArn === preselectedTask,
          );
          if (presetIndex >= 0) {
            setSelectedIndex(presetIndex);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [region, cluster, preselectedTask]);

  // Filter tasks based on search term
  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    return tasks.filter(
      (task) =>
        task.taskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.taskArn &&
          task.taskArn.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [tasks, searchTerm]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filteredTasks.length) {
      setSelectedIndex(Math.max(0, filteredTasks.length - 1));
    }
  }, [filteredTasks.length, selectedIndex]);

  // Handle keyboard input
  useInput((input, key) => {
    if (loading) return;

    if (key.return) {
      if (filteredTasks.length > 0 && filteredTasks[selectedIndex]) {
        onSelect(filteredTasks[selectedIndex].taskId);
      }
    } else if (key.escape) {
      onCancel();
    } else if (key.leftArrow) {
      onBack();
    } else if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredTasks.length - 1,
      );
    } else if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev < filteredTasks.length - 1 ? prev + 1 : 0,
      );
    } else if (key.backspace || key.delete) {
      setSearchTerm((prev) => prev.slice(0, -1));
    } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
      setSearchTerm((prev) => prev + input);
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <LoadingSpinner />
          <Text> Loading ECS tasks...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
        <Text color="gray">←/Esc: Back</Text>
      </Box>
    );
  }

  if (tasks.length === 0) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="yellow">No ECS tasks found with exec capability</Text>
        </Box>
        <Text color="gray">←/Esc: Back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Select ECS Task
        </Text>
      </Box>

      {searchTerm && (
        <Box marginBottom={1}>
          <Text color="gray">Search: </Text>
          <Text color="yellow">{searchTerm}</Text>
          <Text color="gray"> ({filteredTasks.length} matches)</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {filteredTasks.slice(0, 10).map((task, index) => (
          <Box key={task.taskId}>
            <Text color={index === selectedIndex ? "cyan" : "white"}>
              {index === selectedIndex ? "▶ " : "  "}
              <Text bold={index === selectedIndex}>{task.taskId}</Text>
              {task.taskStatus && task.taskStatus !== "RUNNING" && (
                <Text color="gray"> ({task.taskStatus})</Text>
              )}
            </Text>
          </Box>
        ))}
      </Box>

      {filteredTasks.length > 10 && (
        <Box marginBottom={1}>
          <Text color="gray">
            ... and {filteredTasks.length - 10} more. Type to filter.
          </Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text color="gray">
          ↑↓: Navigate Enter: Select Type: Search ←: Back Esc: Cancel
        </Text>
      </Box>
    </Box>
  );
};
