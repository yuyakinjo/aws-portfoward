import { safeParse } from "valibot";
import { connectToRDSWithSimpleUI } from "../aws-port-forward.js";
import { ConnectOptionsSchema } from "../types.js";
import {
  displayFriendlyError,
  displayParsingErrors,
  messages,
} from "../utils/index.js";

export async function runConnectCommand(rawOptions: unknown): Promise<void> {
  try {
    // Validate options using Valibot
    const { success, issues, output } = safeParse(
      ConnectOptionsSchema,
      rawOptions,
    );

    if (!success) {
      displayParsingErrors(issues);
      process.exit(1);
    }

    // Always use interactive UI
    await connectToRDSWithSimpleUI(output);
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
