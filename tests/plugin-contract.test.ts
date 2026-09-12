import { describe, expect, test } from "bun:test";
import { defineDocsConfig } from "../src/config.js";
import {
  createFolioPlugin,
  defineFolioPlugin,
  validateFolioPlugins,
} from "../src/plugin.js";
import { nikalaDocsPlugin } from "../src/server/plugin.js";
import type { FolioPlugin } from "../src/plugin.js";

describe("public Folio plugin contract", () => {
  test("keeps plugin-less configs compatible", () => {
    const config = defineDocsConfig({ title: "Docs" });
    expect(config.plugins).toBeUndefined();
  });

  test("validates plugin registration and rejects duplicates", () => {
    const plugin = defineFolioPlugin({ name: "example" });
    expect(plugin.name).toBe("example");
    expect(() => defineFolioPlugin({ name: "   " })).toThrow("non-empty name");
    expect(() => validateFolioPlugins([{ name: "same" }, { name: "same" }])).toThrow(
      "registered more than once",
    );
    expect(() => defineDocsConfig({ plugins: [{ name: 42 } as never] })).toThrow(
      "non-empty name",
    );
  });

  test("validates factory results before registration", () => {
    const plugin = createFolioPlugin(() => ({ name: "factory-plugin" }));
    expect(plugin.name).toBe("factory-plugin");
    expect(createFolioPlugin((options: { prefix: string }) => ({ name: options.prefix }), { prefix: "configured" }).name)
      .toBe("configured");
    expect(() => createFolioPlugin(() => ({ name: "" }))).toThrow("non-empty name");
    expect(() => createFolioPlugin(null as never)).toThrow("factory must be a function");
  });

  test("exports the public contract without replacing the Vite plugin", () => {
    const plugin = { name: "example", configResolved: async () => undefined } satisfies FolioPlugin;
    expect(defineDocsConfig({ plugins: [plugin] }).plugins?.[0]).toBe(plugin);
    expect(nikalaDocsPlugin().name).toBe("vite-plugin-folio");
  });

  test("documents the stable hook surface as optional lifecycle callbacks", () => {
    const plugin: FolioPlugin = {
      name: "lifecycle-contract",
      configResolved: () => undefined,
      buildStart: () => undefined,
      pageCollected: () => undefined,
      pageTransformed: (page) => page,
      generate: () => undefined,
      buildEnd: () => undefined,
    };

    expect(plugin.name).toBe("lifecycle-contract");
  });
});
