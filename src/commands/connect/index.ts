import { render } from "ink";
import React from "react";
import type { ValidatedConnectOptions } from "../../types.js";
import ConnectApp from "./ui/ConnectApp.js";

export async function connectWithInk(
  options: ValidatedConnectOptions,
): Promise<void> {
  const { waitUntilExit } = render(
    React.createElement(ConnectApp, { options }),
  );

  await waitUntilExit();
}
