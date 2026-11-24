import { afterEach, describe, expect, mock, test } from "bun:test";
import githubLight from "@shikijs/themes/github-light";
import { highlightOnClient } from "../src/components/ui/code-highlighter.js";
import { compileMdx } from "../src/mdx/compiler.js";
import { highlightCode } from "../src/mdx/highlighter.js";
import { RESOLVED_CONFIG_ID, RESOLVED_HIGHLIGHT_THEMES_ID } from "../src/server/plugin/constants.js";
import { createVirtualModuleLoader } from "../src/server/plugin/virtual-modules.js";
import type { DocsConfig } from "../src/types.js";

const demoLang = {
  name: "demolang",
  scopeName: "source.demolang",
  patterns: [{ name: "keyword.control.demolang", match: "\\b(?:fn|let)\\b" }],
};
const tokenTheme = (name: string, type: "light" | "dark", foreground: string) => ({
  name,
  type,
  colors: { "editor.foreground": "#101010", "editor.background": type === "light" ? "#ffffff" : "#000000" },
  tokenColors: [{ scope: ["keyword.control.demolang", "storage.type"], settings: { foreground } }],
});
const light = tokenTheme("demo-light", "light", "#AA11BB");
const dark = tokenTheme("demo-dark", "dark", "#22CC88");
const shiki = { customLangs: [demoLang as never], themes: { light, dark } };
const fence = "```demolang\nfn main\n```\n";

describe("server-side highlighting with theme objects", () => {
  test("uses the object's colours for a scoped token in light and dark output", async () => {
    const { code } = await compileMdx(fence, { shiki });
    expect(code).toContain("shiki-themes demo-light demo-dark");
    expect(code).toContain('"--shiki-light": "#AA11BB"');
    expect(code).toContain('"--shiki-dark": "#22CC88"');
    expect(code).toContain('"--shiki-light-bg": "#ffffff"');
    expect(code).toContain('"--shiki-dark-bg": "#000000"');
  });

  test("mixes a theme object with a bundled theme name", async () => {
    const { code } = await compileMdx(fence, { shiki: { ...shiki, themes: { light: "github-light", dark } } });
    expect(code).toContain("shiki-themes github-light demo-dark");
    expect(code).toContain('"--shiki-light": "#D73A49"');
    expect(code).toContain('"--shiki-dark": "#22CC88"');
  });

  test("extends a bundled theme by spreading it and adding token colours", async () => {
    const extended = { ...githubLight, name: "github-light-demo", tokenColors: [...githubLight.tokenColors, ...light.tokenColors] };
    const { code } = await compileMdx(`${fence}\n\`\`\`ts\nconst a = 1\n\`\`\`\n`, { shiki: { ...shiki, themes: { light: extended } } });
    expect(code).toContain("shiki-themes github-light-demo github-dark");
    expect(code).toContain('"--shiki-light": "#AA11BB"');
    expect(code).toContain('"--shiki-light": "#D73A49"');
  });

  test("keeps bundled theme names working as before", async () => {
    const { code } = await compileMdx(fence, { shiki: { customLangs: [demoLang as never], themes: { light: "github-light", dark: "github-dark-dimmed" } } });
    expect(code).toContain("shiki-themes github-light github-dark-dimmed");
  });

  test("highlightCode accepts theme objects", async () => {
    await compileMdx(fence, { shiki });
    const html = await highlightCode("const a = 1", { lang: "ts", themeLight: light, themeDark: dark });
    expect(html).toContain("--shiki-light:#AA11BB");
    expect(html).toContain("--shiki-dark:#22CC88");
  });

  test("rejects invalid theme objects while compiling", async () => {
    await expect(compileMdx(fence, { shiki: { themes: { light: { ...light, name: "github-light" } } } })).rejects.toThrow(
      '[folio] shiki.themes.light ("github-light") uses "github-light"',
    );
  });
});

describe("client-side highlighting with theme objects", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  test("applies the configured theme objects and falls back to the GitHub themes", async () => {
    mock.module("virtual:folio-highlight-languages", () => ({ default: [demoLang] }));
    (globalThis as { window?: unknown }).window = {};

    mock.module("virtual:folio-highlight-themes", () => ({ default: { light, dark } }));
    expect(await highlightOnClient("fn main", "demolang")).toContain("color:#AA11BB;--shiki-dark:#22CC88");

    mock.module("virtual:folio-highlight-themes", () => ({ default: { dark } }));
    expect(await highlightOnClient("fn main", "demolang")).toContain("color:#D73A49;--shiki-dark:#22CC88");

    mock.module("virtual:folio-highlight-themes", () => ({ default: {} }));
    expect(await highlightOnClient("fn main", "demolang")).toContain("color:#D73A49;--shiki-dark:#F97583");
  });
});

describe("generated client modules", () => {
  test("serves theme objects through a lazy module and keeps them out of the client config", async () => {
    const resolvedConfig: DocsConfig = { title: "Demo", shiki: { themes: { light, dark: "github-dark" } } };
    const load = createVirtualModuleLoader(() => ({ rootDir: process.cwd(), docsDir: process.cwd(), resolvedConfig, isSsrBuild: false }), process.cwd());
    const themes = String(await load(RESOLVED_HIGHLIGHT_THEMES_ID));
    expect(themes).toStartWith("export default {");
    expect(themes).toContain("#AA11BB");
    expect(themes).not.toContain("github-dark");
    const config = String(await load(RESOLVED_CONFIG_ID));
    expect(config).toContain('"light":"demo-light"');
    expect(config).toContain('"dark":"github-dark"');
    expect(config).not.toContain("#AA11BB");
    expect(config).not.toContain("tokenColors");
  });
});
