import { ECSClient } from "@aws-sdk/client-ecs";
import { RDSClient } from "@aws-sdk/client-rds";
import { Box, Text, useInput } from "ink";
import type React from "react";
import { useEffect, useState } from "react";
import { getRDSInstances } from "../../../aws-services.js";
import { searchRDS } from "../../../search.js";
import type { RDSInstance } from "../../../types.js";
import { LoadingSpinner } from "../../../ui/components/index.js";
import { useAsyncState } from "../../../ui/hooks/index.js";
import { getDefaultPortForEngine } from "../../../utils/index.js";

interface RDSSelectorProps {
  region: string;
  onSelect: (rds: RDSInstance, rdsPort: string) => void;
  preselectedRDS?: string;
  onCancel?: () => void;
  onBack?: () => void;
}

export const RDSSelector: React.FC<RDSSelectorProps> = ({
  region,
  onSelect,
  preselectedRDS,
  onCancel,
  onBack,
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rdsInstances, setRdsInstances] = useState<RDSInstance[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<
    Array<{
      name: string;
      value: RDSInstance;
      description?: string;
    }>
  >([]);

  const [rdsState, loadRDS] = useAsyncState<RDSInstance[]>();

  // Load RDS instances on mount
  useEffect(() => {
    console.log(`[RDSSelector] RDS取得開始: region=${region}`);
    const rdsClient = new RDSClient({ region });
    loadRDS(async () => {
      try {
        console.log(`[RDSSelector] getRDSInstances呼び出し`);
        const instances = await getRDSInstances(rdsClient);
        console.log(`[RDSSelector] RDS取得完了: ${instances.length}件`);
        return instances;
      } catch (error) {
        console.error(`[RDSSelector] RDS取得エラー:`, error);
        throw error;
      }
    });
  }, [region, loadRDS]);

  // Handle preselected RDS
  useEffect(() => {
    if (preselectedRDS && rdsInstances.length > 0) {
      const foundRDS = rdsInstances.find(
        (r) => r.dbInstanceIdentifier === preselectedRDS,
      );
      if (foundRDS) {
        const actualPort = foundRDS.port;
        const fallbackPort = getDefaultPortForEngine(foundRDS.engine);
        const rdsPort = `${actualPort || fallbackPort}`;
        onSelect(foundRDS, rdsPort);
        return;
      } else {
        // Preselected RDS not found, show error but continue with selection
        console.error(`RDS instance not found: ${preselectedRDS}`);
      }
    }
  }, [preselectedRDS, rdsInstances, onSelect]);

  // Update RDS instances when loaded
  useEffect(() => {
    if (rdsState.data) {
      setRdsInstances(rdsState.data);
    }
  }, [rdsState.data]);

  // Update filtered options when RDS instances or search input changes
  useEffect(() => {
    if (rdsInstances.length === 0) return;

    const updateOptions = async () => {
      const searchResults = await searchRDS(rdsInstances, searchInput);
      const options = searchResults.map((result) => ({
        name: result.name,
        value: result.value,
        description: result.description,
      }));
      setFilteredOptions(options);
      setSelectedIndex(0); // Reset selection when options change
    };

    updateOptions();
  }, [rdsInstances, searchInput]);

  // Handle keyboard input
  useInput((input, key) => {
    if (rdsState.loading || filteredOptions.length === 0) return;

    if (key.return) {
      // Enter: select current option
      const selected = filteredOptions[selectedIndex];
      if (selected) {
        const rdsInstance = selected.value;
        const actualPort = rdsInstance.port;
        const fallbackPort = getDefaultPortForEngine(rdsInstance.engine);
        const rdsPort = `${actualPort || fallbackPort}`;
        onSelect(rdsInstance, rdsPort);
      }
    } else if (key.escape) {
      // Escape: cancel
      onCancel?.();
    } else if (key.leftArrow && onBack) {
      // Left arrow: go back to previous step
      onBack();
    } else if (key.upArrow) {
      // Up arrow: move selection up
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1,
      );
    } else if (key.downArrow) {
      // Down arrow: move selection down
      setSelectedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0,
      );
    } else if (key.backspace || key.delete) {
      // Backspace: remove last character
      setSearchInput((prev) => prev.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      // Regular character: add to search
      setSearchInput((prev) => prev + input);
    }
  });

  if (rdsState.loading) {
    return <LoadingSpinner text="Getting RDS instances..." />;
  }

  if (rdsState.error) {
    return (
      <Box flexDirection="column">
        <Text color="red">
          Error loading RDS instances: {rdsState.error.message}
        </Text>
        <Text color="gray">Press Escape to cancel, ← to go back</Text>
      </Box>
    );
  }

  if (rdsInstances.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No RDS instances found in region: {region}</Text>
        <Text color="gray">Press Escape to cancel, ← to go back</Text>
      </Box>
    );
  }

  if (filteredOptions.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No RDS instances match your search</Text>
        <Text color="gray">
          Clear search or press Escape to cancel, ← to go back
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Search and select RDS instance:
      </Text>

      <Box marginTop={1}>
        <Text color="gray">Search: </Text>
        <Text color="white">{searchInput}</Text>
        <Text color="gray">█</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {filteredOptions.slice(0, 10).map((option, index) => {
          const isSelected = index === selectedIndex;
          const prefix = isSelected ? "❯ " : "  ";
          const color = isSelected ? "cyan" : "white";

          const rdsInstance = option.value;
          const actualPort = rdsInstance.port;
          const fallbackPort = getDefaultPortForEngine(rdsInstance.engine);
          const portInfo = actualPort
            ? `port: ${actualPort}`
            : `default port: ${fallbackPort}`;

          return (
            <Box key={rdsInstance.dbInstanceIdentifier} flexDirection="column">
              <Box>
                <Text color={color}>
                  {prefix}
                  {option.name}
                </Text>
              </Box>
              {isSelected && (
                <Box marginLeft={4}>
                  <Text color="gray">
                    Engine: {rdsInstance.engine} | {portInfo}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          Use ↑↓ to navigate, Enter to select, ← to go back, Escape to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default RDSSelector;
