import { messages } from "./messages.js";
export function displayValidationErrors(issues) {
    messages.error("❌ Invalid CLI options:");
    for (const issue of issues) {
        messages.error(`  • ${issue.path?.[0]?.key || "Unknown"}: ${issue.message}`);
    }
}
