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

  warn: (message: string) => {
    console.warn(chalk.yellow(message));
  },

  debug: (message: string) => {
    console.log(chalk.gray(`[DEBUG] ${message}`));
  },

  // Clear previous lines
  clearLines: (count: number) => {
    for (const _ of Array(count)) {
      process.stdout.write("\x1b[1A"); // Move cursor up
      process.stdout.write("\x1b[2K"); // Clear entire line
    }
  },

  // Clear previous line (commonly used pattern)
  clearPreviousLine: () => {
    process.stdout.write("\x1b[1A\x1b[2K\r");
  },

  // Clear current line (for progress indicators)
  clearCurrentLine: () => {
    process.stdout.write("\r\x1b[2K");
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
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(cmd);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
    },

    reproducibleCommand: (cmd: string) => {
      console.log(chalk.green("Reproducible Command:"));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(cmd);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
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
};
