import path from "node:path";
import fs from "fs-extra";

export function toLucideComponentName(name: string): string {
  return name.trim().split(/[-_\s]+/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

export function getComponentSourceDir(rootDir: string, moduleDir: string): string {
  const localSource = path.resolve(rootDir, "src/components/ui");
  if (fs.existsSync(localSource)) return localSource;
  const candidates = [
    path.resolve(moduleDir, "../vendor/docs-src/components/ui"),
    path.resolve(moduleDir, "../../src/components/ui"),
    path.resolve(moduleDir, "../components/ui"),
  ];
  const source = candidates.find((candidate) => fs.existsSync(candidate));
  if (source) return source;
  throw new Error("Folio local component sources are missing");
}

export function collectComponentExports(directory: string): Array<{ name: string; file: string }> {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:tsx?|jsx?)$/.test(entry.name) && !/^index\./.test(entry.name))
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      const source = fs.readFileSync(file, "utf8");
      const names = new Set<string>();
      for (const match of source.matchAll(/export\s+(?:const|function|class)\s+([A-Z][A-Za-z0-9_$]*)/g)) names.add(match[1]);
      for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
        for (const name of match[1].split(",")) {
          const exported = name.trim().split(/\s+as\s+/).at(-1);
          if (exported && /^[A-Z][A-Za-z0-9_$]*$/.test(exported)) names.add(exported);
        }
      }
      return [...names].sort().map((name) => ({ name, file }));
    }).sort((a, b) => a.name.localeCompare(b.name));
}

function collectSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(file);
    return entry.isFile() && /\.(?:tsx?|jsx?)$/.test(entry.name) ? [file] : [];
  });
}

function resolveComponentFile(directory: string, importPath: string): string | undefined {
  const base = path.join(directory, importPath);
  return [base, ...[".ts", ".tsx", ".js", ".jsx"].map((ext) => base + ext),
    ...["index.ts", "index.tsx", "index.js", "index.jsx"].map((entry) => path.join(base, entry))]
    .find((file) => fs.existsSync(file));
}

export function collectStaticComponentFiles(componentDir: string, themeDirs: string[]): Set<string> {
  const staticFiles = new Set<string>();
  const pending = themeDirs.flatMap((directory) => collectSourceFiles(directory));
  while (pending.length) {
    const file = pending.pop()!;
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/from\s+["']@\/components\/ui\/([^"']+)["']/g)) {
      const importedFile = resolveComponentFile(componentDir, match[1]);
      if (importedFile && !staticFiles.has(importedFile)) { staticFiles.add(importedFile); pending.push(importedFile); }
    }
    for (const match of source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)) {
      const importedFile = resolveComponentFile(path.dirname(file), match[1]);
      if (importedFile && importedFile.startsWith(`${path.resolve(componentDir)}${path.sep}`) && !staticFiles.has(importedFile)) {
        staticFiles.add(importedFile); pending.push(importedFile);
      }
    }
  }
  return staticFiles;
}
