import { askYesNo } from "./prompt.js";

/**
 * リトライするか聞く。端末が無い (パイプ、CI) なら聞けないので「しない」。
 * エラーは既に表示されているので、そのまま失敗として終わる
 */
export async function askRetry(): Promise<boolean> {
  try {
    return await askYesNo("Would you like to retry?", true);
  } catch {
    return false;
  }
}
