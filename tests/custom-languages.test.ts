import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { defineDocsConfig, resolveDocsConfig } from "../src/config.js";
import { createCustomLanguageIndex } from "../src/mdx/custom-languages.js";

const demo = {
  name: "demolang",
  scopeName: "source.demolang",
  aliases: ["dl"],
  patterns: [{ name: "keyword.control.demolang", match: "\\b(?:fn|let)\\b" }],
};

function validate(...languages: unknown[]) {
  return () => createCustomLanguageIndex(languages);
}

describe("shiki.customLangs validation", () => {
  test("indexes names and aliases case-insensitively", () => {
    const index = createCustomLanguageIndex([{ ...demo, name: "DemoLang", aliases: ["DL", "demo"] }]);
    expect([...index.keys()].sort()).toEqual(["demo", "demolang", "dl"]);
    expect(index.get("dl")?.name).toBe("DemoLang");
    expect(createCustomLanguageIndex(undefined).size).toBe(0);
  });

  test("rejects registrations without a name or scopeName", () => {
    expect(validate({ ...demo, name: undefined })).toThrow("[folio] shiki.customLangs[0] name must be a non-empty string");
    expect(validate({ ...demo, name: "  " })).toThrow("name must be a non-empty string");
    expect(validate({ ...demo, scopeName: undefined })).toThrow("[folio] shiki.customLangs[0] scopeName must be a non-empty string");
    expect(validate({ ...demo, patterns: undefined })).toThrow('("demolang") must define a patterns array');
    expect(validate("actus")).toThrow("shiki.customLangs[0] must be a language registration object");
    expect(() => createCustomLanguageIndex({ demo })).toThrow("[folio] shiki.customLangs must be an array");
  });

  test("rejects names and aliases that collide with built-in languages", () => {
    expect(validate({ ...demo, name: "typescript" })).toThrow('uses "typescript", which is a built-in language or alias');
    expect(validate({ ...demo, name: "TOML" })).toThrow('uses "toml"');
    expect(validate({ ...demo, aliases: ["sh"] })).toThrow('uses "sh", which is a built-in language or alias');
    expect(validate({ ...demo, aliases: ["txt"] })).toThrow('uses "txt"');
  });

  test("rejects duplicate names, aliases and scope names", () => {
    expect(validate(demo, { ...demo, scopeName: "source.other" })).toThrow(
      '[folio] shiki.customLangs[1] ("demolang") uses "demolang", which is already registered by "demolang"',
    );
    expect(validate(demo, { ...demo, name: "other", scopeName: "source.other" })).toThrow('uses "dl", which is already registered');
    expect(validate(demo, { ...demo, name: "other", aliases: [] })).toThrow('scopeName "source.demolang" is registered more than once');
    expect(validate({ ...demo, aliases: ["x y"] })).toThrow('alias "x y" must not contain whitespace');
  });

  test("defineDocsConfig reports invalid registrations", () => {
    expect(() => defineDocsConfig({ shiki: { customLangs: [{ ...demo, name: "json" }] as never } })).toThrow(
      'uses "json", which is a built-in language or alias',
    );
    expect(defineDocsConfig({ shiki: { customLangs: [demo as never] } }).shiki?.customLangs).toHaveLength(1);
  });

  test("resolveDocsConfig rejects invalid registrations and keeps valid ones", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-custom-langs-"));
    try {
      const write = (customLangs: unknown) =>
        writeFile(path.join(root, "docs.config.ts"), `export default { shiki: { customLangs: ${JSON.stringify(customLangs)} } };`);
      await write([{ ...demo, scopeName: "" }]);
      await expect(resolveDocsConfig(root)).rejects.toThrow("[folio] shiki.customLangs[0] scopeName must be a non-empty string");
      await write([demo]);
      const config = await resolveDocsConfig(root);
      expect(config.shiki?.customLangs?.[0]?.name).toBe("demolang");
      expect(config.shiki?.themes?.dark).toBe("github-dark");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
