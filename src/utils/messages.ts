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
};
