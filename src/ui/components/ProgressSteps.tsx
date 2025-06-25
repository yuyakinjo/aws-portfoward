import { Box, Text } from "ink";
import type { StepInfo } from "../types.js";

interface Props {
  steps: StepInfo[];
}

export const ProgressSteps = ({ steps }: Props) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        Progress
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        {steps.map((step) => {
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
