import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { defineDocsConfig, resolveDocsConfig } from "../src/config.js";
import { buildDocs } from "../src/server/index.js";
import { resolveDefaultThemeMode } from "../src/theme-mode.js";
import { resolveSearchProvider, searchPages } from "../src/search/provider.js";

async function withConfig(source: string, callback: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "folio-config-validation-"));
  try {
    await writeFile(path.join(root, "docs.config.ts"), source);
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("docs config", () => {
  test("uses the configured default theme mode", () => {
    expect(resolveDefaultThemeMode({ theme: { defaultMode: "light" } })).toBe("light");
    expect(resolveDefaultThemeMode({ theme: { defaultMode: "dark" } })).toBe("dark");
    expect(resolveDefaultThemeMode({ theme: { defaultMode: "system" } })).toBe("system");
  });

  test("falls back to system for missing or invalid runtime values", () => {
    expect(resolveDefaultThemeMode()).toBe("system");
    expect(resolveDefaultThemeMode({})).toBe("system");
    expect(resolveDefaultThemeMode({ theme: { defaultMode: "sepia" as never } })).toBe("system");
  });

  test("uses local search by default", () => {
    expect(resolveSearchProvider().active).toBe("local");
    expect(resolveSearchProvider({ enabled: true, provider: "local" }).fallback).toBe(false);
  });

  test("falls back unsupported providers to local search", () => {
    const resolved = resolveSearchProvider({ enabled: true, provider: "unavailable" });
    expect(resolved.requested).toBe("unavailable");
    expect(resolved.active).toBe("local");
    expect(resolved.fallback).toBe(true);
  });

  test("uses the resolved provider implementation for local search", () => {
    const pages = [
      { title: "Configuration", url: "/configuration", description: "Configure Folio" },
      { title: "Themes", url: "/themes", description: "Customize styles" },
    ] as never[];

    expect(searchPages(resolveSearchProvider({ provider: "local" }), "folio", pages)).toHaveLength(1);
    expect(searchPages(resolveSearchProvider({ provider: "unavailable" }), "styles", pages)).toHaveLength(1);
  });

  test("accepts an external adapter without provider-specific engine code", async () => {
    const adapter = {
      name: "custom",
      search: async ({ pages }: { pages: typeof pages; query: string }) => pages.slice(0, 1),
    };
    const resolved = resolveSearchProvider({ provider: adapter });

    expect(resolved.active).toBe("custom");
    expect(resolved.fallback).toBe(false);
    expect(await searchPages(resolved, "anything", [{ title: "One" }] as never[])).toHaveLength(1);
  });

  test("validates plugins loaded from a direct docs.config.ts export", async () => {
    await withConfig("export default { plugins: [{ name: '   ' }] };", async (root) => {
      await assert.rejects(resolveDocsConfig(root), /Plugin at index 0 must have a non-empty name/);
    });
    await withConfig("export default { plugins: [{ name: 'duplicate' }, { name: 'duplicate' }] };", async (root) => {
      await assert.rejects(resolveDocsConfig(root), /Plugin name \"duplicate\" is registered more than once/);
    });
    await withConfig("export default { plugins: [{ name: 'invalid-hook', buildStart: true }] };", async (root) => {
      await assert.rejects(resolveDocsConfig(root), /Plugin \"invalid-hook\" hook \"buildStart\" must be a function/);
    });
    await withConfig("export default { plugins: { name: 'not-an-array' } };", async (root) => {
      await assert.rejects(resolveDocsConfig(root), /DocsConfig.plugins must be an array/);
    });
  });

  test("keeps defineDocsConfig validation aligned with loaded config validation", () => {
    expect(() => defineDocsConfig({ plugins: [{ name: "   " }] as never })).toThrow(
      "Plugin at index 0 must have a non-empty name",
    );
    expect(() => defineDocsConfig({ plugins: [{ name: "duplicate" }, { name: "duplicate" }] as never })).toThrow(
      'Plugin name "duplicate" is registered more than once',
    );
    expect(() => defineDocsConfig({ plugins: { name: "not-an-array" } as never })).toThrow(
      "DocsConfig.plugins must be an array",
    );
  });

  test("loads a valid plugin-less config with the normal defaults", async () => {
    await withConfig("export default { title: 'Consumer Docs' };", async (root) => {
      const config = await resolveDocsConfig(root);
      expect(config.title).toBe("Consumer Docs");
      expect(config.contentDir).toBe("docs");
      expect(config.plugins).toBeUndefined();
    });
  });

  test("rejects invalid config before a build starts", async () => {
    await withConfig("export default { plugins: [{ name: 'invalid', buildStart: true }] };", async (root) => {
      await assert.rejects(
        buildDocs({ root, outDir: "out" }),
        (error) => error instanceof Error
          && error.message.startsWith("[folio]")
          && error.message.includes('Plugin "invalid" hook "buildStart" must be a function'),
      );
    });
  });
});
