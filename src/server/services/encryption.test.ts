import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt, isValidKey } from "./encryption";

describe("encryption service", () => {
  const testKey = "a".repeat(64); // Valid 64 hex char key

  beforeAll(() => {
    // Set test encryption key
    process.env.ENCRYPTION_KEY = testKey;
  });

  describe("isValidKey", () => {
    it("returns true for valid 64 hex character key", () => {
      expect(isValidKey("a".repeat(64))).toBe(true);
      expect(isValidKey("0123456789abcdef".repeat(4))).toBe(true);
    });

    it("returns false for invalid keys", () => {
      expect(isValidKey("")).toBe(false);
      expect(isValidKey("a".repeat(63))).toBe(false); // Too short
      expect(isValidKey("a".repeat(65))).toBe(false); // Too long
      expect(isValidKey("g".repeat(64))).toBe(false); // Invalid hex
      expect(isValidKey("ABCDEF".repeat(10) + "1234")).toBe(true); // Uppercase hex is valid
    });
  });

  describe("encrypt", () => {
    it("encrypts a string and returns a formatted cipher text", () => {
      const plaintext = "my-secret-password";
      const encrypted = encrypt(plaintext);

      // Format should be: iv:authTag:ciphertext (all hex)
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // 16 bytes IV = 32 hex chars
      expect(parts[1]).toHaveLength(32); // 16 bytes auth tag = 32 hex chars
      expect(parts[2]!.length).toBeGreaterThan(0); // Ciphertext
    });

    it("produces different ciphertext for same plaintext (random IV)", () => {
      const plaintext = "same-password";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("handles empty string", () => {
      const encrypted = encrypt("");
      expect(encrypted).toBeDefined();
      expect(encrypted.split(":")).toHaveLength(3);
    });

    it("handles unicode characters", () => {
      const plaintext = "пароль🔐密码";
      const encrypted = encrypt(plaintext);
      expect(encrypted.split(":")).toHaveLength(3);
    });

    it("handles long strings", () => {
      const plaintext = "x".repeat(10000);
      const encrypted = encrypt(plaintext);
      expect(encrypted.split(":")).toHaveLength(3);
    });
  });

  describe("decrypt", () => {
    it("decrypts encrypted text back to original", () => {
      const plaintext = "my-secret-password";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles empty string round-trip", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles unicode round-trip", () => {
      const plaintext = "пароль🔐密码";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles long strings round-trip", () => {
      const plaintext = "x".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("throws on tampered ciphertext", () => {
      const encrypted = encrypt("secret");
      const parts = encrypted.split(":");
      // Tamper with the ciphertext
      const tampered = `${parts[0]}:${parts[1]}:${"ff".repeat(parts[2]!.length / 2)}`;

      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws on tampered auth tag", () => {
      const encrypted = encrypt("secret");
      const parts = encrypted.split(":");
      // Tamper with the auth tag
      const tampered = `${parts[0]}:${"00".repeat(16)}:${parts[2]}`;

      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws on invalid format", () => {
      expect(() => decrypt("invalid")).toThrow();
      expect(() => decrypt("a:b")).toThrow();
      expect(() => decrypt("")).toThrow();
    });
  });

  describe("encrypt/decrypt with special characters", () => {
    const testCases = [
      "password with spaces",
      "special!@#$%^&*()chars",
      '{"json": "data", "nested": {"key": "value"}}',
      "line1\nline2\ttabbed",
      "null\x00byte",
    ];

    testCases.forEach((testCase) => {
      it(`handles: ${testCase.slice(0, 30)}...`, () => {
        const encrypted = encrypt(testCase);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(testCase);
      });
    });
  });
});
