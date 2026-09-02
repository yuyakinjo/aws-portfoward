import { Danger, type ErrorProps, Line, Text } from "decopin-cli";
import { displayFriendlyError } from "../src/utils/index.js";

/**
 * 使い方の誤り (引数の検証・端末が要る場面) は一行で言う。それ以外の想定外の
 * 失敗は、これまでどおりの丁寧な表示 (AWS 側の確認手順つき) に渡す。
 * exit code は枠組みが決める (使い方の誤りは 2、実行時の失敗は 1)
 */
export default function GlobalError({ error }: ErrorProps) {
  if (error.kind === "validation" || error.kind === "usage") {
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
  displayFriendlyError(error);
  return null;
}
