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
    expect(script).toContain("oncarclick-catalog-cache-v6");
  });
});

describe("favorites", () => {
  test("has a favorites page and a header link on every page", async () => {
    const page = await readFile("public/favorites.html", "utf8");
    expect(page).toContain("favorites-page.js");
    for (const file of ["public/index.html", "public/catalog.html", "public/favorites.html"]) {
      expect(await readFile(file, "utf8")).toContain('href="favorites.html"');
    }
  });

  test("uses the brand logo file everywhere", async () => {
    for (const file of ["public/index.html", "public/catalog.html", "public/favorites.html"]) {
      expect(await readFile(file, "utf8")).toContain("assets/img/logo-mark.svg");
    }
  });
});

describe("car page", () => {
  test("catalog cards open the car page instead of the contact form", async () => {
    const script = await readFile("public/js/catalog.js", "utf8");
    expect(script).toContain("car.html?id=");
    const page = await readFile("public/car.html", "utf8");
    expect(page).toContain("js/car.js");
    expect(page).toContain('id="lightbox"');
  });
});
