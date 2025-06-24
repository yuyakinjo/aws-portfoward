import { Box, Text } from "ink";
import type React from "react";
import type { SelectionState } from "../types.js";

interface SelectionSummaryProps {
  selections: SelectionState;
  showEmpty?: boolean;
}

export const SelectionSummary: React.FC<SelectionSummaryProps> = ({
  selections,
  showEmpty = false,
}) => {
  const items = [
    { label: "Region", value: selections.region },
    { label: "RDS Instance", value: selections.rds },
    { label: "RDS Port", value: selections.rdsPort },
    { label: "ECS Cluster", value: selections.ecsCluster },
    { label: "ECS Target", value: selections.ecsTarget },
    { label: "Local Port", value: selections.localPort },
  ].filter((item) => showEmpty || item.value);

  if (items.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        Current Selections
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        {items.map((item) => (
          <Box key={item.label}>
            <Text color="gray">{item.label}: </Text>
            <Text color={item.value ? "white" : "gray"}>
              {item.value || "(not selected)"}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default SelectionSummary;
