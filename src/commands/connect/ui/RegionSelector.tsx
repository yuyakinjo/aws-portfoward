import { EC2Client } from "@aws-sdk/client-ec2";
import { Box, Text, useInput } from "ink";
import type React from "react";
import { useEffect, useState } from "react";
import { getAWSRegions } from "../../../aws-services.js";
import { searchRegions } from "../../../search.js";
import type { AWSRegion } from "../../../types.js";
import { LoadingSpinner } from "../../../ui/components/index.js";
import { useAsyncState } from "../../../ui/hooks/index.js";

interface RegionSelectorProps {
  onSelect: (region: string) => void;
  preselectedRegion?: string;
  onCancel?: () => void;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  onSelect,
  preselectedRegion,
  onCancel,
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [regions, setRegions] = useState<AWSRegion[]>([]);
  const [filteredOptions, setFilteredOptions] = useState<
    Array<{
      name: string;
      value: string;
      description?: string;
    }>
  >([]);

  const [regionsState, loadRegions] = useAsyncState<AWSRegion[]>();

  // Load regions on mount
  useEffect(() => {
    if (preselectedRegion) {
      onSelect(preselectedRegion);
      return;
    }

    const defaultEc2Client = new EC2Client({ region: "us-east-1" });
    loadRegions(() => getAWSRegions(defaultEc2Client));
  }, [preselectedRegion, onSelect, loadRegions]);

  // Update regions when loaded
  useEffect(() => {
    if (regionsState.data) {
      setRegions(regionsState.data);
    }
  }, [regionsState.data]);

  // Update filtered options when regions or search input changes
  useEffect(() => {
    if (regions.length === 0) return;

    const updateOptions = async () => {
      const searchResults = await searchRegions(regions, searchInput);
      const options = searchResults.map((result) => ({
        name: result.name,
        value: result.value,
        description: result.description,
      }));
      setFilteredOptions(options);
      setSelectedIndex(0); // Reset selection when options change
    };

    updateOptions();
  }, [regions, searchInput]);

  // Handle keyboard input
  useInput((input, key) => {
    if (regionsState.loading || filteredOptions.length === 0) return;

    if (key.return) {
      // Enter: select current option
      const selected = filteredOptions[selectedIndex];
      if (selected) {
        onSelect(selected.value);
      }
    } else if (key.escape) {
      // Escape: cancel
      onCancel?.();
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

  if (regionsState.loading) {
    return <LoadingSpinner text="Getting available AWS regions..." />;
  }

  if (regionsState.error) {
    return (
      <Box flexDirection="column">
        <Text color="red">
          Error loading regions: {regionsState.error.message}
        </Text>
        <Text color="gray">Press Escape to cancel</Text>
      </Box>
    );
  }

  if (filteredOptions.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No regions found</Text>
        <Text color="gray">Press Escape to cancel</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Search and select AWS region:
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

          return (
            <Box key={option.value}>
              <Text color={color}>
                {prefix}
                {option.name}
              </Text>
              {option.description && (
                <Text color="gray"> - {option.description}</Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          Use ↑↓ to navigate, Enter to select, Escape to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default RegionSelector;
