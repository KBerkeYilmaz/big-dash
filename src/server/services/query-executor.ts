import { Pool } from "pg";

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface SelectOptions {
  table: string;
  columns: string[];
  where?: Record<string, unknown>;
  orderBy?: Array<{ column: string; direction: "ASC" | "DESC" }>;
  limit?: number;
  offset?: number;
}

export interface InsertOptions {
  table: string;
  data: Record<string, unknown>;
}

export interface UpdateOptions {
  table: string;
  data: Record<string, unknown>;
  where: Record<string, unknown>;
}

export interface DeleteOptions {
  table: string;
  where: Record<string, unknown>;
}

export interface QueryResult<T = Record<string, unknown>> {
  sql: string;
  params: unknown[];
}

export interface SelectResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface InsertResult {
  row: Record<string, unknown>;
}

export interface UpdateResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface DeleteResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

// Maximum rows per query for safety
const MAX_ROWS = 1000;
// Query timeout in milliseconds
const QUERY_TIMEOUT = 30000;

/**
 * Escape an identifier (table name, column name) for safe use in SQL
 */
function escapeIdentifier(identifier: string): string {
  // Replace any double quotes with escaped double quotes
  return `"${identifier.replace(/"/g, '\\"')}"`;
}

/**
 * Build WHERE clause from object
 */
function buildWhereClause(
  where: Record<string, unknown>,
  startParamIndex: number
): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = startParamIndex;

  for (const [key, value] of Object.entries(where)) {
    if (value === null) {
      conditions.push(`${escapeIdentifier(key)} IS NULL`);
    } else {
      conditions.push(`${escapeIdentifier(key)} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

/**
 * Build a SELECT query
 */
export function buildSelectQuery(options: SelectOptions): QueryResult {
  const columns =
    options.columns[0] === "*"
      ? "*"
      : options.columns.map(escapeIdentifier).join(", ");

  let sql = `SELECT ${columns} FROM ${escapeIdentifier(options.table)}`;
  const params: unknown[] = [];

  // WHERE clause
  if (options.where && Object.keys(options.where).length > 0) {
    const whereResult = buildWhereClause(options.where, 1);
    sql += ` ${whereResult.clause}`;
    params.push(...whereResult.params);
  }

  // ORDER BY clause
  if (options.orderBy && options.orderBy.length > 0) {
    const orderClauses = options.orderBy.map(
      (o) => `${escapeIdentifier(o.column)} ${o.direction}`
    );
    sql += ` ORDER BY ${orderClauses.join(", ")}`;
  }

  // LIMIT clause (capped at MAX_ROWS)
  const limit = Math.min(options.limit ?? MAX_ROWS, MAX_ROWS);
  sql += ` LIMIT ${limit}`;

  // OFFSET clause
  if (options.offset !== undefined) {
    sql += ` OFFSET ${options.offset}`;
  }

  return { sql, params };
}

/**
 * Build an INSERT query
 */
export function buildInsertQuery(options: InsertOptions): QueryResult {
  const entries = Object.entries(options.data);

  if (entries.length === 0) {
    throw new Error("No data provided for insert");
  }

  const columns = entries.map(([key]) => escapeIdentifier(key)).join(", ");
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
  const params = entries.map(([, value]) => value);

  const sql = `INSERT INTO ${escapeIdentifier(options.table)} (${columns}) VALUES (${placeholders}) RETURNING *`;

  return { sql, params };
}

/**
 * Build an UPDATE query
 */
export function buildUpdateQuery(options: UpdateOptions): QueryResult {
  const dataEntries = Object.entries(options.data);
  const whereEntries = Object.entries(options.where);

  if (dataEntries.length === 0) {
    throw new Error("No data provided for update");
  }

  if (whereEntries.length === 0) {
    throw new Error("WHERE clause required for update");
  }

  const setClauses = dataEntries.map(
    ([key], i) => `${escapeIdentifier(key)} = $${i + 1}`
  );
  const params = dataEntries.map(([, value]) => value);

  const whereResult = buildWhereClause(options.where, params.length + 1);
  params.push(...whereResult.params);

  const sql = `UPDATE ${escapeIdentifier(options.table)} SET ${setClauses.join(", ")} ${whereResult.clause} RETURNING *`;

  return { sql, params };
}

/**
 * Build a DELETE query
 */
export function buildDeleteQuery(options: DeleteOptions): QueryResult {
  const whereEntries = Object.entries(options.where);

  if (whereEntries.length === 0) {
    throw new Error("WHERE clause required for delete");
  }

  const whereResult = buildWhereClause(options.where, 1);

  const sql = `DELETE FROM ${escapeIdentifier(options.table)} ${whereResult.clause} RETURNING *`;

  return { sql, params: whereResult.params };
}

/**
 * Create a connection pool with standard settings
 */
function createPool(config: PostgresConfig): Pool {
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    query_timeout: QUERY_TIMEOUT,
  });
}

/**
 * Execute a SELECT query
 */
export async function executeSelect(
  config: PostgresConfig,
  options: SelectOptions
): Promise<SelectResult> {
  const pool = createPool(config);

  try {
    const { sql, params } = buildSelectQuery(options);
    const result = await pool.query({ text: sql, values: params });

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    };
  } finally {
    await pool.end();
  }
}

/**
 * Execute an INSERT query
 */
export async function executeInsert(
  config: PostgresConfig,
  options: InsertOptions
): Promise<InsertResult> {
  const pool = createPool(config);

  try {
    const { sql, params } = buildInsertQuery(options);
    const result = await pool.query({ text: sql, values: params });

    return {
      row: result.rows[0] as Record<string, unknown>,
    };
  } finally {
    await pool.end();
  }
}

/**
 * Execute an UPDATE query
 */
export async function executeUpdate(
  config: PostgresConfig,
  options: UpdateOptions
): Promise<UpdateResult> {
  const pool = createPool(config);

  try {
    const { sql, params } = buildUpdateQuery(options);
    const result = await pool.query({ text: sql, values: params });

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    };
  } finally {
    await pool.end();
  }
}

/**
 * Execute a DELETE query
 */
export async function executeDelete(
  config: PostgresConfig,
  options: DeleteOptions
): Promise<DeleteResult> {
  const pool = createPool(config);

  try {
    const { sql, params } = buildDeleteQuery(options);
    const result = await pool.query({ text: sql, values: params });

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    };
  } finally {
    await pool.end();
  }
}
