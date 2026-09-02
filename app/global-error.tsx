import { CliError, Danger, type ErrorProps, Line, Text } from "decopin-cli";
import { displayFriendlyError } from "../src/utils/index.js";

/**
 * 直接投げられた CliError は「分かっている失敗」(引数の誤り、端末が要る、断念) なので
 * 一行で言う。枠組みが包んだ想定外の Error (cause に元が入る) は、これまでどおりの
 * 丁寧な表示 (AWS 側の確認手順つき) に渡す。exit code は枠組みが決める
 */
export default function GlobalError({ error }: ErrorProps) {
  if (error instanceof CliError && error.cause === undefined) {
    return (
      <>
        <Danger>{error.message}</Danger>
        {error.issues.slice(1).map((issue) => (
          <Line key={issue}>
            {"  "}
            {issue}
          </Line>
        ))}
        {error.hints.map((hint) => (
          <Line key={hint}>
            <Text dim>{hint}</Text>
          </Line>
        ))}
      </>
    );
  }
  displayFriendlyError(error.cause ?? error);
  return null;
}
