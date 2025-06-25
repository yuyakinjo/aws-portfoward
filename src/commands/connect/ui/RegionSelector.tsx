import { EC2Client } from "@aws-sdk/client-ec2";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { getAWSRegions } from "../../../aws-services.js";
import { LoadingSpinner } from "../../../ui/components/index.js";

interface Props {
  onSelect: (region: string) => void;
  preselectedRegion?: string;
  onCancel: () => void;
}

const RegionSelector = ({ onSelect, preselectedRegion, onCancel }: Props) => {
  const [regions, setRegions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 地域データの読み込み
  useEffect(() => {
    const loadRegions = async () => {
      try {
        setIsLoading(true);
        const defaultEc2Client = new EC2Client({ region: "us-east-1" });
        const regionData = await getAWSRegions(defaultEc2Client);
        const regionList = regionData.map((r) => r.regionName);
        setRegions(regionList);

        // プリセット地域がある場合、そのインデックスを設定
        if (preselectedRegion) {
          const presetIndex = regionList.indexOf(preselectedRegion);
          if (presetIndex !== -1) {
            setSelectedIndex(presetIndex);
          }
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsLoading(false);
      }
    };

    loadRegions();
  }, [preselectedRegion]);

  // 検索結果のフィルタリング
  const filteredRegions = regions.filter((region) =>
    region.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // キーボード入力処理
  useInput((input, key) => {
    if (isLoading) return;

    if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredRegions.length - 1,
      );
    } else if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev < filteredRegions.length - 1 ? prev + 1 : 0,
      );
    } else if (key.return) {
      if (filteredRegions[selectedIndex]) {
        onSelect(filteredRegions[selectedIndex]);
      }
    } else if (key.escape) {
      onCancel();
    } else if (key.backspace || key.delete) {
      setSearchQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
    } else if (input && input.length === 1) {
      setSearchQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">Loading AWS regions...</Text>
        <LoadingSpinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Error loading regions: {error}</Text>
        <Text color="gray">Press Esc to cancel</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🌍 Select AWS Region ({filteredRegions.length}/{regions.length})
        </Text>
      </Box>

      {/* Search status */}
      {searchQuery && (
        <Box marginBottom={1}>
          <Text color="gray">
            Search: <Text color="yellow">"{searchQuery}"</Text>
          </Text>
        </Box>
      )}

      {/* Region list */}
      {filteredRegions.length === 0 ? (
        <Box marginBottom={1}>
          <Text color="red">No regions found matching "{searchQuery}"</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {filteredRegions.slice(0, 10).map((region, index) => (
            <Text
              key={region}
              color={index === selectedIndex ? "cyan" : "white"}
              bold={index === selectedIndex}
            >
              {index === selectedIndex ? "▶ " : "  "}
              {region}
            </Text>
          ))}
          {filteredRegions.length > 10 && (
            <Text color="gray">... and {filteredRegions.length - 10} more</Text>
          )}
        </Box>
      )}

      {/* Help */}
      <Box flexDirection="column">
        <Text color="gray">
          ↑↓: Navigate Enter: Select Esc: Cancel Type: Search Backspace: Clear
        </Text>
      </Box>
    </Box>
  );
};

export default RegionSelector;
