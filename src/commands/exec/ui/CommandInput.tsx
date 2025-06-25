import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface Props {
  defaultCommand?: string;
  onSelect: (command: string) => void;
  onCancel: () => void;
  onBack: () => void;
}

export const CommandInput = ({
  defaultCommand,
  onSelect,
  onCancel,
  onBack,
}: Props) => {
  const [command, setCommand] = useState(defaultCommand || "/bin/bash");

  // Handle keyboard input
  useInput((input, key) => {
    if (key.return) {
      onSelect(command);
    } else if (key.escape) {
      onCancel();
    } else if (key.leftArrow) {
      onBack();
    } else if (key.backspace || key.delete) {
      setCommand((prev) => prev.slice(0, -1));
    } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
      setCommand((prev) => prev + input);
    } else if (key.ctrl && input === "u") {
      // Clear entire command with Ctrl+U
      setCommand("");
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Enter Command to Execute
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Command: </Text>
        <Text color="yellow">{command}</Text>
        <Text color="cyan">█</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Default: /bin/bash (interactive shell)</Text>
        <Text color="gray">Examples: /bin/sh, ls -la, cat /etc/hosts</Text>
      </Box>

      <Box flexDirection="column">
        <Text color="gray">
          Type: Edit command Enter: Confirm Ctrl+U: Clear ←: Back Esc: Cancel
        </Text>
      </Box>
    </Box>
  );
};
