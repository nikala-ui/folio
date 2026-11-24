import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { COMPILER_COMPONENTS } from "../../mdx/compiler-components.js";
import { collectSourceClosure, findFolioSourceRoot, listSharedSourceFiles, registryPathToSource, resolveSourceImport } from "./folio-sources.js";
import { isAuthoredSourceFile, listSourceFiles } from "./source-files.js";

interface RegistryItem {
  files?: Array<{ path: string }>;
  dependencies?: string[];
}

async function resolveRegistryDir(): Promise<string> {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const bundledRegistry = path.resolve(commandDir, "../../registry");
  if (await fs.pathExists(bundledRegistry)) return bundledRegistry;
  throw new Error("Folio registry is unavailable. Rebuild @nikala-ui/folio before running init.");
}

export async function copyRegistrySource(root: string): Promise<{ componentFiles: string[]; hookFiles: string[]; dependencies: string[] }> {
  const registryDir = await resolveRegistryDir();
  const sourceRoot = findFolioSourceRoot();
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const docsComponentSources = [
    path.resolve(commandDir, "../../../src/components/mdx-components.tsx"),
    path.resolve(commandDir, "../../components/mdx-components.jsx"),
  ].filter((file) => fs.existsSync(file));
  const projectFiles = [
    ...(await listSourceFiles(path.join(root, "docs"))),
    ...(await listSourceFiles(path.join(root, "src/themes/default"))).filter(isAuthoredSourceFile),
    ...docsComponentSources,
  ];
  const projectSource = (await Promise.all(projectFiles.map((file) => fs.readFile(file, "utf-8")))).join("\n");

  // Folio's own sources are the only source of file contents, so a generated
  // project always matches the running Folio version. Registry manifests only
  // declare which npm packages a component's files need.
  const exports = new Map<string, string>();
  for (const file of await listSharedSourceFiles(sourceRoot)) {
    const source = await fs.readFile(path.join(sourceRoot, file), "utf-8");
    for (const match of source.matchAll(/export\s+(?:const|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/g)) exports.set(match[1], file);
  }
  const entries = new Set<string>();
  const addByExport = (name: string) => {
    const file = exports.get(name);
    if (file) entries.add(file);
  };
  for (const match of projectSource.matchAll(/@\/(?:components\/ui|hooks|providers|lib)\/[a-z0-9-]+/g)) {
    const file = resolveSourceImport(sourceRoot, "", match[0]);
    if (file) entries.add(file);
  }
  for (const match of projectSource.matchAll(/import\s*{([^{}]*?)}\s*from\s*["']@\/components\/ui["']/g)) {
    for (const name of match[1].split(",")) addByExport(name.trim().split(/\s+as\s+/)[0]);
  }
  COMPILER_COMPONENTS.forEach(addByExport);
  for (const match of projectSource.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)) addByExport(match[1]);
  for (const match of projectSource.matchAll(/\bCore\.([A-Z][A-Za-z0-9_]*)/g)) addByExport(match[1]);

  const closure = await collectSourceClosure(sourceRoot, entries);
  const dependencies = new Set<string>();
  for (const filename of (await fs.readdir(registryDir)).filter((name) => name.endsWith(".json") && name !== "index.json")) {
    const item = await fs.readJson(path.join(registryDir, filename)) as RegistryItem;
    if ((item.files || []).some((file) => closure.includes(registryPathToSource(file.path)))) {
      for (const dependency of item.dependencies || []) dependencies.add(dependency);
    }
  }

  for (const file of closure) {
    const destination = path.join(root, "src", file);
    if (!(await fs.pathExists(destination))) await fs.copy(path.join(sourceRoot, file), destination);
  }
  const names = (directory: string) => closure
    .filter((file) => path.posix.dirname(file) === directory)
    .map((file) => path.posix.basename(file).replace(/\.(?:tsx?|jsx?)$/, ""));
  return { componentFiles: names("components/ui"), hookFiles: names("hooks"), dependencies: [...dependencies].sort() };
}
