import * as net from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findAvailablePort,
  isPortAvailable,
} from "../../../src/utils/validation.js";

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
    (net.createServer as ReturnType<typeof vi.fn>).mockReturnValue(mockServer);
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
    (net.createServer as ReturnType<typeof vi.fn>).mockReturnValue(mockServer);
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
            errorHandlers.forEach((handler) =>
              handler(new Error("EADDRINUSE")),
            );
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
