import { afterEach, describe, expect, mock, test } from "bun:test";
import { languageLoaders, resolveBuiltinLanguages } from "../src/mdx/builtin-languages.js";
import { compileMdx } from "../src/mdx/compiler.js";
import { highlightOnClient } from "../src/components/ui/code-highlighter.js";
import { RESOLVED_CONFIG_ID, RESOLVED_HIGHLIGHT_LANGUAGES_ID } from "../src/server/plugin/constants.js";
import { createVirtualModuleLoader } from "../src/server/plugin/virtual-modules.js";
import type { DocsConfig } from "../src/types.js";

const demo = {
  name: "demolang",
  scopeName: "source.demolang",
  aliases: ["dl"],
  patterns: [{ name: "keyword.control.demolang", match: "\\b(?:fn|let)\\b" }],
};
const KEYWORD_LIGHT = "#D73A49";
const CLIENT_KEYWORD = `color:${KEYWORD_LIGHT};--shiki-dark:#F97583`;
const fence = (lang: string, code = "fn main") => `\`\`\`${lang}\n${code}\n\`\`\`\n`;
const shiki = { customLangs: [demo as never] };

describe("server-side highlighting of custom languages", () => {
  test("highlights a fence by name and by alias and labels it with the language", async () => {
    for (const lang of ["demolang", "dl", "DL"]) {
      const { code } = await compileMdx(fence(lang), { shiki });
      expect(code).toContain('data-lang="demolang"');
      expect(code).toContain("language-demolang");
      expect(code).toContain(`"--shiki-light": "${KEYWORD_LIGHT}"`);
      expect(code).toContain('{"fn"}');
    }
  });

  test("keeps the site's configured themes", async () => {
    const { code } = await compileMdx(fence("dl"), { shiki: { ...shiki, themes: { light: "github-light", dark: "github-dark-dimmed" } } });
    expect(code).toContain("shiki-themes github-light github-dark-dimmed");
    expect(code).toContain('data-lang="demolang"');
  });

  test("lets custom languages through the built-in language allowlist", async () => {
    const { code } = await compileMdx(fence("dl"), { shiki: { ...shiki, langs: ["typescript"] } });
    expect(code).toContain('data-lang="demolang"');
  });

  test("leaves built-in and unknown languages unchanged", async () => {
    const { code } = await compileMdx(`${fence("ts", "const a = 1")}\n${fence("nolang")}`, { shiki });
    expect(code).toContain('data-lang="typescript"');
    expect(code).toContain('data-lang="text"');
    expect(code).not.toContain('data-lang="demolang"');
    const without = await compileMdx(fence("dl"));
    expect(without.code).toContain('data-lang="text"');
    expect(without.code).not.toContain(KEYWORD_LIGHT);
  });

  test("rejects invalid registrations while compiling", async () => {
    await expect(compileMdx(fence("dl"), { shiki: { customLangs: [{ ...demo, name: "bash" }] as never } })).rejects.toThrow(
      '[folio] shiki.customLangs[0] ("bash") uses "bash"',
    );
  });
});

describe("client-side highlighting of custom languages", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  test("highlights custom and built-in languages and falls back for unknown ones", async () => {
    mock.module("virtual:folio-builtin-languages", () => ({
      default: Object.fromEntries(resolveBuiltinLanguages(undefined).map((id) => [id, languageLoaders[id]])),
    }));
    mock.module("virtual:folio-highlight-languages", () => ({ default: [demo] }));
    mock.module("virtual:folio-highlight-themes", () => ({ default: {} }));
    (globalThis as { window?: unknown }).window = {};

    const custom = await highlightOnClient("fn main", "dl");
    expect(custom).toContain(CLIENT_KEYWORD);
    expect(await highlightOnClient("fn main", "demolang")).toContain(CLIENT_KEYWORD);
    expect(await highlightOnClient("const a = 1", "ts")).toContain("--shiki-dark:");
    expect(await highlightOnClient("fn main", "nolang")).toBeNull();
  });
});

describe("generated client modules", () => {
  test("serves grammars through a lazy module and keeps them out of the client config", async () => {
    const resolvedConfig: DocsConfig = { title: "Demo", shiki: { themes: { light: "github-light" }, customLangs: [demo as never] } };
    const load = createVirtualModuleLoader(() => ({
      rootDir: process.cwd(), docsDir: process.cwd(), resolvedConfig, isSsrBuild: false,
    }));
    const languages = String(await load(RESOLVED_HIGHLIGHT_LANGUAGES_ID));
    expect(languages).toStartWith("export default [");
    expect(languages).toContain("keyword.control.demolang");
    const config = String(await load(RESOLVED_CONFIG_ID));
    expect(config).toContain("github-light");
    expect(config).not.toContain("customLangs");
    expect(config).not.toContain("keyword.control.demolang");
  });
});
