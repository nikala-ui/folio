import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { languageLoaders, resolveBuiltinLanguages } from "../src/mdx/builtin-languages.js";

const demo = {
  name: "demolang",
  scopeName: "source.demolang",
  aliases: ["dl"],
  patterns: [{ name: "keyword.control.demolang", match: "\\b(?:fn|let)\\b" }],
};
const HIGHLIGHTED = "--shiki-dark:";

// Copy the module first: mock.module also rebinds the original namespace object.
const realShikiCore = { ...(await import("shiki/core")) };
let createdHighlighters = 0;
mock.module("shiki/core", () => ({
  ...realShikiCore,
  createBundledHighlighter: (options: Parameters<typeof realShikiCore.createBundledHighlighter>[0]) => {
    const create = realShikiCore.createBundledHighlighter(options);
    return (...args: Parameters<typeof create>) => {
      createdHighlighters += 1;
      return create(...args);
    };
  },
}));

let instance = 0;
/** A fresh copy of the module, so each test starts without a cached highlighter. */
const loadHighlighter = (): Promise<typeof import("../src/components/ui/code-highlighter.js")> =>
  import(`../src/components/ui/code-highlighter.ts?instance=${++instance}`);

/** The virtual modules the site build generates, for a site with the given `shiki.langs`. */
function configure(shiki: { langs?: string[] } = {}) {
  const builtin = Object.fromEntries(resolveBuiltinLanguages(shiki.langs).map((id) => [id, languageLoaders[id]]));
  mock.module("virtual:folio-builtin-languages", () => ({ default: builtin }));
  mock.module("virtual:folio-highlight-languages", () => ({ default: [demo] }));
  mock.module("virtual:folio-highlight-themes", () => ({ default: {} }));
}

const warnings: unknown[][] = [];
let warn: ReturnType<typeof spyOn>;
let error: ReturnType<typeof spyOn>;

beforeEach(() => {
  createdHighlighters = 0;
  warnings.length = 0;
  warn = spyOn(console, "warn").mockImplementation((...args) => { warnings.push(args); });
  error = spyOn(console, "error").mockImplementation((...args) => { warnings.push(args); });
  (globalThis as { window?: unknown }).window = {};
  configure();
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
  delete (globalThis as { window?: unknown }).window;
});

describe("browser highlighting", () => {
  test("shares one highlighter between concurrent highlights", async () => {
    const { highlightOnClient } = await loadHighlighter();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) => highlightOnClient(`value = ${index}`, index % 2 ? "toml" : "typescript")),
    );
    expect(results.every((html) => html?.includes(HIGHLIGHTED))).toBe(true);
    expect(createdHighlighters).toBe(1);
    expect(warnings).toEqual([]);
  });

  test("highlights every built-in language, not a fixed subset", async () => {
    const { highlightOnClient } = await loadHighlighter();
    for (const [lang, code] of [["toml", "name = \"folio\""], ["yaml", "a: 1"], ["python", "def f(): pass"], ["sql", "select 1"], ["yml", "a: 1"], ["sh", "echo hi"]]) {
      expect(await highlightOnClient(code, lang), lang).toContain(HIGHLIGHTED);
    }
    expect(warnings).toEqual([]);
  });

  test("highlights custom languages by name and alias next to built-in ones", async () => {
    const { highlightOnClient } = await loadHighlighter();
    expect(await highlightOnClient("fn main", "demolang")).toContain("#D73A49");
    expect(await highlightOnClient("fn main", "DL")).toContain("#D73A49");
    expect(await highlightOnClient("a = 1", "toml")).toContain(HIGHLIGHTED);
    expect(createdHighlighters).toBe(1);
    expect(warnings).toEqual([]);
  });

  test("falls back to plain text without noise for unknown and plain languages", async () => {
    const { highlightOnClient } = await loadHighlighter();
    for (const lang of ["nolang", "text", "txt", "plain", ""]) expect(await highlightOnClient("x", lang), lang).toBeNull();
    expect(warnings).toEqual([]);
  });

  test("follows the shiki.langs allowlist for built-in languages only", async () => {
    configure({ langs: ["typescript", "yml"] });
    const { highlightOnClient } = await loadHighlighter();
    expect(await highlightOnClient("const a = 1", "ts")).toContain(HIGHLIGHTED);
    expect(await highlightOnClient("a: 1", "yaml")).toContain(HIGHLIGHTED);
    expect(await highlightOnClient("a = 1", "toml")).toBeNull();
    expect(await highlightOnClient("fn main", "dl")).toContain("#D73A49");
    expect(warnings).toEqual([]);
  });

  test("does nothing on the server", async () => {
    delete (globalThis as { window?: unknown }).window;
    const { highlightOnClient } = await loadHighlighter();
    expect(await highlightOnClient("a = 1", "toml")).toBeNull();
    expect(createdHighlighters).toBe(0);
  });
});
