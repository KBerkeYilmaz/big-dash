import { Pool } from "pg";

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  defaultValue: string | null;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
}

export interface SchemaInfo {
  tables: TableInfo[];
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

/**
 * Introspect a PostgreSQL database schema
 * Returns information about all tables in the public schema
 */
export async function introspectPostgresSchema(
  config: PostgresConfig
): Promise<SchemaInfo> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Get all tables in the public schema
    const tablesResult = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: TableInfo[] = [];

    for (const row of tablesResult.rows) {
      const tableName = row.table_name;

      // Get columns for this table
      const columnsResult = await pool.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>(
        `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `,
        [tableName]
      );

      // Get primary key columns
      const pkResult = await pool.query<{ column_name: string }>(
        `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
        ORDER BY kcu.ordinal_position
      `,
        [tableName]
      );

      const columns: ColumnInfo[] = columnsResult.rows.map((col) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === "YES",
        hasDefault: col.column_default !== null,
        defaultValue: col.column_default,
      }));

      const primaryKey = pkResult.rows.map((pk) => pk.column_name);

      tables.push({
        name: tableName,
        columns,
        primaryKey,
      });
    }

    return { tables };
  } finally {
    await pool.end();
  }
}

/**
 * Get row count for a table
 */
export async function getTableRowCount(
  config: PostgresConfig,
  tableName: string
): Promise<number> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    query_timeout: 5000,
  });

  try {
    // Use estimate for large tables, exact count for small ones
    const estimateResult = await pool.query<{ estimate: string }>(
      `
      SELECT reltuples::bigint AS estimate
      FROM pg_class
      WHERE relname = $1
    `,
      [tableName]
    );

    const estimate = parseInt(estimateResult.rows[0]?.estimate ?? "0", 10);

    // If estimate is small, get exact count
    if (estimate < 10000) {
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM "${tableName}"`
      );
      return parseInt(countResult.rows[0]?.count ?? "0", 10);
    }

    return estimate;
  } finally {
    await pool.end();
  }
}
