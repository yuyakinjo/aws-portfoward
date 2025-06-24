import { Box, Text } from "ink";
import type React from "react";
import type { StepInfo } from "../types.js";

interface ProgressStepsProps {
  steps: StepInfo[];
}

export const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        Progress
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        {steps.map((step, index) => {
          const symbol = step.completed ? "✓" : step.current ? "◯" : "○";
          const color = step.completed
            ? "green"
            : step.current
              ? "yellow"
              : "gray";

          return (
            <Box key={step.id}>
              <Text color={color}>{symbol} </Text>
              <Text color={step.current ? "white" : "gray"}>{step.title}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ProgressSteps;
