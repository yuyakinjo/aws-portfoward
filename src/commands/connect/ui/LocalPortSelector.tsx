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
      } catch (error) {
        // ポート検出に失敗した場合はデフォルト値を使用
        const fallbackPort = defaultPort || "8888";
        setSuggestedPort(fallbackPort);
        setInputPort(fallbackPort);
        setIsLoading(false);
      }
    };

    findPort();
  }, [defaultPort]);

  // ポートバリデーション
  const validatePort = (port: string): string | null => {
    if (!port.trim()) {
      return "ポート番号を入力してください";
    }

    if (!/^\d+$/.test(port)) {
      return "ポート番号は数値で入力してください";
    }

    const portNum = parseInt(port);
    if (portNum < 1 || portNum > 65535) {
      return "ポート番号は1-65535の範囲で入力してください";
    }

    if (portNum < 1024) {
      return "システムポート（1-1023）は使用できません";
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
        <Text color="yellow">利用可能なローカルポートを検索中...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* ヘッダー */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🔌 ローカルポート選択
        </Text>
      </Box>

      {/* 現在の設定 */}
      <Box flexDirection="column" marginBottom={1}>
        <Text>
          現在のポート:{" "}
          <Text color={isEditing ? "yellow" : "green"} bold>
            {inputPort || "(未設定)"}
          </Text>
          {isEditing && <Text color="yellow"> (編集中)</Text>}
        </Text>

        {suggestedPort && suggestedPort !== inputPort && (
          <Text>
            推奨ポート: <Text color="cyan">{suggestedPort}</Text>
            <Text color="gray"> (利用可能確認済み)</Text>
          </Text>
        )}
      </Box>

      {/* バリデーションエラー */}
      {validationError && (
        <Box marginBottom={1}>
          <Text color="red">⚠️ {validationError}</Text>
        </Box>
      )}

      {/* 説明 */}
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">
          このポートでローカルからRDSへの接続を受け付けます。
        </Text>
        <Text color="gray">
          例: mysql -h localhost -P {inputPort || "8888"} -u username -p
        </Text>
      </Box>

      {/* ヘルプ */}
      <Box flexDirection="column">
        {!isEditing ? (
          <>
            <Text color="gray">
              Enter: 決定 E: 編集 S: 推奨ポート使用 ←/Esc: 戻る
            </Text>
            {suggestedPort && suggestedPort !== inputPort && (
              <Text color="cyan">
                💡 推奨ポート {suggestedPort} が利用可能です (Sキーで選択)
              </Text>
            )}
          </>
        ) : (
          <Text color="yellow">
            数字入力: ポート番号 Enter: 確定 Esc: キャンセル
          </Text>
        )}
      </Box>
    </Box>
  );
};
