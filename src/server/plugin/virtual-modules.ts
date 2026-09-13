import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { scanContentDirectories } from "../../core/content-scanner.js";
import { buildConfiguredSidebarTree, buildSidebarTree } from "../../core/route-tree.js";
import type { DocsConfig, PageData } from "../../types.js";
import { serializeModuleValue } from "../module-serialization.js";
import type { FolioBuildSession } from "./lifecycle.js";
import { collectComponentExports, collectStaticComponentFiles, getComponentSourceDir, toLucideComponentName } from "./components.js";
import {
  RESOLVED_COMPONENTS_ID, RESOLVED_CONFIG_ID, RESOLVED_ICONS_ID, RESOLVED_ROUTES_ID,
  RESOLVED_SHIKI_ID, RESOLVED_SOURCES_ID, RESOLVED_THEME_ID, RESOLVED_TREE_ID,
} from "./constants.js";

export interface VirtualModuleState {
  rootDir: string;
  docsDir: string;
  resolvedConfig: DocsConfig;
  optionsConfig?: DocsConfig;
  lifecycleSession?: FolioBuildSession;
  isSsrBuild: boolean;
}

export function createVirtualModuleLoader(state: () => VirtualModuleState, moduleDir: string) {
  return async function load(id: string): Promise<string | null> {
    const current = state();
    const { rootDir, docsDir, resolvedConfig, lifecycleSession } = current;
    if (id === RESOLVED_SHIKI_ID) return `
export const createHighlighter = async () => null;
export const bundledLanguages = {};
export const bundledThemes = {};
export default { createHighlighter, bundledLanguages, bundledThemes };
`;
    if (id === RESOLVED_CONFIG_ID) {
      const configFile = ["docs.config.ts", "docs.config.js", "docs.config.mjs", "nikala.docs.config.ts", "nikala.docs.config.js", "nikala.docs.config.mjs", "nikala.config.ts", "nikala.config.js"]
        .map((filename) => path.join(rootDir, filename)).find((file) => fs.existsSync(file));
      if (!configFile) return `export default ${serializeModuleValue(resolvedConfig)};`;
      return `
import userConfig from ${serializeModuleValue(configFile)};
const defaults = ${serializeModuleValue(resolvedConfig)};
const config = { ...defaults, ...userConfig, navigation: { ...defaults.navigation, ...userConfig.navigation, sidebar: { ...defaults.navigation?.sidebar, ...userConfig.navigation?.sidebar } }, theme: { ...defaults.theme, ...userConfig.theme }, shiki: { ...defaults.shiki, ...userConfig.shiki, themes: { ...defaults.shiki?.themes, ...userConfig.shiki?.themes } }, search: { ...defaults.search, ...userConfig.search } };
export default config;
`;
    }
    if (id === RESOLVED_TREE_ID) {
      const pages = [...await lifecycleSession!.pages()];
      const directories = await scanContentDirectories(docsDir);
      const configuredSidebar = resolvedConfig.navigation?.sidebar?.nav ?? resolvedConfig.sidebar ?? "auto";
      const tree = configuredSidebar !== "auto" ? buildConfiguredSidebarTree(configuredSidebar, pages) : buildSidebarTree(pages, directories);
      return `export const pages = ${serializeModuleValue(pages)}; export const tree = ${serializeModuleValue(tree)}; export default { pages, tree };`;
    }
    if (id === RESOLVED_ROUTES_ID || id === RESOLVED_SOURCES_ID) {
      const pages = [...await lifecycleSession!.pages()];
      const key = id === RESOLVED_ROUTES_ID ? "routes" : "sources";
      const entries = pages.map((page) => `  ${serializeModuleValue(page.url)}: () => import(${serializeModuleValue(id === RESOLVED_ROUTES_ID ? page.filePath : `${page.filePath}?raw`)})`);
      return `export const ${key} = {\n${entries.join(",\n")}\n}; export default ${key};`;
    }
    if (id === RESOLVED_COMPONENTS_ID) {
      const componentDir = getComponentSourceDir(rootDir, moduleDir);
      const themeDirs = [path.resolve(moduleDir, "../themes/default"), path.resolve(rootDir, "src/themes/default")];
      if (resolvedConfig.theme?.path) {
        const configuredTheme = path.resolve(rootDir, resolvedConfig.theme.path);
        themeDirs.push(fs.existsSync(configuredTheme) && fs.statSync(configuredTheme).isDirectory() ? configuredTheme : path.dirname(configuredTheme));
      }
      const staticFiles = collectStaticComponentFiles(componentDir, themeDirs);
      const exports = collectComponentExports(componentDir);
      const modules = new Map<string, { index: number; isStatic: boolean }>();
      for (const { file } of exports) if (!modules.has(file)) modules.set(file, { index: modules.size, isStatic: staticFiles.has(file) });
      const imports = [...modules].map(([file, { index, isStatic }]) => isStatic ? `import * as componentModule${index} from ${serializeModuleValue(file)};` : `const componentModule${index} = () => import(${serializeModuleValue(file)});`);
      const entries = exports.map(({ name, file }) => {
        const module = modules.get(file)!;
        return module.isStatic ? `  ${serializeModuleValue(name)}: componentModule${module.index}[${serializeModuleValue(name)}]` : `  ${serializeModuleValue(name)}: lazy(() => componentModule${module.index}().then((module) => ({ default: module[${serializeModuleValue(name)}] })))`;
      });
      return `import { lazy } from "solid-js";\n${imports.join("\n")}\nconst components = {\n${entries.join(",\n")}\n}; export default components;`;
    }
    if (id === RESOLVED_ICONS_ID) {
      const pages = await lifecycleSession!.pages();
      const names = [...new Set(pages.map((page) => page.frontmatter.icon).filter((name): name is string => typeof name === "string" && name.trim().length > 0))];
      const require = createRequire(path.join(rootDir, "package.json"));
      const entries: Array<{ name: string; specifier: string }> = [];
      for (const name of names) {
        const kebabName = name.trim().replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
        try { require.resolve(`lucide-solid/icons/${kebabName}`); entries.push({ name, specifier: `lucide-solid/icons/${kebabName}` }); }
        catch { console.warn(`[folio] Unknown Lucide icon "${name}"; skipping it.`); }
      }
      return `${entries.map(({ specifier }, index) => `import icon${index} from ${serializeModuleValue(specifier)};`).join("\n")}\nexport const icons = {\n${entries.map(({ name }, index) => `  ${serializeModuleValue(toLucideComponentName(name))}: icon${index}`).join(",\n")}\n};`;
    }
    if (id === RESOLVED_THEME_ID) {
      const configuredPath = resolvedConfig.theme?.path;
      if (!configuredPath) {
        const defaultEntry = path.resolve(moduleDir, "../themes/default/index.js");
        return `import defaultTheme from ${serializeModuleValue(defaultEntry)}; export const theme = defaultTheme; export default theme;`;
      }
      const requestedPath = path.resolve(rootDir, configuredPath);
      const candidates = [requestedPath, ...["index.ts", "index.tsx", "index.js", "index.jsx"].map((entry) => path.join(requestedPath, entry))];
      const themeEntry = candidates.find((candidate) => fs.existsSync(candidate));
      if (!themeEntry) throw new Error(`[folio] Theme path does not exist: ${requestedPath}`);
      return `import configuredTheme from ${serializeModuleValue(themeEntry)}; export const theme = configuredTheme.default || configuredTheme; export default theme;`;
    }
    return null;
  };
}
