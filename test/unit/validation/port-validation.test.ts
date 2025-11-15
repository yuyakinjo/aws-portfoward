import * as net from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  areAllPortsInRange,
  findAvailablePort,
  getPortRange,
  isPortAvailable,
  isPortRange,
} from "../../../src/utils/validation.js";

// Type definition for mocked createServer function
type MockCreateServer = ReturnType<typeof vi.fn>;

// net.createServerをモック化
vi.mock("node:net", () => {
  const actualNet = vi.importActual<typeof net>("node:net");
  return {
    ...actualNet,
    createServer: vi.fn(),
  };
});

// Type definitions for mocks
type MockServer = {
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

type ErrorHandler = (error: Error) => void;

describe("isPortAvailable", () => {
  let mockServer: MockServer;

  beforeEach(() => {
    mockServer = {
      listen: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };
    (net.createServer as MockCreateServer).mockReturnValue(mockServer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("利用可能なポートの場合はtrueを返す", async () => {
    // listenが成功し、closeコールバックが呼ばれる
    mockServer.listen.mockImplementation(
      (_port: number, _host: string, callback: () => void) => {
        callback();
      },
    );
    mockServer.close.mockImplementation((callback: () => void) => {
      callback();
    });

    const result = await isPortAvailable(8888);
    expect(result).toBe(true);
    expect(net.createServer).toHaveBeenCalled();
    expect(mockServer.listen).toHaveBeenCalledWith(
      8888,
      "localhost",
      expect.any(Function),
    );
    expect(mockServer.close).toHaveBeenCalled();
  });

  it("使用中のポートの場合はfalseを返す", async () => {
    // listenでエラーが発生
    mockServer.on.mockImplementation((event: string, handler: ErrorHandler) => {
      if (event === "error") {
        handler(new Error("EADDRINUSE"));
      }
    });
    mockServer.listen.mockImplementation(() => {
      // エラーイベントをトリガー
      const errorHandler = mockServer.on.mock.calls.find(
        (call: unknown[]) => call[0] === "error",
      )?.[1] as ErrorHandler;
      if (errorHandler) {
        errorHandler(new Error("EADDRINUSE"));
      }
    });

    const result = await isPortAvailable(3000);
    expect(result).toBe(false);
    expect(net.createServer).toHaveBeenCalled();
  });

  it("その他のエラーの場合もfalseを返す", async () => {
    mockServer.on.mockImplementation((event: string, handler: ErrorHandler) => {
      if (event === "error") {
        handler(new Error("EACCES"));
      }
    });
    mockServer.listen.mockImplementation(() => {
      const errorHandler = mockServer.on.mock.calls.find(
        (call: unknown[]) => call[0] === "error",
      )?.[1] as ErrorHandler;
      if (errorHandler) {
        errorHandler(new Error("EACCES"));
      }
    });

    const result = await isPortAvailable(80);
    expect(result).toBe(false);
  });
});

describe("findAvailablePort", () => {
  let mockServer: MockServer;

  beforeEach(() => {
    mockServer = {
      listen: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };
    (net.createServer as MockCreateServer).mockReturnValue(mockServer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("最初のポートが利用可能な場合はそのポートを返す", async () => {
    // 全てのポートが利用可能
    mockServer.listen.mockImplementation(
      (_port: number, _host: string, callback: () => void) => {
        callback();
      },
    );
    mockServer.close.mockImplementation((callback: () => void) => {
      callback();
    });

    const result = await findAvailablePort(8888);
    expect(result).toBe(8888);
  });

  it("使用中のポートをスキップして次の利用可能なポートを返す", async () => {
    // ポートごとの動作を設定
    let checkCount = 0;

    mockServer.listen.mockImplementation(
      (port: number, _host: string, callback?: () => void) => {
        checkCount++;

        // onハンドラーを先に設定
        const errorHandlers: ErrorHandler[] = [];
        mockServer.on.mockImplementation(
          (event: string, handler: ErrorHandler) => {
            if (event === "error") {
              errorHandlers.push(handler);
            }
          },
        );

        // ポートによって動作を分岐
        if (port === 8888 || port === 8889) {
          // エラーハンドラーを非同期で呼び出す
          setImmediate(() => {
            errorHandlers.forEach((handler) => {
              handler(new Error("EADDRINUSE"));
            });
          });
        } else if (port === 8890) {
          // 成功
          if (callback) callback();
        }
      },
    );

    mockServer.close.mockImplementation((callback: () => void) => {
      callback();
    });

    const result = await findAvailablePort(8888);
    expect(result).toBe(8890);
    expect(checkCount).toBe(3);
  });

  it("デフォルトのスタートポート(8888)から検索を開始する", async () => {
    mockServer.listen.mockImplementation(
      (_port: number, _host: string, callback: () => void) => {
        callback();
      },
    );
    mockServer.close.mockImplementation((callback: () => void) => {
      callback();
    });

    const result = await findAvailablePort();
    expect(result).toBe(8888);
  });

  it("最大ポート番号(65535)まで検索して見つからない場合はエラーをスローする", async () => {
    // 全てのポートが使用中
    mockServer.on.mockImplementation((event: string, handler: ErrorHandler) => {
      if (event === "error") {
        // 即座にエラーを返す
        Promise.resolve().then(() => handler(new Error("EADDRINUSE")));
      }
    });
    mockServer.listen.mockImplementation(() => {
      const errorHandler = mockServer.on.mock.calls.find(
        (call: unknown[]) => call[0] === "error",
      )?.[1] as ErrorHandler;
      if (errorHandler) {
        errorHandler(new Error("EADDRINUSE"));
      }
    });

    await expect(findAvailablePort(65534)).rejects.toThrow(
      "No available ports found starting from 65534",
    );
  });

  it("カスタムスタートポートから検索を開始する", async () => {
    let checkedPort = 0;
    mockServer.listen.mockImplementation(
      (port: number, _host: string, callback: () => void) => {
        checkedPort = port;
        callback();
      },
    );
    mockServer.close.mockImplementation((callback: () => void) => {
      callback();
    });

    const result = await findAvailablePort(9999);
    expect(result).toBe(9999);
    expect(checkedPort).toBe(9999);
  });
});

describe("areAllPortsInRange", () => {
  it("全てのポートが有効範囲内の場合trueを返す", () => {
    expect(areAllPortsInRange([80, 443, 8080])).toBe(true);
    expect(areAllPortsInRange([1, 65535])).toBe(true);
    expect(areAllPortsInRange([])).toBe(true); // 空配列はtrue
  });

  it("一つでも無効なポートがある場合falseを返す", () => {
    expect(areAllPortsInRange([80, 0, 443])).toBe(false);
    expect(areAllPortsInRange([80, 65536])).toBe(false);
    expect(areAllPortsInRange([-1, 80])).toBe(false);
  });
});

describe("getPortRange", () => {
  it("正しいポート範囲のタプルを返す", () => {
    const range = getPortRange();
    expect(range).toEqual([1, 65535]);
    expect(range).toHaveLength(2);
  });

  it("読み取り専用のタプルを返す", () => {
    const range = getPortRange();
    // TypeScriptの型レベルでreadonlyが保証されていることを確認
    // JavaScriptランタイムでは配列への代入は実際にはエラーをスローしないが、
    // TypeScriptのコンパイル時に型チェックで防がれる
    expect(range).toBeInstanceOf(Array);
    expect(Object.isFrozen(range)).toBe(false); // 通常の配列なのでfrozenではない

    // 型レベルでreadonlyであることをテスト（コンパイル時チェック）
    // 以下のコメントアウトを外すとTypeScriptコンパイルエラーになる
    // range[0] = 999;
  });
});

describe("isPortRange", () => {
  it("有効なポート番号の場合trueを返す", () => {
    expect(isPortRange(1)).toBe(true);
    expect(isPortRange(80)).toBe(true);
    expect(isPortRange(443)).toBe(true);
    expect(isPortRange(8080)).toBe(true);
    expect(isPortRange(65535)).toBe(true);
  });

  it("無効なポート番号の場合falseを返す", () => {
    expect(isPortRange(0)).toBe(false);
    expect(isPortRange(-1)).toBe(false);
    expect(isPortRange(65536)).toBe(false);
    expect(isPortRange(100000)).toBe(false);
  });

  it("整数でない場合falseを返す", () => {
    expect(isPortRange(80.5)).toBe(false);
    expect(isPortRange(NaN)).toBe(false);
    expect(isPortRange(Infinity)).toBe(false);
  });
});

describe("isPortRange string", () => {
  it("有効なポート文字列の場合trueを返す", () => {
    expect(isPortRange("1")).toBe(true);
    expect(isPortRange("80")).toBe(true);
    expect(isPortRange("443")).toBe(true);
    expect(isPortRange("8080")).toBe(true);
    expect(isPortRange("65535")).toBe(true);
  });

  it("無効なポート文字列の場合falseを返す", () => {
    expect(isPortRange("0")).toBe(false);
    expect(isPortRange("-1")).toBe(false);
    expect(isPortRange("65536")).toBe(false);
    expect(isPortRange("abc")).toBe(false);
    expect(isPortRange("80.5")).toBe(false);
    expect(isPortRange("")).toBe(false);
    expect(isPortRange(" 80 ")).toBe(false);
  });

  it("先頭ゼロを含む文字列も正しく処理する", () => {
    expect(isPortRange("0080")).toBe(true);
    expect(isPortRange("00001")).toBe(true);
  });
});
