import { registerConnectCommand } from "./connect.js";
export function registerAllCommands(program) {
    registerConnectCommand(program);
}
