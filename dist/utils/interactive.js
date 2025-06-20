import inquirer from "inquirer";
export async function askRetry() {
    const { shouldRetry } = await inquirer.prompt([
        {
            type: "confirm",
            name: "shouldRetry",
            message: "Would you like to retry?",
            default: true,
        },
    ]);
    return shouldRetry;
}
