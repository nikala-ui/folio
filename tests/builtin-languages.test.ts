import { describe, expect, test } from "bun:test";
import { languageLoaders, languageModules, resolveBuiltinLanguages } from "../src/mdx/builtin-languages.js";
import { RESOLVED_BUILTIN_LANGUAGES_ID } from "../src/server/plugin/constants.js";
import { createVirtualModuleLoader } from "../src/server/plugin/virtual-modules.js";
import type { DocsConfig } from "../src/types.js";

const loadBuiltinLanguages = (shiki: DocsConfig["shiki"]) =>
  createVirtualModuleLoader(() => ({
    rootDir: process.cwd(), docsDir: process.cwd(), resolvedConfig: { title: "Demo", shiki }, isSsrBuild: false,
  }), process.cwd())(RESOLVED_BUILTIN_LANGUAGES_ID).then(String);

/** The language ids and import specifiers the generated module declares, in order. */
const parseLoaders = (source: string): Array<[string, string]> =>
  [...source.matchAll(/^\s+("[^"]+"): \(\) => import\(("[^"]+")\)/gm)].map((match) => [JSON.parse(match[1]), JSON.parse(match[2])]);

describe("built-in language catalog", () => {
  test("has one loader per module and each module loads a grammar", async () => {
    expect(Object.keys(languageLoaders)).toEqual(Object.keys(languageModules));
    for (const id of ["bash", "dockerfile", "toml"] as const) {
      expect((await languageLoaders[id]()).default.length, id).toBeGreaterThan(0);
    }
  });

  test("enables every language without an allowlist and only the listed ones with one", () => {
    expect(resolveBuiltinLanguages(undefined)).toEqual(Object.keys(languageModules));
    expect(resolveBuiltinLanguages(["ts", "YML", "nolang", "typescript"])).toEqual(["typescript", "yaml"]);
    expect(resolveBuiltinLanguages([])).toEqual([]);
  });
});

describe("generated browser language loaders", () => {
  test("lists a lazy import for each language the site enables and no others", async () => {
    const source = await loadBuiltinLanguages({ langs: ["typescript", "sh", "dockerfile"] });
    expect(source).toStartWith("export default {");
    expect(parseLoaders(source)).toEqual([
      ["typescript", "@shikijs/langs/typescript"],
      ["bash", "@shikijs/langs/shellscript"],
      ["dockerfile", "@shikijs/langs/docker"],
    ]);
  });

  test("covers the whole catalog when the site sets no allowlist", async () => {
    expect(parseLoaders(await loadBuiltinLanguages(undefined))).toEqual(
      Object.entries(languageModules).map(([id, module]) => [id, `@shikijs/langs/${module}`]),
    );
  });
});
