// =============================================================================
// 正規表現パターン定義 - 一元管理
// =============================================================================

/**
 * 数字のみを許可する正規表現
 * ポート番号の検証に使用
 */
export const DIGITS_ONLY = /^\d+$/;

/**
 * AWS リージョン名の形式を検証する正規表現
 * 小文字、数字、ハイフンのみ許可
 */
export const AWS_REGION_NAME = /^[a-z0-9-]+$/;

/**
 * データベースエンドポイントの形式を検証する正規表現
 * 英数字、ドット、ハイフンを許可
 */
export const DB_ENDPOINT_FORMAT = /^[a-zA-Z0-9.-]+$/;

/**
 * 空白文字（スペース、タブ等）で分割するための正規表現
 * キーワード検索で使用
 */
export const WHITESPACE_SPLIT = /\s+/;

/**
 * ハイフンとアンダースコアで分割するための正規表現
 * RDS名からクラスター名を推論する際に使用
 */
export const HYPHEN_UNDERSCORE_SPLIT = /[-_]/;

/**
 * ハイフン、アンダースコア、空白文字で分割するための正規表現
 * RDS名からクラスター名を推論する際の単語分割に使用
 */
export const WORD_SEPARATOR_SPLIT = /[-_\s]/;

// =============================================================================
// 正規表現パターンのテスト関数
// =============================================================================

/**
 * 文字列が数字のみかどうかをテストする
 */
export function isDigitsOnly(value: string): boolean {
  return DIGITS_ONLY.test(value);
}

/**
 * AWS リージョン名の形式が正しいかテストする
 */
export function isValidRegionName(value: string): boolean {
  return AWS_REGION_NAME.test(value);
}

/**
 * データベースエンドポイントの形式が正しいかテストする
 */
export function isValidDbEndpoint(value: string): boolean {
  return DB_ENDPOINT_FORMAT.test(value);
}

// =============================================================================
// 文字列分割ユーティリティ関数
// =============================================================================

/**
 * 空白文字で文字列を分割し、空の要素を除去する
 */
export function splitByWhitespace(text: string): string[] {
  return text.split(WHITESPACE_SPLIT).filter(Boolean);
}

/**
 * ハイフンとアンダースコアで文字列を分割する
 */
export function splitByHyphenUnderscore(text: string): string[] {
  return text.split(HYPHEN_UNDERSCORE_SPLIT);
}

/**
 * ハイフン、アンダースコア、空白文字で文字列を分割する
 */
export function splitByWordSeparators(text: string): string[] {
  return text.split(WORD_SEPARATOR_SPLIT);
}
