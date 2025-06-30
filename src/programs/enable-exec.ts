import { safeParse } from "valibot";
import { enableECSExec } from "../aws-enable-exec.js";
import { EnableExecOptionsSchema } from "../types.js";
import { displayFriendlyError, messages } from "../utils/index.js";

/**
 * Run enable-exec command
 */
export async function runEnableExecCommand(rawOptions: unknown): Promise<void> {
  try {
    // Parse and validate options
    const parseResult = safeParse(EnableExecOptionsSchema, rawOptions);

    if (!parseResult.success) {
      messages.error("Invalid options provided");
      for (const issue of parseResult.issues) {
        messages.error(
          `  ${issue.path?.join(".") || "root"}: ${issue.message}`,
        );
      }
      throw new Error("Invalid command options");
    }

    const options = parseResult.output;

    // Execute enable-exec command
    await enableECSExec(options);
  } catch (error) {
    displayFriendlyError(error);
    process.exit(1);
  }
}
