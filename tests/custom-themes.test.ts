import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { defineDocsConfig, resolveDocsConfig } from "../src/config.js";
import { createCustomThemes } from "../src/mdx/custom-themes.js";

const light = { name: "demo-light", type: "light", colors: {}, tokenColors: [{ scope: "keyword", settings: { foreground: "#AA11BB" } }] };
const dark = { name: "demo-dark", type: "dark", colors: {}, tokenColors: [{ scope: "keyword", settings: { foreground: "#22CC88" } }] };

const validate = (themes: unknown) => () => createCustomThemes(themes);

describe("shiki.themes validation", () => {
  test("accepts bundled theme names, theme objects and a mix of both", () => {
    expect(createCustomThemes(undefined)).toEqual({});
    expect(createCustomThemes({})).toEqual({});
    expect(createCustomThemes({ light: "github-light", dark: "github-dark-dimmed" })).toEqual({});
    expect(createCustomThemes({ light, dark })).toEqual({ light, dark });
    expect(createCustomThemes({ light: "github-light", dark })).toEqual({ dark });
    expect(createCustomThemes({ light: { name: "settings-only", settings: [] } }).light?.name).toBe("settings-only");
  });

  test("rejects values that are neither a name nor an object", () => {
    expect(validate("github-light")).toThrow("[folio] shiki.themes must be an object");
    expect(validate([light])).toThrow("[folio] shiki.themes must be an object");
    expect(validate({ light: 3 })).toThrow("[folio] shiki.themes.light must be a bundled theme name or a Shiki theme object");
    expect(validate({ dark: [dark] })).toThrow("[folio] shiki.themes.dark must be a bundled theme name or a Shiki theme object");
    expect(validate({ light: null })).toThrow("[folio] shiki.themes.light must be a bundled theme name or a Shiki theme object");
  });

  test("rejects theme objects without a usable name", () => {
    expect(validate({ light: { ...light, name: undefined } })).toThrow("[folio] shiki.themes.light theme object needs a non-empty name");
    expect(validate({ dark: { ...dark, name: "  " } })).toThrow("[folio] shiki.themes.dark theme object needs a non-empty name");
    expect(validate({ dark: { ...dark, name: 7 } })).toThrow("[folio] shiki.themes.dark theme object needs a non-empty name");
  });

  test("rejects names that collide with a bundled theme", () => {
    expect(validate({ light: { ...light, name: "github-light" } })).toThrow(
      '[folio] shiki.themes.light ("github-light") uses "github-light", which is a bundled Shiki theme name; choose a different name',
    );
    expect(validate({ dark: { ...dark, name: "nord" } })).toThrow('[folio] shiki.themes.dark ("nord") uses "nord"');
  });

  test("rejects light and dark objects that share a name", () => {
    expect(validate({ light, dark: { ...dark, name: "demo-light" } })).toThrow(
      '[folio] shiki.themes.light and shiki.themes.dark both use the theme name "demo-light"',
    );
  });

  test("rejects malformed type, tokenColors, settings and colors", () => {
    expect(validate({ light: { ...light, type: "auto" } })).toThrow('("demo-light") type must be "light" or "dark"');
    expect(validate({ light: { ...light, tokenColors: {} } })).toThrow("tokenColors must be an array");
    expect(validate({ light: { ...light, settings: "x" } })).toThrow("settings must be an array");
    expect(validate({ light: { ...light, colors: [] } })).toThrow("colors must be an object");
  });

  test("defineDocsConfig reports invalid themes and keeps valid ones", () => {
    expect(() => defineDocsConfig({ shiki: { themes: { light: { ...light, name: "" } } } })).toThrow("theme object needs a non-empty name");
    expect(defineDocsConfig({ shiki: { themes: { light, dark } } }).shiki?.themes?.dark).toEqual(dark);
    expect(defineDocsConfig({ shiki: { themes: { light: "github-light" } } }).shiki?.themes?.light).toBe("github-light");
  });

  test("resolveDocsConfig rejects invalid themes and merges objects with the defaults", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-custom-themes-"));
    try {
      const write = (themes: unknown) => writeFile(path.join(root, "docs.config.ts"), `export default { shiki: { themes: ${JSON.stringify(themes)} } };`);
      await write({ dark: { ...dark, name: "github-dark" } });
      await expect(resolveDocsConfig(root)).rejects.toThrow('[folio] shiki.themes.dark ("github-dark") uses "github-dark"');
      await write({ light });
      const config = await resolveDocsConfig(root);
      expect(config.shiki?.themes?.light).toEqual(light);
      expect(config.shiki?.themes?.dark).toBe("github-dark");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
