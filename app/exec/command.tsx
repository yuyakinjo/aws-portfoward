import type { CommandProps } from "decopin-cli";
import { safeParse } from "valibot";
import { execECSTaskWithSimpleUI } from "../../src/aws-exec.js";
import { ExecOptionsSchema } from "../../src/types.js";
import { displayParsingErrors } from "../../src/utils/index.js";

export default async function Command({
  options,
  dryRun,
}: CommandProps<"exec">) {
  const parsed = safeParse(ExecOptionsSchema, { ...options, dryRun });
  if (!parsed.success) {
    displayParsingErrors(parsed.issues);
    throw new Error("Invalid options");
  }
  await execECSTaskWithSimpleUI(parsed.output);
  return null;
}
