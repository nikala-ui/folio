import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { folioDependencyRange, type FolioManifest } from "../src/cli/init/dependency-ranges.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folio = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as FolioManifest;
const registryDir = path.join(packageRoot, "src/registry");

describe("folio init dependency ranges", () => {
  test("prefers dependencies, then devDependencies, then peerDependencies", () => {
    const manifest: FolioManifest = {
      version: "1.0.0",
      dependencies: { a: "^1.0.0" },
      devDependencies: { a: "^2.0.0", b: "^2.0.0" },
      peerDependencies: { a: ">=3.0.0", b: ">=3.0.0", c: ">=3.0.0" },
    };
    expect(folioDependencyRange(manifest, "a")).toBe("^1.0.0");
    expect(folioDependencyRange(manifest, "b")).toBe("^2.0.0");
    expect(folioDependencyRange(manifest, "c")).toBe(">=3.0.0");
  });

  test("refuses to guess a version for a package Folio does not declare", () => {
    expect(() => folioDependencyRange(folio, "not-a-folio-package")).toThrow(/not-a-folio-package/);
  });

  test("every package init can add resolves to a pinned range, never latest", () => {
    const registryDependencies = readdirSync(registryDir)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => (JSON.parse(readFileSync(path.join(registryDir, name), "utf8")) as { dependencies?: string[] }).dependencies ?? []);
    const added = new Set(["fs-extra", "@types/fs-extra", "@types/node", "typescript", "solid-js", "tailwindcss", ...registryDependencies]);
    for (const name of added) {
      const range = folioDependencyRange(folio, name);
      expect(range, name).not.toBe("latest");
      expect(range, name).toMatch(/\d/);
    }
  });

  test("solid-js resolves to the tested 1.x range, not the wide peer range", () => {
    expect(folioDependencyRange(folio, "solid-js")).toBe(folio.devDependencies?.["solid-js"]);
    expect(folioDependencyRange(folio, "solid-js")).toMatch(/^\^1\./);
  });
});
