import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectSourceClosure,
  findFolioSourceRoot,
  listSharedSourceFiles,
  registryPathToSource,
  resolveSourceImport,
} from "../src/cli/init/folio-sources.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(packageRoot, "src");
const registryDir = path.join(sourceRoot, "registry");
const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

interface Manifest { name: string; dependencies?: string[]; files: Array<{ path: string; content?: string }> }
const manifests: Manifest[] = readdirSync(registryDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(path.join(registryDir, name), "utf8")));

const importsOf = (file: string) =>
  [...readFileSync(path.join(sourceRoot, file), "utf8").matchAll(IMPORT_PATTERN)].map((match) => match[1]);

const packageName = (specifier: string) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

describe("folio init sources", () => {
  test("finds the repository sources when run from the checkout", () => {
    expect(findFolioSourceRoot()).toBe(sourceRoot);
  });

  test("registry manifests name Folio source files and carry no copy of them", async () => {
    const shared = new Set(await listSharedSourceFiles(sourceRoot));
    for (const manifest of manifests) {
      for (const file of manifest.files) {
        expect(file.content, `${manifest.name}: ${file.path} must not embed a source snapshot`).toBeUndefined();
        expect(shared.has(registryPathToSource(file.path)), `${manifest.name}: ${file.path} is not a Folio source file`).toBe(true);
      }
    }
  });

  test("every local import of a copyable file resolves, so no copied file dangles", async () => {
    for (const file of await listSharedSourceFiles(sourceRoot)) {
      for (const specifier of importsOf(file)) {
        const local = specifier.startsWith(".") || /^@\/(?:components\/ui|hooks|providers|lib)\//.test(specifier);
        const handledElsewhere = specifier.startsWith(".") && /^(?:plugins|themes)\//.test(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
        if (!local || handledElsewhere) continue;
        expect(resolveSourceImport(sourceRoot, file, specifier), `${file} imports ${specifier}`).toBeDefined();
      }
    }
  });

  test("follows imports to helpers, providers and shared modules", async () => {
    expect(await collectSourceClosure(sourceRoot, ["components/ui/code-block.tsx"])).toEqual(expect.arrayContaining([
      "components/ui/code-highlighter.ts",
      "components/ui/code-block-commands.ts",
      "hooks/create-clipboard.ts",
    ]));
    expect(await collectSourceClosure(sourceRoot, ["components/ui/theme-toggle.tsx"])).toEqual(expect.arrayContaining([
      "providers/theme-provider.tsx",
      "theme-accent.ts",
    ]));
    expect(await collectSourceClosure(sourceRoot, ["components/ui/external-link.tsx"])).toContain("lib/external-links.ts");
  });

  test("keeps plugin and theme sources out of the component closure", async () => {
    const closure = await collectSourceClosure(sourceRoot, ["components/ui/code-block.tsx", "components/ui/command.tsx"]);
    expect(closure.filter((file) => /^(?:plugins|themes)\//.test(file))).toEqual([]);
  });

  test("manifests declare every npm package their closure imports", async () => {
    const owners = new Map<string, Manifest>();
    for (const manifest of manifests) for (const file of manifest.files) owners.set(registryPathToSource(file.path), manifest);

    for (const manifest of manifests) {
      const closure = await collectSourceClosure(sourceRoot, manifest.files.map((file) => registryPathToSource(file.path)));
      const declared = new Set(["solid-js", ...closure.flatMap((file) => owners.get(file)?.dependencies ?? [])]);
      const imported = closure.flatMap((file) => importsOf(file))
        .filter((specifier) => !specifier.startsWith(".") && !specifier.startsWith("@/") && !/^(?:virtual|node):/.test(specifier))
        .map(packageName);
      const missing = [...new Set(imported)].filter((name) => !declared.has(name));
      expect(missing, `${manifest.name} imports packages its manifests do not declare`).toEqual([]);
    }
  });
});
