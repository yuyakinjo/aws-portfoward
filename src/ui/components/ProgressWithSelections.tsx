import { Box, Text } from "ink";

export interface StepInfo {
  id: string;
  title: string;
  completed: boolean;
  current: boolean;
  value?: string; // 選択された値
}

interface Props {
  steps: StepInfo[];
}

export const ProgressWithSelections = ({ steps }: Props) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" bold>
        Progress
      </Text>
      {steps.map((step) => {
        const getStatusIcon = () => {
          if (step.completed) return "✓";
          if (step.current) return "◯";
          return "○";
        };

        const getStatusColor = () => {
          if (step.completed) return "green";
          if (step.current) return "yellow";
          return "gray";
        };

        const displayValue = step.value || "(not selected)";
        const valueColor = step.value ? "yellow" : "gray";

        return (
          <Box key={step.id} marginLeft={2}>
            <Text color={getStatusColor()}>
              {getStatusIcon()} {step.title}:
            </Text>
            <Box marginLeft={1}>
              <Text color={valueColor}>{displayValue}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
