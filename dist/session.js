import { spawn } from "node:child_process";
import { messages } from "./utils/index.js";
export async function startSSMSession(taskArn, rdsInstance, rdsPort, localPort) {
    const parameters = {
        host: [rdsInstance.endpoint],
        portNumber: [rdsPort],
        localPortNumber: [localPort],
    };
    const parametersJson = JSON.stringify(parameters);
    const commandString = `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;
    messages.info("Command to execute:");
    messages.cyan(commandString);
    messages.empty();
    messages.success(`🎯 RDS connection will be available at localhost:${localPort}`);
    messages.warning("Press Ctrl+C to terminate the session");
    messages.empty();
    return new Promise((resolve, reject) => {
        const child = spawn(commandString, [], {
            stdio: "inherit",
            env: process.env,
            shell: true,
        });
        child.on("error", (error) => {
            console.error("❌ Command execution error:", error.message);
            if (error.message.includes("ENOENT")) {
                reject(new Error("AWS CLI may not be installed"));
            }
            else if (error.message.includes("EACCES")) {
                reject(new Error("No permission to execute AWS CLI"));
            }
            else {
                reject(new Error(`Command execution error: ${error.message}`));
            }
        });
        child.on("close", (code, signal) => {
            clearTimeout(timeout);
            if (signal === "SIGINT" || code === 130 || isUserTermination) {
                messages.success("✅ Session terminated by user");
                resolve();
                return;
            }
            if (code === 0) {
                messages.success("✅ Session terminated successfully");
                resolve();
            }
            else {
                let errorMessage = `Session terminated with error code ${code}`;
                switch (code) {
                    case 1:
                        errorMessage +=
                            "\n💡 General error. Please check your AWS CLI configuration and permissions";
                        break;
                    case 2:
                        errorMessage += "\n💡 Configuration file or parameter issue";
                        break;
                    case 255:
                        errorMessage +=
                            "\n💡 Connection error or timeout. Please check network connection and target status";
                        break;
                    default:
                        errorMessage += "\n💡 Unexpected error. Please check AWS CLI logs";
                }
                reject(new Error(errorMessage));
            }
        });
        let hasSessionStarted = false;
        child.stdout?.on("data", (data) => {
            const output = data.toString();
            if (output.includes("Starting session") ||
                output.includes("Port forwarding started")) {
                hasSessionStarted = true;
                messages.success("🎉 Port forwarding session started!");
            }
        });
        child.stderr?.on("data", (data) => {
            const output = data.toString();
            if (output.includes("TargetNotConnected")) {
                console.error("❌ Cannot connect to target");
                console.error("💡 Please verify that the ECS task is running and SSM Agent is enabled");
                reject(new Error("Cannot connect to target"));
            }
            else if (output.includes("AccessDenied")) {
                console.error("❌ Access denied");
                console.error("💡 Please verify you have SSM-related IAM permissions");
                reject(new Error("Access denied"));
            }
            else if (output.includes("InvalidTarget")) {
                console.error("❌ Invalid target");
                console.error("💡 Please verify the specified ECS task exists and is running");
                reject(new Error("Invalid target"));
            }
        });
        let isUserTermination = false;
        process.on("SIGINT", () => {
            messages.warning("\n🛑 Terminating session...");
            isUserTermination = true;
            child.kill("SIGINT");
        });
        const timeout = setTimeout(() => {
            if (!hasSessionStarted) {
                console.error("❌ Session start timed out");
                console.error("💡 Please check network connection, target status, and permission settings");
                child.kill("SIGTERM");
                reject(new Error("Session start timed out"));
            }
        }, 30000);
    });
}
