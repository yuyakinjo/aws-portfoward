import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { findAvailablePort } from "../../../utils/validation.js";

interface Props {
  defaultPort?: string;
  onSelect: (port: string) => void;
  onBack: () => void;
  onError: (error: string) => void;
}

export const LocalPortSelector = ({ defaultPort, onSelect, onBack }: Props) => {
  const [isLoading, setIsLoading] = useState(true);
  const [suggestedPort, setSuggestedPort] = useState<string>("");
  const [inputPort, setInputPort] = useState(defaultPort || "");
  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string>("");

  // 利用可能ポートの自動検出
  useEffect(() => {
    const findPort = async () => {
      try {
        setIsLoading(true);
        const startPort = defaultPort ? parseInt(defaultPort) : 8888;
        const availablePort = await findAvailablePort(startPort);
        setSuggestedPort(availablePort.toString());

        if (!defaultPort) {
          setInputPort(availablePort.toString());
        }

        setIsLoading(false);

        // 8888が空いていれば自動的に決定
        if (!defaultPort && availablePort === 8888) {
          setTimeout(() => {
            onSelect(availablePort.toString());
          }, 100); // 少し遅延させてUIの表示を確認できるように
        }
      } catch {
        // ポート検出に失敗した場合はデフォルト値を使用
        const fallbackPort = defaultPort || "8888";
        setSuggestedPort(fallbackPort);
        setInputPort(fallbackPort);
        setIsLoading(false);
      }
    };

    findPort();
  }, [defaultPort, onSelect]);

  // ポートバリデーション
  const validatePort = (port: string): string | null => {
    if (!port.trim()) {
      return "Please enter a port number";
    }

    if (!/^\d+$/.test(port)) {
      return "Port number must be numeric";
    }

    const portNum = parseInt(port);
    if (portNum < 1 || portNum > 65535) {
      return "Port number must be between 1-65535";
    }

    if (portNum < 1024) {
      return "System ports (1-1023) cannot be used";
    }

    return null;
  };

  // キーボード入力処理
  useInput((input, key) => {
    if (isLoading) return;

    if (!isEditing) {
      // 選択モード
      if (key.return) {
        const error = validatePort(inputPort);
        if (error) {
          setValidationError(error);
          return;
        }
        onSelect(inputPort);
      } else if (input === "e" || input === "E") {
        setIsEditing(true);
        setValidationError("");
      } else if (input === "s" || input === "S") {
        if (suggestedPort) {
          setInputPort(suggestedPort);
          setValidationError("");
        }
      } else if (key.escape || key.leftArrow) {
        onBack();
      }
    } else {
      // 編集モード
      if (key.return) {
        const error = validatePort(inputPort);
        if (error) {
          setValidationError(error);
        } else {
          setIsEditing(false);
          setValidationError("");
        }
      } else if (key.escape) {
        setIsEditing(false);
        setValidationError("");
      } else if (key.backspace || key.delete) {
        setInputPort((prev) => prev.slice(0, -1));
        setValidationError("");
      } else if (input && /\d/.test(input)) {
        const newPort = inputPort + input;
        if (newPort.length <= 5) {
          // 最大5桁
          setInputPort(newPort);
          setValidationError("");
        }
      }
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">Searching for available local ports...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🔌 Select Local Port
        </Text>
      </Box>

      {/* Current settings */}
      <Box flexDirection="column" marginBottom={1}>
        <Text>
          Current port:{" "}
          <Text color={isEditing ? "yellow" : "green"} bold>
            {inputPort || "(not set)"}
          </Text>
          {isEditing && <Text color="yellow"> (editing)</Text>}
        </Text>

        {suggestedPort && suggestedPort !== inputPort && (
          <Text>
            Recommended port: <Text color="cyan">{suggestedPort}</Text>
            <Text color="gray"> (confirmed available)</Text>
          </Text>
        )}
      </Box>

      {/* Validation error */}
      {validationError && (
        <Box marginBottom={1}>
          <Text color="red">⚠️ {validationError}</Text>
        </Box>
      )}

      {/* Description */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">
          This port will accept local connections to RDS.
        </Text>
        <Text color="gray">
          Example: mysql -h localhost -P {inputPort || "8888"} -u username -p
        </Text>
      </Box>

      {/* Help */}
      <Box flexDirection="column">
        {!isEditing ? (
          <>
            <Text color="gray">
              Enter: Confirm E: Edit S: Use Recommended ←/Esc: Back
            </Text>
            {suggestedPort && suggestedPort !== inputPort && (
              <Text color="cyan">
                💡 Recommended port {suggestedPort} is available (Press S to
                select)
              </Text>
            )}
          </>
        ) : (
          <Text color="yellow">
            Type numbers: Port number Enter: Confirm Esc: Cancel
          </Text>
        )}
      </Box>
    </Box>
  );
};
