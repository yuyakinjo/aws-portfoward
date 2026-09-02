import { ask, choose, confirm } from "decopin-cli";
import type { SearchableItem } from "../search.js";

// 端末の装飾は choose() が描くので、候補名からは落とす (絞り込みの対象にもしない)
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const plain = (text: string) => text.replace(ANSI, "").trim();

/**
 * 候補から 1 つ選ぶ。文字を打つと絞り込める (decopin-cli の choose)。
 * 候補が 1 つならその場で決める (聞くまでもない)
 */
export async function pickOne(
  message: string,
  items: readonly SearchableItem[],
): Promise<unknown> {
  if (items.length === 0) throw new Error(`Nothing to choose from: ${message}`);
  const labels = items.map((item) => plain(item.name));
  const picked = items.length === 1 ? labels[0] : await choose(message, labels);
  const index = labels.indexOf(picked as string);
  return (items[index] as SearchableItem).value;
}

/** 一行の入力。validate は inquirer 流 (true か理由) のまま渡せる */
export async function askText(
  message: string,
  options: {
    default?: string;
    validate?: (value: string) => true | string;
  } = {},
): Promise<string> {
  return ask(message, {
    default: options.default,
    validate: (value) => {
      const result = options.validate?.(value);
      return result === undefined || result === true ? undefined : result;
    },
  });
}

export const askYesNo = (message: string, fallback = true) =>
  confirm(message, { default: fallback });
