import { safeParse } from "valibot";
import { execECSTaskWithSimpleUI } from "../aws-exec.js";
import { ExecOptionsSchema } from "../types.js";
import {
  displayFriendlyError,
  displayParsingErrors,
  messages,
} from "../utils/index.js";

export async function runExecTaskCommand(rawOptions: unknown): Promise<void> {
  try {
    // Validate options using Valibot
    const { success, issues, output } = safeParse(
      ExecOptionsSchema,
      rawOptions,
    );

    if (!success) {
      displayParsingErrors(issues);
      process.exit(1);
    }

    // Always use interactive UI
    await execECSTaskWithSimpleUI(output);
  } catch (error) {
    // If error occurs during retry process, error is already displayed, so show brief message
    if (
      error instanceof Error &&
      error.message.includes("maximum retry count")
    ) {
      messages.error("Terminating process");
    } else {
      // For unexpected errors, display detailed error screen
      displayFriendlyError(error);
    }
    process.exit(1);
  }
}
