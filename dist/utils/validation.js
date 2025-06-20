import chalk from "chalk";
export function displayValidationErrors(issues) {
    console.log(chalk.red("❌ Invalid CLI options:"));
    for (const issue of issues) {
        console.log(chalk.red(`  • ${issue.path?.[0]?.key || "Unknown"}: ${issue.message}`));
    }
}
