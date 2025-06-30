import chalk from "chalk";
import Fuse from "fuse.js";
import { isEmpty, isObjectType } from "remeda";
import {
  formatInferenceResult,
  type InferenceResult,
} from "./inference/index.js";
import { splitByWhitespace } from "./regex.js";
import type { AWSRegion, ECSCluster, ECSTask, RDSInstance } from "./types.js";

// Helper functions for type-safe property access
function hasRegionName(item: unknown): item is AWSRegion {
  return isObjectType(item) && "regionName" in item;
}

function hasClusterName(item: unknown): item is ECSCluster {
  return isObjectType(item) && "clusterName" in item;
}

function hasDbInstanceIdentifier(item: unknown): item is RDSInstance {
  return isObjectType(item) && "dbInstanceIdentifier" in item;
}

function getResourceIdentifier(item: unknown): string | undefined {
  if (hasRegionName(item)) return item.regionName;
  if (hasClusterName(item)) return item.clusterName;
  if (hasDbInstanceIdentifier(item)) return item.dbInstanceIdentifier;
  return undefined;
}

interface SearchableItem {
  name: string;
  value: unknown;
  description?: string;
  metadata?: string;
  isDefault?: boolean;
}

interface SearchConfig<T> {
  items: T[];
  searchKeys: string[];
  displayFormatter: (
    item: T,
    index: number,
    isDefault?: boolean,
    score?: number,
  ) => SearchableItem;
  emptyInputFormatter?: (
    item: T,
    index: number,
    isDefault?: boolean,
  ) => SearchableItem;
  threshold?: number;
  distance?: number;
  pageSize?: number;
}

