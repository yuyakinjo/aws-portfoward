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
      reporter: ["text", "json", "json-summary", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "test/",
        "scripts/",
        "**/*.d.ts",
        // エントリーポイント・CLI関連（テスト対象外）
        "src/cli.ts",
        "src/programs/**",
        // UIフロー・セッション管理（実際のAWS接続・ユーザー操作依存）
        "src/session.ts",
        "src/core/connection-flow.ts",
        "src/core/simple-ui-flow.ts",
        "src/core/exec-ui-flow.ts",
        "src/core/user-prompts.ts",
        "src/core/resource-selection.ts",
        "src/core/command-generation.ts",
        // エラー表示・メッセージ（表示ロジックのみ）
        "src/utils/error-display.ts",
        "src/utils/messages.ts",
        "src/utils/interactive.ts",
        "src/utils/database.ts",
        // 型定義・定数
        "src/types.ts",
        "src/version.ts",
        // 外部データ読み込み
        "src/inference/performance-tracker.ts",
        // 設定ファイル
        "vitest.config.ts",
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 80,
          lines: 80,
          statements: 80,
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
