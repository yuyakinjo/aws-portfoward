import { describe, expect, it } from "bun:test";
import type { CompleteProps } from "decopin-cli";
import connect from "../../../app/connect/complete.tsx";
import enableExec from "../../../app/enable-exec/complete.tsx";
import exec from "../../../app/exec/complete.tsx";

// Tab 補完は打鍵を待たせるので、AWS に聞けない状況では即座に空を返すこと
const props = (
  name: string,
  options: CompleteProps["options"] = {},
): CompleteProps => ({
  name,
  partial: "",
  options,
  args: [],
  env: {},
  cwd: process.cwd(),
});

describe("complete.tsx", () => {
  it("region が無いうちは cluster / task / rds / service を AWS に聞かない", async () => {
    expect(await connect(props("cluster"))).toEqual([]);
    expect(
      await connect(props("task", { region: ["ap-northeast-1"] })),
    ).toEqual([]);
    expect(await connect(props("rds"))).toEqual([]);
    expect(await exec(props("task"))).toEqual([]);
    expect(
      await enableExec(props("service", { region: ["ap-northeast-1"] })),
    ).toEqual([]);
  });

  it("知らない引数は候補なし", async () => {
    expect(await connect(props("rds-port"))).toEqual([]);
    expect(await exec(props("command"))).toEqual([]);
  });
});
