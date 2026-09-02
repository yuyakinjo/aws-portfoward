import type { CommandProps } from "decopin-cli";
import { safeParse } from "valibot";
import { connectToRDSWithSimpleUI } from "../../src/aws-port-forward.js";
import { ConnectOptionsSchema } from "../../src/types.js";
import { displayParsingErrors } from "../../src/utils/index.js";

/**
 * argv.tsx が形を検証し、ここでは既存の valibot スキーマで branded 型に直す。
 * 対話フロー (core/) は自分で描画するので、この command は何も返さない
 */
export default async function Command({
  options,
  dryRun,
}: CommandProps<"connect">) {
  const parsed = safeParse(ConnectOptionsSchema, {
    region: options.region,
    cluster: options.cluster,
    task: options.task,
    rds: options.rds,
    rdsPort: options["rds-port"],
    localPort: options["local-port"],
    dryRun,
  });
  if (!parsed.success) {
    displayParsingErrors(parsed.issues);
    throw new Error("Invalid options");
  }
  await connectToRDSWithSimpleUI(parsed.output);
  return null;
}
