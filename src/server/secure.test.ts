import { describe, expect, test } from "vitest";
import { clientIp, hashIp, safeEqual } from "./secure";

describe("safeEqual", () => {
  test("совпадающие строки", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
  });

  test("разные строки и разная длина", () => {
    expect(safeEqual("secret", "secreT")).toBe(false);
    expect(safeEqual("secret", "secret2")).toBe(false);
  });

  test("пустые значения никогда не совпадают", () => {
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(false);
    expect(safeEqual(null, "secret")).toBe(false);
  });
});

describe("clientIp", () => {
  test("берёт первое значение x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  test("иначе x-real-ip, иначе null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("hashIp", () => {
  test("стабильный hex-хеш, не содержит IP, зависит от секрета", () => {
    const hash = hashIp("1.2.3.4", "s1");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashIp("1.2.3.4", "s1"));
    expect(hash).not.toBe(hashIp("1.2.3.4", "s2"));
    expect(hash).not.toContain("1.2.3.4");
  });

  test("без IP — null", () => {
    expect(hashIp(null, "s1")).toBeNull();
  });
});
