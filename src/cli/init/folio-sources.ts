import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

/**
 * Folio's own source tree is the single source of truth for every file that
 * `folio init` copies into a project. The tree is mirrored under `src/` in the
 * generated project, so a source path such as `components/ui/code-block.tsx`
 * is written to `src/components/ui/code-block.tsx`.
 */

const SOURCE_EXTENSIONS = [".tsx", ".ts"] as const;
/** Directories whose files init copies on demand. Plugins and the theme have their own copy steps. */
const SHARED_DIRECTORIES = ["components/ui", "hooks", "providers", "lib"] as const;
const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const ALIAS_PATTERN = /^@\/(components\/ui|hooks|providers|lib)\/(.+)$/;

/**
 * Locate the packaged (`dist/vendor/docs-src`) or in-repository (`src`) Folio
 * sources. A directory only counts when it holds authored `.tsx` components,
 * not the compiled output TypeScript writes next to the vendored copy.
 */
export function findFolioSourceRoot(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const root = [path.resolve(moduleDir, "../../vendor/docs-src"), path.resolve(moduleDir, "../..")].find((candidate) => {
    const components = path.join(candidate, "components/ui");
    return fs.existsSync(components) && fs.readdirSync(components).some((name) => name.endsWith(".tsx"));
  });
  if (!root) throw new Error("Folio component sources are unavailable. Rebuild @nikala-ui/folio before running init.");
  return root;
}

/** Resolve an extensionless or `.js`/`.jsx` specifier to an existing source file, relative to `root`. */
function resolveSourceFile(root: string, relativeBase: string): string | undefined {
  const stem = relativeBase.replace(/\.(?:jsx?|tsx?)$/, "");
  return SOURCE_EXTENSIONS.map((extension) => stem + extension).find((candidate) => fs.existsSync(path.join(root, candidate)));
}

/** Map an import specifier found in `file` to a Folio source file, or undefined when it is not one. */
export function resolveSourceImport(root: string, file: string, specifier: string): string | undefined {
  const alias = ALIAS_PATTERN.exec(specifier);
  if (alias) return resolveSourceFile(root, `${alias[1]}/${alias[2]}`);
  if (!specifier.startsWith(".")) return undefined;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  if (target.startsWith("../") || /^(?:plugins|themes)\//.test(target)) return undefined;
  return resolveSourceFile(root, target);
}

/** Every Folio source file `entries` need, including entries and their transitive local imports. */
export async function collectSourceClosure(root: string, entries: Iterable<string>): Promise<string[]> {
  const closure = new Set<string>();
  const pending = [...entries];
  while (pending.length) {
    const file = pending.pop()!;
    if (closure.has(file)) continue;
    closure.add(file);
    const source = await fs.readFile(path.join(root, file), "utf-8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const imported = resolveSourceImport(root, file, match[1]);
      if (imported) pending.push(imported);
    }
  }
  return [...closure].sort();
}

/** All source files init may copy, relative to `root`. */
export async function listSharedSourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const directory of SHARED_DIRECTORIES) {
    const absolute = path.join(root, directory);
    if (!(await fs.pathExists(absolute))) continue;
    for (const entry of await fs.readdir(absolute, { withFileTypes: true })) {
      if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(`${directory}/${entry.name}`);
    }
  }
  return files.sort();
}

/** Registry manifests name files by their `ui/`, `hooks/` or `providers/` prefix; map them onto the source tree. */
export function registryPathToSource(registryPath: string): string {
  return registryPath.startsWith("ui/") ? `components/${registryPath}` : registryPath;
}
