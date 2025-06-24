import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // テストファイルの場所
    include: ["test/**/*.test.ts"],

    // テスト環境設定
    environment: "node",

    // グローバル設定
    globals: true,

    // カバレッジ設定
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "test/", "scripts/", "**/*.d.ts"],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },

    // タイムアウト設定（CLI操作を考慮）
    testTimeout: 10000,
    hookTimeout: 10000,

    // 並列実行設定
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },

    // モック設定
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    // CLI特有の設定
    isolate: true, // テスト間の分離
  },

  // エイリアス設定（必要に応じて）
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "@test": new URL("./test", import.meta.url).pathname,
    },
  },
});
