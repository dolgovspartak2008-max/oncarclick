import { describe, expect, test } from "vitest";
import { isSyncAuthorized } from "./route";

describe("catalog sync authorization", () => {
  test("allows Vercel cron when no secret is configured", () => {
    expect(isSyncAuthorized(new Headers(), undefined)).toBe(true);
  });

  test("requires the configured bearer secret", () => {
    expect(isSyncAuthorized(new Headers(), "secret")).toBe(false);
    expect(isSyncAuthorized(new Headers({ authorization: "Bearer secret" }), "secret")).toBe(true);
  });
});
