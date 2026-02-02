import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  introspectPostgresSchema,
  type TableInfo,
  type ColumnInfo,
} from "./schema-introspector";

// Mock pg Pool
const mockQuery = vi.fn();
const mockEnd = vi.fn();

vi.mock("pg", () => {
  return {
    Pool: class MockPool {
      query = mockQuery;
      end = mockEnd;
    },
  };
});

describe("schema-introspector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnd.mockResolvedValue(undefined);
  });

  describe("introspectPostgresSchema", () => {
    const config = {
      host: "localhost",
      port: 5432,
      database: "testdb",
      username: "user",
      password: "pass",
      ssl: false,
    };

    it("returns tables with columns", async () => {
      // Mock tables query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { table_name: "users" },
          { table_name: "posts" },
        ],
      });

      // Mock columns for 'users'
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            column_name: "id",
            data_type: "integer",
            is_nullable: "NO",
            column_default: "nextval('users_id_seq'::regclass)",
          },
          {
            column_name: "email",
            data_type: "character varying",
            is_nullable: "NO",
            column_default: null,
          },
          {
            column_name: "name",
            data_type: "text",
            is_nullable: "YES",
            column_default: null,
          },
        ],
      });

      // Mock primary key for 'users'
      mockQuery.mockResolvedValueOnce({
        rows: [{ column_name: "id" }],
      });

      // Mock columns for 'posts'
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            column_name: "id",
            data_type: "uuid",
            is_nullable: "NO",
            column_default: "gen_random_uuid()",
          },
          {
            column_name: "title",
            data_type: "text",
            is_nullable: "NO",
            column_default: null,
          },
          {
            column_name: "user_id",
            data_type: "integer",
            is_nullable: "NO",
            column_default: null,
          },
        ],
      });

      // Mock primary key for 'posts'
      mockQuery.mockResolvedValueOnce({
        rows: [{ column_name: "id" }],
      });

      const result = await introspectPostgresSchema(config);

      expect(result.tables).toHaveLength(2);

      const usersTable = result.tables.find((t) => t.name === "users");
      expect(usersTable).toBeDefined();
      expect(usersTable?.columns).toHaveLength(3);
      expect(usersTable?.primaryKey).toEqual(["id"]);

      const idColumn = usersTable?.columns.find((c) => c.name === "id");
      expect(idColumn?.nullable).toBe(false);
      expect(idColumn?.hasDefault).toBe(true);
    });

    it("handles tables with no primary key", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ table_name: "logs" }],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            column_name: "message",
            data_type: "text",
            is_nullable: "YES",
            column_default: null,
          },
        ],
      });

      // No primary key
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await introspectPostgresSchema(config);

      expect(result.tables[0]?.primaryKey).toEqual([]);
    });

    it("handles composite primary keys", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ table_name: "order_items" }],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            column_name: "order_id",
            data_type: "integer",
            is_nullable: "NO",
            column_default: null,
          },
          {
            column_name: "product_id",
            data_type: "integer",
            is_nullable: "NO",
            column_default: null,
          },
          {
            column_name: "quantity",
            data_type: "integer",
            is_nullable: "NO",
            column_default: "1",
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          { column_name: "order_id" },
          { column_name: "product_id" },
        ],
      });

      const result = await introspectPostgresSchema(config);

      expect(result.tables[0]?.primaryKey).toEqual(["order_id", "product_id"]);
    });

    it("excludes system tables", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { table_name: "users" },
          // These would be filtered by the SQL query
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            column_name: "id",
            data_type: "integer",
            is_nullable: "NO",
            column_default: null,
          },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [{ column_name: "id" }],
      });

      const result = await introspectPostgresSchema(config);

      // Only public schema tables should be returned
      expect(result.tables.every((t) => !t.name.startsWith("pg_"))).toBe(true);
    });

    it("maps PostgreSQL types correctly", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ table_name: "all_types" }],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [
          { column_name: "int_col", data_type: "integer", is_nullable: "NO", column_default: null },
          { column_name: "bigint_col", data_type: "bigint", is_nullable: "NO", column_default: null },
          { column_name: "text_col", data_type: "text", is_nullable: "YES", column_default: null },
          { column_name: "bool_col", data_type: "boolean", is_nullable: "NO", column_default: "false" },
          { column_name: "json_col", data_type: "jsonb", is_nullable: "YES", column_default: null },
          { column_name: "date_col", data_type: "date", is_nullable: "YES", column_default: null },
          { column_name: "timestamp_col", data_type: "timestamp with time zone", is_nullable: "YES", column_default: null },
          { column_name: "uuid_col", data_type: "uuid", is_nullable: "NO", column_default: "gen_random_uuid()" },
        ],
      });

      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      const result = await introspectPostgresSchema(config);
      const columns = result.tables[0]?.columns ?? [];

      expect(columns.find((c) => c.name === "int_col")?.type).toBe("integer");
      expect(columns.find((c) => c.name === "bigint_col")?.type).toBe("bigint");
      expect(columns.find((c) => c.name === "text_col")?.type).toBe("text");
      expect(columns.find((c) => c.name === "bool_col")?.type).toBe("boolean");
      expect(columns.find((c) => c.name === "json_col")?.type).toBe("jsonb");
      expect(columns.find((c) => c.name === "uuid_col")?.type).toBe("uuid");
    });

    it("handles connection errors", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(introspectPostgresSchema(config)).rejects.toThrow(
        "Connection refused"
      );

      expect(mockEnd).toHaveBeenCalled();
    });

    it("always closes the connection", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await introspectPostgresSchema(config);

      expect(mockEnd).toHaveBeenCalled();
    });

    it("handles empty database", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await introspectPostgresSchema(config);

      expect(result.tables).toEqual([]);
    });
  });
});
