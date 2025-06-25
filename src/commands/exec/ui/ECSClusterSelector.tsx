import { ECSClient } from "@aws-sdk/client-ecs";
import { Box, Text, useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import { getECSClustersWithExecCapability } from "../../../aws-services.js";
import type { ECSCluster } from "../../../types.js";
import { LoadingSpinner } from "../../../ui/components/index.js";

interface Props {
  region: string;
  onSelect: (cluster: string) => void;
  preselectedCluster?: string;
  onCancel: () => void;
  onBack: () => void;
}

export const ECSClusterSelector = ({
  region,
  onSelect,
  preselectedCluster,
  onCancel,
  onBack,
}: Props) => {
  const [clusters, setClusters] = useState<ECSCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load clusters
  useEffect(() => {
    const loadClusters = async () => {
      try {
        setLoading(true);
        const ecsClient = new ECSClient({ region });
        const clusterList = await getECSClustersWithExecCapability(ecsClient);
        setClusters(clusterList);

        // Auto-select if preset cluster matches
        if (preselectedCluster) {
          const presetIndex = clusterList.findIndex(
            (cluster) => cluster.clusterName === preselectedCluster,
          );
          if (presetIndex >= 0) {
            setSelectedIndex(presetIndex);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load clusters",
        );
      } finally {
        setLoading(false);
      }
    };

    loadClusters();
  }, [region, preselectedCluster]);

  // Filter clusters based on search term
  const filteredClusters = useMemo(() => {
    if (!searchTerm) return clusters;
    return clusters.filter((cluster) =>
      cluster.clusterName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [clusters, searchTerm]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filteredClusters.length) {
      setSelectedIndex(Math.max(0, filteredClusters.length - 1));
    }
  }, [filteredClusters.length, selectedIndex]);

  // Handle keyboard input
  useInput((input, key) => {
    if (loading) return;

    if (key.return) {
      if (filteredClusters.length > 0 && filteredClusters[selectedIndex]) {
        onSelect(filteredClusters[selectedIndex].clusterName);
      }
    } else if (key.escape) {
      onCancel();
    } else if (key.leftArrow) {
      onBack();
    } else if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredClusters.length - 1,
      );
    } else if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev < filteredClusters.length - 1 ? prev + 1 : 0,
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
          <Text> Loading ECS clusters...</Text>
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

  if (clusters.length === 0) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="yellow">No ECS clusters found with exec capability</Text>
        </Box>
        <Text color="gray">←/Esc: Back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Select ECS Cluster
        </Text>
      </Box>

      {searchTerm && (
        <Box marginBottom={1}>
          <Text color="gray">Search: </Text>
          <Text color="yellow">{searchTerm}</Text>
          <Text color="gray"> ({filteredClusters.length} matches)</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {filteredClusters.slice(0, 10).map((cluster, index) => (
          <Box key={cluster.clusterName}>
            <Text color={index === selectedIndex ? "cyan" : "white"}>
              {index === selectedIndex ? "▶ " : "  "}
              <Text bold={index === selectedIndex}>{cluster.clusterName}</Text>
            </Text>
          </Box>
        ))}
      </Box>

      {filteredClusters.length > 10 && (
        <Box marginBottom={1}>
          <Text color="gray">
            ... and {filteredClusters.length - 10} more. Type to filter.
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
