import { ECSClient } from "@aws-sdk/client-ecs";
import { Box, Text, useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import { getECSTaskContainers } from "../../../aws-services.js";
import { LoadingSpinner } from "../../../ui/components/index.js";

interface Props {
  region: string;
  cluster: string;
  task: string;
  onSelect: (container: string) => void;
  preselectedContainer?: string;
  onCancel: () => void;
  onBack: () => void;
}

export const ContainerSelector = ({
  region,
  cluster,
  task,
  onSelect,
  preselectedContainer,
  onCancel,
  onBack,
}: Props) => {
  const [containers, setContainers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load containers
  useEffect(() => {
    const loadContainers = async () => {
      try {
        setLoading(true);
        const ecsClient = new ECSClient({ region });
        const containerList = await getECSTaskContainers(
          ecsClient,
          cluster,
          task,
        );
        setContainers(containerList);

        // Auto-select if preset container matches
        if (preselectedContainer) {
          const presetIndex = containerList.findIndex(
            (container) => container === preselectedContainer,
          );
          if (presetIndex >= 0) {
            setSelectedIndex(presetIndex);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load containers",
        );
      } finally {
        setLoading(false);
      }
    };

    loadContainers();
  }, [region, cluster, task, preselectedContainer]);

  // Filter containers based on search term
  const filteredContainers = useMemo(() => {
    if (!searchTerm) return containers;
    return containers.filter((container) =>
      container.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [containers, searchTerm]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filteredContainers.length) {
      setSelectedIndex(Math.max(0, filteredContainers.length - 1));
    }
  }, [filteredContainers.length, selectedIndex]);

  // Handle keyboard input
  useInput((input, key) => {
    if (loading) return;

    if (key.return) {
      if (filteredContainers.length > 0 && filteredContainers[selectedIndex]) {
        onSelect(filteredContainers[selectedIndex]);
      }
    } else if (key.escape) {
      onCancel();
    } else if (key.leftArrow) {
      onBack();
    } else if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredContainers.length - 1,
      );
    } else if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev < filteredContainers.length - 1 ? prev + 1 : 0,
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
          <Text> Loading containers...</Text>
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

  if (containers.length === 0) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="yellow">No containers found in this task</Text>
        </Box>
        <Text color="gray">←/Esc: Back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Select Container
        </Text>
      </Box>

      {searchTerm && (
        <Box marginBottom={1}>
          <Text color="gray">Search: </Text>
          <Text color="yellow">{searchTerm}</Text>
          <Text color="gray"> ({filteredContainers.length} matches)</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {filteredContainers.map((container, index) => (
          <Box key={container}>
            <Text color={index === selectedIndex ? "cyan" : "white"}>
              {index === selectedIndex ? "▶ " : "  "}
              <Text bold={index === selectedIndex}>{container}</Text>
            </Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column">
        <Text color="gray">
          ↑↓: Navigate Enter: Select Type: Search ←: Back Esc: Cancel
        </Text>
      </Box>
    </Box>
  );
};
