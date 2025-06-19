import { spawn } from "node:child_process";
import chalk from "chalk";
import type { RDSInstance } from "./types.js";

export async function startSSMSession(
	taskArn: string,
	rdsInstance: RDSInstance,
	rdsPort: string,
	localPort: string,
): Promise<void> {
	const parameters = {
		host: [rdsInstance.endpoint],
		portNumber: [rdsPort],
		localPortNumber: [localPort],
	};

	// Build command string (properly escape JSON parameters)
	const parametersJson = JSON.stringify(parameters);
	const commandString = `aws ssm start-session --target ${taskArn} --parameters '${parametersJson}' --document-name AWS-StartPortForwardingSessionToRemoteHost`;

	console.log(chalk.blue("Command to execute:"));
	console.log(chalk.cyan(commandString));
	console.log("");
	console.log(
		chalk.green(
			`🎯 RDS connection will be available at localhost:${localPort}`,
		),
	);
	console.log(chalk.yellow("Press Ctrl+C to terminate the session"));
	console.log("");

	return new Promise((resolve, reject) => {
		const child = spawn(commandString, [], {
			stdio: "inherit",
			env: process.env,
			shell: true,
		});

		child.on("error", (error) => {
			console.error(chalk.red("❌ Command execution error:"), error.message);

			if (error.message.includes("ENOENT")) {
				reject(new Error("AWS CLI may not be installed"));
			} else if (error.message.includes("EACCES")) {
				reject(new Error("No permission to execute AWS CLI"));
			} else {
				reject(new Error(`Command execution error: ${error.message}`));
			}
		});

		child.on("close", (code) => {
			if (code === 0) {
				console.log(chalk.green("✅ Session terminated successfully"));
				resolve();
			} else {
				let errorMessage = `Session terminated with error code ${code}`;

				// Detailed messages based on error codes
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
					case 130:
						errorMessage += "\n💡 User interruption (Ctrl+C)";
						resolve(); // Treat user interruption as normal termination
						return;
					default:
						errorMessage += "\n💡 Unexpected error. Please check AWS CLI logs";
				}

				reject(new Error(errorMessage));
			}
		});

		let hasSessionStarted = false;

		// Monitor stdout to detect session start
		child.stdout?.on("data", (data) => {
			const output = data.toString();
			if (
				output.includes("Starting session") ||
				output.includes("Port forwarding started")
			) {
				hasSessionStarted = true;
				console.log(chalk.green("🎉 Port forwarding session started!"));
			}
		});

		// Monitor stderr to analyze errors in detail
		child.stderr?.on("data", (data) => {
			const output = data.toString();

			if (output.includes("TargetNotConnected")) {
				console.error(chalk.red("❌ Cannot connect to target"));
				console.error(
					chalk.yellow(
						"💡 Please verify that the ECS task is running and SSM Agent is enabled",
					),
				);
				reject(new Error("Cannot connect to target"));
			} else if (output.includes("AccessDenied")) {
				console.error(chalk.red("❌ Access denied"));
				console.error(
					chalk.yellow("💡 Please verify you have SSM-related IAM permissions"),
				);
				reject(new Error("Access denied"));
			} else if (output.includes("InvalidTarget")) {
				console.error(chalk.red("❌ Invalid target"));
				console.error(
					chalk.yellow(
						"💡 Please verify the specified ECS task exists and is running",
					),
				);
				reject(new Error("Invalid target"));
			}
		});

		// Process termination handling
		process.on("SIGINT", () => {
			console.log(chalk.yellow("\n🛑 Terminating session..."));
			child.kill("SIGINT");
		});

		// Timeout handling (30 seconds)
		const timeout = setTimeout(() => {
			if (!hasSessionStarted) {
				console.error(chalk.red("❌ Session start timed out"));
				console.error(
					chalk.yellow(
						"💡 Please check network connection, target status, and permission settings",
					),
				);
				child.kill("SIGTERM");
				reject(new Error("Session start timed out"));
			}
		}, 30000);

		// Clear timeout when session start is confirmed
		child.on("close", () => {
			clearTimeout(timeout);
		});
	});
}
