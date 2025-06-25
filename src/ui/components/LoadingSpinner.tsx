import { Box, Text } from "ink";
import Spinner from "ink-spinner";

interface Props {
  text?: string;
  type?: "dots" | "line" | "pipe" | "simpleDots";
}

export const LoadingSpinner = ({
  text = "Loading...",
  type = "dots",
}: Props) => {
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
