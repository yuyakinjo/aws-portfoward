/**
 * Get default port for each DB engine
 */
export function getDefaultPortForEngine(engine: string): number {
  const engineLower = engine.toLowerCase();

  if (engineLower.includes("mysql") || engineLower.includes("mariadb")) {
    return 3306;
  } else if (engineLower.includes("postgres")) {
    return 5432;
  } else if (engineLower.includes("oracle")) {
    return 1521;
  } else if (
    engineLower.includes("sqlserver") ||
    engineLower.includes("mssql")
  ) {
    return 1433;
  } else if (engineLower.includes("aurora-mysql")) {
    return 3306;
  } else if (engineLower.includes("aurora-postgresql")) {
    return 5432;
  } else {
    // Default to PostgreSQL port
    return 5432;
  }
}
