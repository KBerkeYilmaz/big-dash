import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeSelect,
  executeInsert,
  executeUpdate,
  executeDelete,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildDeleteQuery,
} from "./query-executor";

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

describe("query-executor", () => {
  const config = {
    host: "localhost",
    port: 5432,
    database: "testdb",
    username: "user",
    password: "pass",
    ssl: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnd.mockResolvedValue(undefined);
  });

  describe("buildSelectQuery", () => {
    it("builds basic select query", () => {
      const result = buildSelectQuery({
        table: "users",
        columns: ["id", "name", "email"],
      });

      expect(result.sql).toBe('SELECT "id", "name", "email" FROM "users" LIMIT 1000');
      expect(result.params).toEqual([]);
    });

    it("builds select with where clause", () => {
      const result = buildSelectQuery({
        table: "users",
        columns: ["id", "name"],
        where: { id: 1, active: true },
      });

      expect(result.sql).toBe(
        'SELECT "id", "name" FROM "users" WHERE "id" = $1 AND "active" = $2 LIMIT 1000'
      );
      expect(result.params).toEqual([1, true]);
    });

    it("builds select with ordering", () => {
      const result = buildSelectQuery({
        table: "users",
        columns: ["*"],
        orderBy: [{ column: "created_at", direction: "DESC" }],
      });

      expect(result.sql).toBe(
        'SELECT * FROM "users" ORDER BY "created_at" DESC LIMIT 1000'
      );
    });

    it("builds select with pagination", () => {
      const result = buildSelectQuery({
        table: "users",
        columns: ["*"],
        limit: 10,
        offset: 20,
      });

      expect(result.sql).toBe('SELECT * FROM "users" LIMIT 10 OFFSET 20');
    });

    it("builds complex select query", () => {
      const result = buildSelectQuery({
        table: "posts",
        columns: ["id", "title", "created_at"],
        where: { published: true },
        orderBy: [
          { column: "created_at", direction: "DESC" },
          { column: "title", direction: "ASC" },
        ],
        limit: 25,
        offset: 0,
      });

      expect(result.sql).toBe(
        'SELECT "id", "title", "created_at" FROM "posts" WHERE "published" = $1 ORDER BY "created_at" DESC, "title" ASC LIMIT 25 OFFSET 0'
      );
      expect(result.params).toEqual([true]);
    });

    it("handles null values in where clause", () => {
      const result = buildSelectQuery({
        table: "users",
        columns: ["*"],
        where: { deleted_at: null },
      });

      expect(result.sql).toBe(
        'SELECT * FROM "users" WHERE "deleted_at" IS NULL LIMIT 1000'
      );
      expect(result.params).toEqual([]);
    });
  });

  describe("buildInsertQuery", () => {
    it("builds insert query", () => {
      const result = buildInsertQuery({
        table: "users",
        data: { name: "John", email: "john@example.com" },
      });

      expect(result.sql).toBe(
        'INSERT INTO "users" ("name", "email") VALUES ($1, $2) RETURNING *'
      );
      expect(result.params).toEqual(["John", "john@example.com"]);
    });

    it("handles empty data", () => {
      expect(() =>
        buildInsertQuery({
          table: "users",
          data: {},
        })
      ).toThrow("No data provided for insert");
    });
  });

  describe("buildUpdateQuery", () => {
    it("builds update query", () => {
      const result = buildUpdateQuery({
        table: "users",
        data: { name: "Jane", updated_at: new Date("2024-01-01") },
        where: { id: 1 },
      });

      expect(result.sql).toBe(
        'UPDATE "users" SET "name" = $1, "updated_at" = $2 WHERE "id" = $3 RETURNING *'
      );
      expect(result.params).toEqual(["Jane", new Date("2024-01-01"), 1]);
    });

    it("requires where clause", () => {
      expect(() =>
        buildUpdateQuery({
          table: "users",
          data: { name: "Jane" },
          where: {},
        })
      ).toThrow("WHERE clause required for update");
    });
  });

  describe("buildDeleteQuery", () => {
    it("builds delete query", () => {
      const result = buildDeleteQuery({
        table: "users",
        where: { id: 1 },
      });

      expect(result.sql).toBe('DELETE FROM "users" WHERE "id" = $1 RETURNING *');
      expect(result.params).toEqual([1]);
    });

    it("requires where clause", () => {
      expect(() =>
        buildDeleteQuery({
          table: "users",
          where: {},
        })
      ).toThrow("WHERE clause required for delete");
    });
  });

  describe("executeSelect", () => {
    it("executes select and returns rows", async () => {
      const mockRows = [
        { id: 1, name: "John" },
        { id: 2, name: "Jane" },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

      const result = await executeSelect(config, {
        table: "users",
        columns: ["id", "name"],
      });

      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(2);
    });

    it("respects row limit", async () => {
      const manyRows = Array.from({ length: 1500 }, (_, i) => ({ id: i }));
      mockQuery.mockResolvedValueOnce({ rows: manyRows, rowCount: 1500 });

      const result = await executeSelect(config, {
        table: "users",
        columns: ["*"],
        limit: 2000, // User requests more than max
      });

      // Should cap at 1000
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("LIMIT 1000"),
        })
      );
    });
  });

  describe("executeInsert", () => {
    it("executes insert and returns created row", async () => {
      const newRow = { id: 1, name: "John", email: "john@example.com" };
      mockQuery.mockResolvedValueOnce({ rows: [newRow], rowCount: 1 });

      const result = await executeInsert(config, {
        table: "users",
        data: { name: "John", email: "john@example.com" },
      });

      expect(result.row).toEqual(newRow);
    });
  });

  describe("executeUpdate", () => {
    it("executes update and returns updated rows", async () => {
      const updatedRow = { id: 1, name: "Jane" };
      mockQuery.mockResolvedValueOnce({ rows: [updatedRow], rowCount: 1 });

      const result = await executeUpdate(config, {
        table: "users",
        data: { name: "Jane" },
        where: { id: 1 },
      });

      expect(result.rows).toEqual([updatedRow]);
      expect(result.rowCount).toBe(1);
    });
  });

  describe("executeDelete", () => {
    it("executes delete and returns deleted rows", async () => {
      const deletedRow = { id: 1, name: "John" };
      mockQuery.mockResolvedValueOnce({ rows: [deletedRow], rowCount: 1 });

      const result = await executeDelete(config, {
        table: "users",
        where: { id: 1 },
      });

      expect(result.rows).toEqual([deletedRow]);
      expect(result.rowCount).toBe(1);
    });
  });

  describe("security", () => {
    it("escapes table names", () => {
      const result = buildSelectQuery({
        table: 'users"; DROP TABLE users; --',
        columns: ["*"],
      });

      // Table name should be quoted
      expect(result.sql).toContain('"users\\"; DROP TABLE users; --"');
    });

    it("escapes column names", () => {
      const result = buildSelectQuery({
        table: "users",
        columns: ['name"; DROP TABLE users; --'],
      });

      expect(result.sql).toContain('"name\\"; DROP TABLE users; --"');
    });

    it("uses parameterized values", () => {
      const result = buildSelectQuery({
        table: "users",
        columns: ["*"],
        where: { name: "'; DROP TABLE users; --" },
      });

      // Value should be a parameter, not in SQL
      expect(result.sql).not.toContain("DROP TABLE");
      expect(result.params).toContain("'; DROP TABLE users; --");
    });
  });
});