export async function universalSearch<T>(
  config: SearchConfig<T>,
  input: string,
  defaultValue?: string | T,
): Promise<SearchableItem[]> {
  const {
    items,
    searchKeys,
    displayFormatter,
    emptyInputFormatter = displayFormatter,
    threshold = 0.3, // より厳格に
    distance = 100, // より厳格に
  } = config;

  // 空の入力の場合
  if (!input || input.trim() === "") {
    // デフォルト値がある場合は先頭に表示
    const sortedItems = defaultValue
      ? (() => {
          const defaultKey =
            typeof defaultValue === "string" ? defaultValue : null;
          return [
            ...items.filter((item) => {
              if (defaultKey) {
                return getResourceIdentifier(item) === defaultKey;
              }
              return item === defaultValue;
            }),
            ...items.filter((item) => {
              if (defaultKey) {
                return getResourceIdentifier(item) !== defaultKey;
              }
              return item !== defaultValue;
            }),
          ];
        })()
      : items;

    return sortedItems.map((item, index) => {
      const isDefault =
        defaultValue &&
        ((typeof defaultValue === "string" &&
          getResourceIdentifier(item) === defaultValue) ||
          item === defaultValue);
      return emptyInputFormatter(item, index, !!isDefault);
    });
  }

  // キーワード検索関数を定義
  const getSearchableText = (item: T): string => {
    return searchKeys
      .map((key) => {
        const keys = key.split(".");
        let value: unknown = item;
        for (const k of keys) {
          if (value && typeof value === "object" && k in value) {
            value = (value as Record<string, unknown>)[k];
          } else {
            value = undefined;
            break;
          }
        }
        return value || "";
      })
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  // Step 1: スペース区切りキーワード検索（優先）
  const keywords = splitByWhitespace(input.trim().toLowerCase()).filter(
    (keyword) => keyword.length > 0,
  );

  if (keywords.length > 0) {
    // キーワード検索で絞り込み
    const keywordFiltered = items.filter((item) => {
      const searchableText = getSearchableText(item);
      // 全てのキーワードが含まれているかチェック
      return keywords.every((keyword) => searchableText.includes(keyword));
    });

    // キーワード検索で結果がある場合はそれを使用（絞り込み重視）
    if (keywordFiltered.length > 0) {
      return keywordFiltered
        .sort((a, b) => {
          // デフォルト値を優先
          if (defaultValue) {
            const aIsDefault =
              typeof defaultValue === "string"
                ? getResourceIdentifier(a) === defaultValue
                : a === defaultValue;
            const bIsDefault =
              typeof defaultValue === "string"
                ? getResourceIdentifier(b) === defaultValue
                : b === defaultValue;

            if (aIsDefault && !bIsDefault) return -1;
            if (!aIsDefault && bIsDefault) return 1;
          }

          // キーワードマッチの完全性でソート
          const aText = getSearchableText(a);
          const bText = getSearchableText(b);

          // 完全一致を優先
          const aExactMatches = keywords.filter((keyword) =>
            splitByWhitespace(aText).includes(keyword),
          ).length;
          const bExactMatches = keywords.filter((keyword) =>
            splitByWhitespace(bText).includes(keyword),
          ).length;

          if (aExactMatches !== bExactMatches) {
            return bExactMatches - aExactMatches;
          }

          // アルファベット順
          return aText.localeCompare(bText);
        })
        .map((item, index) => {
          const isDefault =
            defaultValue &&
            ((typeof defaultValue === "string" &&
              getResourceIdentifier(item) === defaultValue) ||
              item === defaultValue);
          return displayFormatter(item, index, !!isDefault);
        });
    }
  }

  // Step 2: キーワード検索で結果がない場合のみファジー検索（補助的）
  const fuseOptions = {
    keys: searchKeys,
    threshold,
    distance,
    includeScore: true,
    minMatchCharLength: 2, // 最小2文字
    findAllMatches: true,
  };

  const fuse = new Fuse(items, fuseOptions);
  const results = fuse.search(input);

  // ファジー検索結果を制限（最大10件）
  return results
    .slice(0, 10)
    .sort((a, b) => {
      // デフォルト値を優先
      if (defaultValue) {
        const aIsDefault =
          typeof defaultValue === "string"
            ? getResourceIdentifier(a.item) === defaultValue
            : a.item === defaultValue;
        const bIsDefault =
          typeof defaultValue === "string"
            ? getResourceIdentifier(b.item) === defaultValue
            : b.item === defaultValue;

        if (aIsDefault && !bIsDefault) return -1;
        if (!aIsDefault && bIsDefault) return 1;
      }
      return (a.score || 0) - (b.score || 0);
    })
    .map((result, index) => {
      const isDefault =
        defaultValue &&
        ((typeof defaultValue === "string" &&
          getResourceIdentifier(result.item) === defaultValue) ||
          result.item === defaultValue);
      return displayFormatter(result.item, index, !!isDefault, result.score);
    });
}

export function keywordSearch<T>(
  items: T[],
  input: string,
  searchFields: (item: T) => string[],
): T[] {
  if (!input || input.trim() === "") {
    return items;
  }

  // スペース区切りでキーワードを分割
  const keywords = splitByWhitespace(input.trim().toLowerCase()).filter(
    (keyword) => keyword.length > 0,
  );

  if (isEmpty(keywords)) {
    return items;
  }

  return items.filter((item) => {
    // 検索対象テキストを結合
    const searchableText = searchFields(item)
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // 全てのキーワードが含まれているかチェック
    return keywords.every((keyword) => searchableText.includes(keyword));
  });
}

export async function searchRegions(
  regions: AWSRegion[],
  input: string,
  defaultRegion?: string,
): Promise<SearchableItem[]> {
  const config: SearchConfig<AWSRegion> = {
    items: regions,
    searchKeys: ["regionName"],
    displayFormatter: (region, index, isDefault, score) => {
      const icon = index === 0 ? chalk.green("•") : "  ";
      const defaultLabel = isDefault ? chalk.cyan(" (default)") : "";
      const scoreLabel = score ? ` [${((1 - score) * 100).toFixed(0)}%]` : "";

      return {
        name: `${icon} ${region.regionName}${defaultLabel} ${chalk.dim(`(${region.optInStatus})${scoreLabel}`)}`,
        value: region.regionName,
      };
    },
    emptyInputFormatter: (region, index, isDefault) => {
      const icon = index === 0 && isDefault ? chalk.green("•") : "  ";
      const defaultLabel = isDefault ? chalk.cyan(" (default)") : "";

      return {
        name: `${icon} ${region.regionName}${defaultLabel} ${chalk.dim(`(${region.optInStatus})`)}`,
        value: region.regionName,
      };
    },
  };

  return universalSearch(config, input, defaultRegion);
}

export async function searchClusters(
  clusters: ECSCluster[],
  input: string,
): Promise<SearchableItem[]> {
  const config: SearchConfig<ECSCluster> = {
    items: clusters,
    searchKeys: ["clusterName"],
    displayFormatter: (cluster, index, _isDefault, score) => {
      const icon = index === 0 ? chalk.green("•") : "  ";
      const clusterShortName = cluster.clusterArn.split("/").pop();
      const scoreLabel = score ? ` [${((1 - score) * 100).toFixed(0)}%]` : "";

      return {
        name: `${icon} ${cluster.clusterName} ${chalk.dim(`(${clusterShortName})${scoreLabel}`)}`,
        value: cluster,
      };
    },
    emptyInputFormatter: (cluster, _index) => {
      const icon = "  ";
      const clusterShortName = cluster.clusterArn.split("/").pop();

      return {
        name: `${icon} ${cluster.clusterName} ${chalk.dim(`(${clusterShortName})`)}`,
        value: cluster,
      };
    },
  };

  return universalSearch(config, input);
}

export async function searchServices(
  services: import("./types.js").ECSService[],
  input: string,
): Promise<SearchableItem[]> {
  const config: SearchConfig<import("./types.js").ECSService> = {
    items: services,
    searchKeys: ["serviceName", "clusterName"],
    displayFormatter: (service, index, _isDefault, score) => {
      const icon = index === 0 ? chalk.green("•") : "  ";
      const statusIcon = service.status === "ACTIVE" ? "🟢" : "🟡";
      const scoreLabel = score ? ` [${((1 - score) * 100).toFixed(0)}%]` : "";
      const execStatus = service.enableExecuteCommand
        ? chalk.green("exec enabled")
        : chalk.red("exec disabled");

      return {
        name: `${icon} ${service.serviceName} ${chalk.dim(`(${service.clusterName}) ${statusIcon} ${service.runningCount}/${service.desiredCount} running - ${execStatus}${scoreLabel}`)}`,
        value: service,
      };
    },
    emptyInputFormatter: (service, _index) => {
      const icon = "  ";
      const statusIcon = service.status === "ACTIVE" ? "🟢" : "🟡";
      const execStatus = service.enableExecuteCommand
        ? chalk.green("exec enabled")
        : chalk.red("exec disabled");

      return {
        name: `${icon} ${service.serviceName} ${chalk.dim(`(${service.clusterName}) ${statusIcon} ${service.runningCount}/${service.desiredCount} running - ${execStatus}`)}`,
        value: service,
      };
    },
  };

  return universalSearch(config, input);
}

export async function searchTasks(
  tasks: ECSTask[],
  input: string,
): Promise<SearchableItem[]> {
  const config: SearchConfig<ECSTask> = {
    items: tasks,
    searchKeys: ["serviceName", "taskId", "displayName", "taskStatus"],
    displayFormatter: (task, index, _isDefault, score) => {
      const icon = index === 0 ? chalk.green("•") : "  ";
      const taskShortId = task.taskId.substring(0, 8);
      const scoreLabel = score ? ` [${((1 - score) * 100).toFixed(0)}%]` : "";

      return {
        name: `${icon} ${task.serviceName} ${chalk.dim(`(${taskShortId}...)${scoreLabel}`)}`,
        value: task.taskArn,
      };
    },
    emptyInputFormatter: (task) => {
      const taskShortId = task.taskId.substring(0, 8);

      return {
        name: `  ${task.serviceName} ${chalk.dim(`(${taskShortId}...)`)}`,
        value: task.taskArn,
      };
    },
  };

  return universalSearch(config, input);
}

export async function searchRDS(
  rdsInstances: RDSInstance[],
  input: string,
): Promise<SearchableItem[]> {
  const config: SearchConfig<RDSInstance> = {
    items: rdsInstances,
    searchKeys: ["dbInstanceIdentifier", "engine", "endpoint"],
    displayFormatter: (rds, index, _isDefault, score) => {
      const icon = index === 0 ? chalk.green("•") : "  ";
      const scoreLabel = score ? ` [${((1 - score) * 100).toFixed(0)}%]` : "";

      return {
        name: `${icon} (${rds.engine}): ${rds.dbInstanceIdentifier} ${chalk.dim(scoreLabel)}`,
        value: rds,
      };
    },
    emptyInputFormatter: (rds) => {
      return {
        name: `  (${rds.engine}): ${rds.dbInstanceIdentifier}`,
        value: rds,
      };
    },
  };

  return universalSearch(config, input);
}

export async function searchContainers(
  containers: string[],
  input: string,
): Promise<SearchableItem[]> {
  // 空の入力の場合
  if (!input || input.trim() === "") {
    return containers.map((container) => ({
      name: `  ${container}`,
      value: container,
    }));
  }

  // キーワード検索で絞り込み（優先）
  const filteredContainers = keywordSearch(containers, input, (container) => [
    container,
  ]);

  // キーワード検索で結果がある場合はそれを使用
  if (filteredContainers.length > 0) {
    return filteredContainers
      .sort((a, b) => a.localeCompare(b)) // アルファベット順
      .map((container, index) => {
        const icon = index === 0 ? chalk.green("•") : "  ";
        return {
          name: `${icon} ${container}`,
          value: container,
        };
      });
  }

  // キーワード検索で結果がない場合はファジー検索（補助的）
  const fuzzyMatches = containers.filter((container) =>
    container.toLowerCase().includes(input.toLowerCase()),
  );

  return fuzzyMatches
    .slice(0, 5) // 最大5件に制限
    .sort((a, b) => a.localeCompare(b))
    .map((container, index) => {
      const icon = index === 0 ? chalk.green("•") : "  ";
      return {
        name: `${icon} ${container} ${chalk.dim("[fuzzy]")}`,
        value: container,
      };
    });
}

export async function searchInferenceResults(
  results: InferenceResult[],
  input: string,
): Promise<SearchableItem[]> {
  // 空の入力の場合
  if (!input || input.trim() === "") {
    return results.map((result) => {
      const isUnavailable = result.reason.includes("接続不可");
      return {
        name: `  ${formatInferenceResult(result)}`,
        value: result,
        disabled: isUnavailable ? "Task stopped - Cannot select" : undefined,
      };
    });
  }

  // キーワード検索で絞り込み（優先）
  const keywordFiltered = keywordSearch(results, input, (result) => [
    result.cluster.clusterName,
    result.task.displayName,
    result.task.serviceName,
    result.task.taskStatus,
    result.task.runtimeId,
    result.confidence,
    result.method,
    result.reason,
    formatInferenceResult(result),
    // 信頼度レベルの日本語対応
    result.confidence === "high" ? "high 高" : "",
    result.confidence === "medium" ? "medium 中" : "",
    result.confidence === "low" ? "low 低" : "",
  ]);

  // キーワード検索で結果がある場合はそれを使用
  if (keywordFiltered.length > 0) {
    return keywordFiltered
      .sort((a, b) => {
        // 信頼度でソート（high > medium > low）
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        const confidenceDiff =
          confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
        if (confidenceDiff !== 0) return confidenceDiff;

        // スコアでソート
        return b.score - a.score;
      })
      .map((result, index) => {
        const icon = index === 0 ? chalk.green("•") : "  ";
        const isUnavailable = result.reason.includes("接続不可");

        return {
          name: `${icon} ${formatInferenceResult(result)}`,
          value: result,
          disabled: isUnavailable ? "Task stopped - Cannot select" : undefined,
        };
      });
  }

  // キーワード検索で結果がない場合は制限されたファジー検索（補助的）
  const config: SearchConfig<InferenceResult> = {
    items: results,
    searchKeys: [
      "cluster.clusterName",
      "task.displayName",
      "task.serviceName",
      "confidence",
    ],
    displayFormatter: (result, index, _isDefault, score) => {
      const icon = index === 0 ? chalk.green("•") : "  ";
      const scoreLabel = score ? ` [${((1 - score) * 100).toFixed(0)}%]` : "";
      const isUnavailable = result.reason.includes("接続不可");

      return {
        name: `${icon} ${formatInferenceResult(result)} ${chalk.dim(`[fuzzy]${scoreLabel}`)}`,
        value: result,
        disabled: isUnavailable ? "Task stopped - Cannot select" : undefined,
      };
    },
  };

  return universalSearch(config, input);
}
