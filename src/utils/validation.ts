import chalk from "chalk";
import type * as v from "valibot";
import type { ConnectOptionsSchema } from "../types.js";

/**
 * Display validation errors in a user-friendly format
 */
export function displayValidationErrors(
	issues: v.InferIssue<typeof ConnectOptionsSchema>[],
): void {
	console.log(chalk.red("❌ Invalid CLI options:"));
	for (const issue of issues) {
		console.log(
			chalk.red(`  • ${issue.path?.[0]?.key || "Unknown"}: ${issue.message}`),
		);
	}
}
