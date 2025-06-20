import type * as v from "valibot";
import type { ConnectOptionsSchema } from "../types.js";
import { messages } from "./messages.js";

/**
 * Display validation errors in a user-friendly format
 */
export function displayValidationErrors(
	issues: v.InferIssue<typeof ConnectOptionsSchema>[],
): void {
	messages.error("❌ Invalid CLI options:");
	for (const issue of issues) {
		messages.error(
			`  • ${issue.path?.[0]?.key || "Unknown"}: ${issue.message}`,
		);
	}
}
