import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

describe("static catalog page", () => {
  test("loads the live client instead of demo inventory", async () => {
    const html = await readFile("public/catalog.html", "utf8");
    expect(html).not.toContain("cars-data.js");
    expect(html).toContain("catalog-model.js");
    expect(html).toContain('id="loadMore"');
  });

  test("requests the server catalog and renders real images", async () => {
    const script = await readFile("public/js/catalog.js", "utf8");
    expect(script).toContain("fetch(");
    expect(script).toContain("car__photo");
    expect(script).toContain("oncarclick-catalog-cache-v1");
  });
});
