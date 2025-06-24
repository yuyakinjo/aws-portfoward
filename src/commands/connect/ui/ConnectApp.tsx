import { Box, Text } from "ink";
import type React from "react";
import {
  LoadingSpinner,
  ProgressSteps,
  SelectionSummary,
} from "../../../ui/components/index.js";
import { useSelection } from "../../../ui/hooks/index.js";
import type { StepInfo } from "../../../ui/types.js";

interface ConnectAppProps {
  dryRun?: boolean;
}

export const ConnectApp: React.FC<ConnectAppProps> = ({ dryRun = false }) => {
  const { selections } = useSelection();

  const steps: StepInfo[] = [
    {
      id: "region",
      title: "Select AWS Region",
      completed: false,
      current: true,
    },
    {
      id: "rds",
      title: "Select RDS Instance",
      completed: false,
      current: false,
    },
    { id: "ecs", title: "Select ECS Target", completed: false, current: false },
    {
      id: "connect",
      title: "Establish Connection",
      completed: false,
      current: false,
    },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          AWS Port Forward v3.0.0 {dryRun && "(DRY RUN)"}
        </Text>
      </Box>

      <ProgressSteps steps={steps} />

      <SelectionSummary selections={selections} showEmpty />

      <Box marginTop={1}>
        <LoadingSpinner text="Initializing AWS clients..." />
      </Box>
    </Box>
  );
};

export default ConnectApp;
