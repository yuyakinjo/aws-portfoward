import type { CommandProps } from "decopin-cli";
import { safeParse } from "valibot";
import { enableECSExec } from "../../src/aws-enable-exec.js";
import { EnableExecOptionsSchema } from "../../src/types.js";
import { displayParsingErrors } from "../../src/utils/index.js";

export default async function Command({
  options,
  dryRun,
}: CommandProps<"enable-exec">) {
  const parsed = safeParse(EnableExecOptionsSchema, { ...options, dryRun });
  if (!parsed.success) {
    displayParsingErrors(parsed.issues);
    throw new Error("Invalid options");
  }
  await enableECSExec(parsed.output);
  return null;
}
