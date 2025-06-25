import chalk from "chalk";

export const messages = {
  info: (message: string) => {
    console.log(chalk.blue(message));
  },

  success: (message: string) => {
    console.log(chalk.green(message));
  },

  error: (message: string) => {
    console.log(chalk.red(message));
  },

  warning: (message: string) => {
    console.log(chalk.yellow(message));
  },

  log: (message: string) => {
    console.log(message);
  },

  // Clear previous lines
  clearLines: (count: number) => {
    for (let i = 0; i < count; i++) {
      process.stdout.write("\x1b[1A"); // Move cursor up
      process.stdout.write("\x1b[2K"); // Clear entire line
    }
  },

  // Clear and replace the last line
  clearAndReplace: (
    newMessage: string,
    color: "info" | "success" | "error" | "warning" = "success",
  ) => {
    process.stdout.write("\x1b[1A"); // Move cursor up
    process.stdout.write("\x1b[2K"); // Clear entire line
    process.stdout.write("\r"); // Move to start of line
    messages[color](newMessage);
  },

  // 色付きのメッセージ（既存の色指定を維持）
  cyan: (message: string) => {
    console.log(chalk.cyan(message));
  },

  white: (message: string) => {
    console.log(chalk.white(message));
  },

  gray: (message: string) => {
    console.log(chalk.gray(message));
  },

  // 太字バリエーション
  bold: {
    info: (message: string) => {
      console.log(chalk.blue.bold(message));
    },

    success: (message: string) => {
      console.log(chalk.green.bold(message));
    },

    error: (message: string) => {
      console.log(chalk.red.bold(message));
    },

    warning: (message: string) => {
      console.log(chalk.yellow.bold(message));
    },

    white: (message: string) => {
      console.log(chalk.white.bold(message));
    },

    gray: (message: string) => {
      console.log(chalk.gray.bold(message));
    },
  },

  // 空行
  empty: () => {
    console.log("");
  },

  // Network selection UI
  ui: {
    // Display the current selection state in step-by-step format matching the mockup
    displaySelectionState: (selections: {
      region?: string;
      rds?: string;
      rdsPort?: string;
      ecsTarget?: string;
      ecsCluster?: string;
      localPort?: string;
    }) => {
      console.clear();
      console.log(chalk.bold.white("Select Network Configuration"));
      messages.empty();

      // Helper function to format line with proper spacing and alignment
      const formatSelectionLine = (
        label: string,
        value: string | undefined,
        isPlaceholder = false,
        placeholderLabel?: string,
      ) => {
        const labelWidth = 12;
        const totalWidth = 60;
        const paddedLabel = label.padEnd(labelWidth, " ");

        if (!value) {
          const placeholder = "____________";
          const spaces = " ".repeat(
            Math.max(0, totalWidth - labelWidth - 3 - placeholder.length),
          );
          return `  ${paddedLabel}: ${spaces}${chalk.gray(placeholder)}`;
        }

        if (isPlaceholder && placeholderLabel) {
          // Special format for placeholder labels like "(RDS port): 5432"
          const formattedLabel = `(${placeholderLabel})`;
          const paddedPlaceholderLabel = formattedLabel.padEnd(labelWidth, " ");
          const spaces = " ".repeat(
            Math.max(0, totalWidth - labelWidth - 3 - value.length),
          );
          return `  ${chalk.gray.italic(paddedPlaceholderLabel)}: ${spaces}${chalk.gray.italic(value)}`;
        }

        if (isPlaceholder) {
          const formattedValue = `(${value})`;
          const spaces = " ".repeat(
            Math.max(0, totalWidth - labelWidth - 3 - formattedValue.length),
          );
          return `  ${paddedLabel}: ${spaces}${chalk.gray.italic(formattedValue)}`;
        }

        const spaces = " ".repeat(
          Math.max(0, totalWidth - labelWidth - 3 - value.length),
        );
        return `  ${paddedLabel}: ${spaces}${chalk.cyan(value)}`;
      };

      // Region selection
      console.log(formatSelectionLine("Region", selections.region));

      // RDS Instance selection
      console.log(formatSelectionLine("RDS", selections.rds));

      // RDS Port (auto-determined when RDS is selected)
      if (selections.rds && selections.rdsPort) {
        console.log(
          formatSelectionLine("", selections.rdsPort, true, "RDS port"),
        );
      } else if (selections.rds) {
        console.log(formatSelectionLine("", "determining port...", true));
      } else {
        console.log(formatSelectionLine("", undefined));
      }

      // ECS Target selection
      console.log(formatSelectionLine("ECS Target", selections.ecsTarget));

      // ECS Cluster (auto-determined when ECS Target is selected)
      if (selections.ecsTarget && selections.ecsCluster) {
        console.log(
          formatSelectionLine("", selections.ecsCluster, true, "ECS Cluster"),
        );
      } else if (selections.ecsTarget) {
        console.log(formatSelectionLine("", "determining cluster...", true));
      } else {
        console.log(formatSelectionLine("", undefined));
      }

      // Local Port selection
      console.log(formatSelectionLine("Local Port", selections.localPort));

      messages.empty();
    },

    // Display ECS exec selection state
    displayExecSelectionState: (selections: {
      region?: string;
      cluster?: string;
      task?: string;
      container?: string;
      command?: string;
    }) => {
      console.clear();
      console.log(chalk.bold.white("ECS Execute Command Configuration"));
      messages.empty();

      // Helper function to format line with proper spacing and alignment
      const formatSelectionLine = (
        label: string,
        value: string | undefined,
      ) => {
        const labelWidth = 12;
        const totalWidth = 60;
        const paddedLabel = label.padEnd(labelWidth, " ");

        if (!value) {
          const placeholder = "____________";
          const spaces = " ".repeat(
            Math.max(0, totalWidth - labelWidth - 3 - placeholder.length),
          );
          return `  ${paddedLabel}: ${spaces}${chalk.gray(placeholder)}`;
        }

        const spaces = " ".repeat(
          Math.max(0, totalWidth - labelWidth - 3 - value.length),
        );
        return `  ${paddedLabel}: ${spaces}${chalk.cyan(value)}`;
      };

      // Region selection
      console.log(formatSelectionLine("Region", selections.region));

      // ECS Cluster selection
      console.log(formatSelectionLine("Cluster", selections.cluster));

      // ECS Task selection
      console.log(formatSelectionLine("Task", selections.task));

      // Container selection
      console.log(formatSelectionLine("Container", selections.container));

      // Command selection
      console.log(formatSelectionLine("Command", selections.command));

      messages.empty();
    },
  },

  // Dry Run functionality
  dryRun: {
    header: () => {
      console.log("");
      console.log(
        chalk.cyan("🏃 Dry Run Mode - Commands that would be executed:"),
      );
      console.log("");
    },

    awsCommand: (cmd: string) => {
      console.log(chalk.blue("AWS Command:"));
      console.log(cmd);
      console.log("");
    },

    reproducibleCommand: (cmd: string) => {
      console.log(chalk.green("Reproducible Command:"));
      console.log(cmd);
      console.log("");
    },

    sessionInfo: (info: {
      region: string;
      cluster: string;
      task: string;
      rds?: string;
      rdsPort?: string;
      localPort?: string;
      container?: string;
      command?: string;
    }) => {
      console.log(chalk.yellow("Session Information:"));
      console.log(`Region: ${info.region}`);
      console.log(`Cluster: ${info.cluster}`);
      console.log(`Task: ${info.task}`);

      if (info.rds) {
        console.log(`RDS: ${info.rds}`);
        console.log(`RDS Port: ${info.rdsPort}`);
        console.log(`Local Port: ${info.localPort}`);
      }

      if (info.container) {
        console.log(`Container: ${info.container}`);
        console.log(`Command: ${info.command}`);
      }

      console.log("");
    },
  },

  // SSM connection troubleshooting
  ssmTroubleshooting: {
    checkSessionManagerPlugin: () => {
      console.log("");
      console.log(chalk.yellow("🔍 Checking Session Manager Plugin:"));
      console.log("Run this command to verify installation:");
      console.log(chalk.cyan("session-manager-plugin --version"));
      console.log("");
      console.log("If not installed, download from:");
      console.log(
        "https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html",
      );
      console.log("");
    },

    checkECSTaskStatus: (taskArn: string) => {
      console.log(chalk.yellow("🔍 Checking ECS Task Status:"));
      console.log("Run this command to verify task is running:");
      console.log(chalk.cyan(`aws ecs describe-tasks --tasks ${taskArn}`));
      console.log("");
    },

    checkSSMPermissions: () => {
      console.log(chalk.yellow("🔍 Required IAM Permissions:"));
      console.log("Task execution role needs these permissions:");
      console.log("• ssmmessages:CreateControlChannel");
      console.log("• ssmmessages:CreateDataChannel");
      console.log("• ssmmessages:OpenControlChannel");
      console.log("• ssmmessages:OpenDataChannel");
      console.log("");
      console.log("Your AWS user/role needs:");
      console.log("• ssm:StartSession");
      console.log("• ecs:ExecuteCommand");
      console.log("");
    },

    displayFullDiagnostics: (taskArn: string) => {
      console.log("");
      console.log(chalk.red("❌ SSM Connection Failed - Running Diagnostics"));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      messages.ssmTroubleshooting.checkSessionManagerPlugin();
      messages.ssmTroubleshooting.checkECSTaskStatus(taskArn);
      messages.ssmTroubleshooting.checkSSMPermissions();

      console.log(chalk.yellow("💡 Additional Troubleshooting:"));
      console.log("1. Verify ECS task has enableExecuteCommand: true");
      console.log("2. Check if ECS service has enableExecuteCommand enabled");
      console.log("3. Ensure task is in RUNNING state");
      console.log("4. Verify network connectivity to AWS SSM endpoints");
      console.log("5. Check CloudTrail logs for permission errors");
      console.log("");
    },
  },
};
