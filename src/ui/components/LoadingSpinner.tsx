import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type React from "react";

interface LoadingSpinnerProps {
  text?: string;
  type?: "dots" | "line" | "pipe" | "simpleDots";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text = "Loading...",
  type = "dots",
}) => {
  return (
    <Box>
      <Box marginRight={1}>
        <Spinner type={type} />
      </Box>
      <Text color="yellow">{text}</Text>
    </Box>
  );
};

export default LoadingSpinner;
