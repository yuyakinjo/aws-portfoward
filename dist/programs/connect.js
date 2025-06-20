import { safeParse } from "valibot";
import { connectToRDS } from "../aws-port-forward.js";
import { ConnectOptionsSchema } from "../types.js";
import { displayFriendlyError, displayValidationErrors, messages, } from "../utils/index.js";
export function registerConnectCommand(program) {
    program
        .command("connect")
        .description("Connect to RDS via ECS")
        .option("-r, --region <region>", "AWS region")
        .option("-c, --cluster <cluster>", "ECS cluster name")
        .option("-t, --task <task>", "ECS task ID")
        .option("--rds <rds>", "RDS instance identifier")
        .option("--rds-port <port>", "RDS port number")
        .option("-p, --local-port <port>", "Local port number")
        .action(async (rawOptions) => {
        try {
            const { success, issues, output } = safeParse(ConnectOptionsSchema, rawOptions);
            if (!success) {
                displayValidationErrors(issues);
                process.exit(1);
            }
            messages.info("🚀 Starting AWS ECS RDS connection tool...");
            await connectToRDS(output);
            messages.success("✅ Process completed successfully");
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes("maximum retry count")) {
                messages.error("🚫 Terminating process");
            }
            else {
                displayFriendlyError(error);
            }
            process.exit(1);
        }
    });
}
