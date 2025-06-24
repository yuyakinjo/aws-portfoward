import { spawn } from "node:child_process";
import type { RDSInstance } from "./types.js";
import { messages } from "./utils/index.js";

export async function startSSMSession(
  taskArn: string,
  rdsInstance: RDSInstance,
  rdsPort: string,
  localPort: string,
  reproducibleCommand?: string,
): Promise<void> {
  const parameters = {
    host: [rdsInstance.endpoint],
    portNumber: [rdsPort],
    localPortNumber: [localPort],
  };

  // Build command string (properly escape JSON parameters)
  const parametersJson = JSON.stringify(parameters);
  const commandString = `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;

  messages.empty();
  messages.success(
    `🌈 RDS connection will be available at localhost:${localPort}`,
  );
  messages.empty();

  return new Promise((resolve, reject) => {
    let isUserTermination = false;
    let hasSessionStarted = false;

    // Use pipe mode to capture output while still showing it to user
    const child = spawn(commandString, [], {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
      shell: true,
    });

    // Forward stdout to console while monitoring for session start
    child.stdout?.on("data", (data) => {
      const output = data.toString();
      process.stdout.write(output); // Forward to user

      // Detect session start with more patterns
      if (
        output.includes("Starting session") ||
        output.includes("Port forwarding started") ||
        output.includes("Waiting for connections") ||
        output.includes("Port forwarding session started") ||
        (output.includes("Session") && output.includes("started"))
      ) {
        if (!hasSessionStarted) {
          hasSessionStarted = true;
          clearTimeout(timeout);
        }
      }
    });

    // Forward stderr to console while monitoring for errors
    child.stderr?.on("data", (data) => {
      const output = data.toString();

      // Check for critical errors first
      if (output.includes("TargetNotConnected")) {
        console.error("Cannot connect to target");
        console.error(
          "Please verify that the ECS task is running and SSM Agent is enabled",
        );
        child.kill("SIGTERM");
        reject(new Error("Cannot connect to target"));
        return;
      } else if (output.includes("AccessDenied")) {
        console.error("Access denied");
        console.error("Please verify you have SSM-related IAM permissions");
        child.kill("SIGTERM");
        reject(new Error("Access denied"));
        return;
      } else if (output.includes("InvalidTarget")) {
        console.error("Invalid target");
        console.error(
          "Please verify the specified ECS task exists and is running",
        );
        child.kill("SIGTERM");
        reject(new Error("Invalid target"));
        return;
      }

      // Forward non-critical stderr to console
      process.stderr.write(output);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      console.error("Command execution error:", error.message);

      if (error.message.includes("ENOENT")) {
        reject(new Error("AWS CLI may not be installed"));
      } else if (error.message.includes("EACCES")) {
        reject(new Error("No permission to execute AWS CLI"));
      } else {
        reject(new Error(`Command execution error: ${error.message}`));
      }
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeout);

      // Handle user termination (SIGINT/Ctrl+C) as normal termination
      if (signal === "SIGINT" || code === 130 || isUserTermination) {
        messages.success("Process completed successfully");
        messages.ui.displayCommandResults(
          commandString,
          reproducibleCommand,
          "Command to execute",
        );
        resolve();
        return;
      }

      if (code === 0) {
        messages.success("Process completed successfully");
        messages.ui.displayCommandResults(
          commandString,
          reproducibleCommand,
          "Command to execute",
        );
        resolve();
      } else {
        let errorMessage = `Session terminated with error code ${code}`;

        // Detailed messages based on error codes
        switch (code) {
          case 1:
            errorMessage +=
              "\nGeneral error. Please check your AWS CLI configuration and permissions";
            break;
          case 2:
            errorMessage += "\nConfiguration file or parameter issue";
            break;
          case 255:
            errorMessage +=
              "\nConnection error or timeout. Please check network connection and target status";
            break;
          default:
            errorMessage += "\nUnexpected error. Please check AWS CLI logs";
        }

        reject(new Error(errorMessage));
      }
    });

    // Process termination handling
    process.on("SIGINT", () => {
      if (!isUserTermination) {
        isUserTermination = true;
        child.kill("SIGINT");
      }
    });

    // Optimistic timeout - assume session will start successfully after 5 seconds
    // if no explicit errors are encountered
    const timeout = setTimeout(() => {
      if (!hasSessionStarted) {
        hasSessionStarted = true;
        messages.success("Port forwarding session should be active");
        messages.info(
          "If connection fails, the session may still be starting. Please wait a moment and try again.",
        );
      }
    }, 5000);
  });
}

/**
 * Execute command in ECS task container using AWS ECS execute-command
 */
export async function executeECSCommand(
  region: string,
  clusterName: string,
  taskArn: string,
  containerName: string,
  command: string,
  reproducibleCommand?: string,
): Promise<void> {
  // Build command string
  const commandString = `aws ecs execute-command --region ${region} --cluster ${clusterName} --task ${taskArn} --container ${containerName} --command "${command}" --interactive`;

  messages.empty();
  messages.success(`Executing command in ECS container: ${containerName}`);
  messages.info(`Command: ${command}`);
  messages.empty();

  return new Promise((resolve, reject) => {
    let isUserTermination = false;

    // Use inherit mode to pass through stdin/stdout/stderr directly
    const child = spawn(commandString, [], {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });

    child.on("error", (error) => {
      console.error("Command execution error:", error.message);

      if (error.message.includes("ENOENT")) {
        reject(new Error("AWS CLI may not be installed"));
      } else if (error.message.includes("EACCES")) {
        reject(new Error("No permission to execute AWS CLI"));
      } else {
        reject(new Error(`Command execution error: ${error.message}`));
      }
    });

    child.on("close", (code, signal) => {
      // Handle user termination (SIGINT/Ctrl+C) as normal termination
      if (signal === "SIGINT" || code === 130 || isUserTermination) {
        messages.success("Process completed successfully");
        messages.ui.displayCommandResults(commandString, reproducibleCommand);
        resolve();
        return;
      }

      if (code === 0) {
        messages.success("Process completed successfully");
        messages.ui.displayCommandResults(commandString, reproducibleCommand);
        resolve();
      } else {
        let errorMessage = `ECS exec command failed with error code ${code}`;

        // Detailed messages based on error codes
        switch (code) {
          case 1:
            errorMessage +=
              "\nGeneral error. Please check your AWS CLI configuration and permissions";
            break;
          case 2:
            errorMessage += "\nConfiguration file or parameter issue";
            break;
          case 254:
            errorMessage +=
              "\nECS exec not enabled for this task. Please ensure the task definition has enableExecuteCommand: true";
            break;
          case 255:
            errorMessage +=
              "\nConnection error or timeout. Please check network connection and task status";
            break;
          default:
            errorMessage += "\nUnexpected error. Please check AWS CLI logs";
        }

        reject(new Error(errorMessage));
      }
    });

    // Process termination handling
    process.on("SIGINT", () => {
      if (!isUserTermination) {
        isUserTermination = true;
        child.kill("SIGINT");
      }
    });
  });
}
