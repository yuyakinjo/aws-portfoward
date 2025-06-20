import chalk from "chalk";
export const messages = {
    info: (message) => {
        console.log(chalk.blue(message));
    },
    success: (message) => {
        console.log(chalk.green(message));
    },
    error: (message) => {
        console.log(chalk.red(message));
    },
    warning: (message) => {
        console.log(chalk.yellow(message));
    },
    log: (message) => {
        console.log(message);
    },
    cyan: (message) => {
        console.log(chalk.cyan(message));
    },
    white: (message) => {
        console.log(chalk.white(message));
    },
    gray: (message) => {
        console.log(chalk.gray(message));
    },
    bold: {
        info: (message) => {
            console.log(chalk.blue.bold(message));
        },
        success: (message) => {
            console.log(chalk.green.bold(message));
        },
        error: (message) => {
            console.log(chalk.red.bold(message));
        },
        warning: (message) => {
            console.log(chalk.yellow.bold(message));
        },
        white: (message) => {
            console.log(chalk.white.bold(message));
        },
        gray: (message) => {
            console.log(chalk.gray.bold(message));
        },
    },
    empty: () => {
        console.log("");
    },
};
