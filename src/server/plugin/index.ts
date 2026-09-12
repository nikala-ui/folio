import path from "node:path";
import fs from "fs-extra";
import type { Plugin, ViteDevServer } from "vite";
import { compileMdx } from "../../mdx/compiler.js";
import { loadConfig } from "../../config.js";
import { resolveDefaultThemeMode } from "../../theme-mode.js";
import type { DocsConfig } from "../../types.js";
import { createFolioBuildSession, type FolioBuildSession } from "./lifecycle.js";
import {
  CONFIG_FILENAMES, RESOLVED_CONFIG_ID, RESOLVED_ICONS_ID, RESOLVED_ROUTES_ID,
  RESOLVED_SHIKI_ID, RESOLVED_SOURCES_ID, RESOLVED_THEME_ID, RESOLVED_TREE_ID,
  VIRTUAL_CONFIG_ID, VIRTUAL_COMPONENTS_ID, VIRTUAL_ICONS_ID, VIRTUAL_ROUTES_ID,
  VIRTUAL_SOURCES_ID, VIRTUAL_THEME_ID, VIRTUAL_TREE_ID,
} from "./constants.js";
import { escapeHtmlAttribute, getServerModuleDir, getTailwindSourceDirectives } from "./styles.js";
import { createVirtualModuleLoader } from "./virtual-modules.js";
import { getComponentSourceDir } from "./components.js";

export interface NikalaDocsPluginOptions {
  docsDir?: string;
  configRoot?: string;
  configFile?: string;
  config?: DocsConfig;
  lifecycleSession?: FolioBuildSession;
}

export function nikalaDocsPlugin(options: NikalaDocsPluginOptions = {}): Plugin {
  let rootDir = path.resolve(options.configRoot || process.cwd());
  let docsDir = options.docsDir ? path.resolve(rootDir, options.docsDir) : path.resolve(rootDir, "docs");
  let resolvedConfig: DocsConfig = options.config || { title: "Folio" };
  let isSsrBuild = false;
  let lifecycleSession = options.lifecycleSession;
  const moduleDir = getServerModuleDir();
  const state = () => ({ rootDir, docsDir, resolvedConfig, optionsConfig: options.config, lifecycleSession, isSsrBuild });
  const loadVirtualModule = createVirtualModuleLoader(state, moduleDir);

  return {
    name: "vite-plugin-folio",
    enforce: "pre",
    async configResolved(viteConfig) {
      isSsrBuild = Boolean(viteConfig.build.ssr);
      rootDir = path.resolve(options.configRoot || process.cwd());
      if (!options.config) resolvedConfig = await loadConfig(options.configRoot || rootDir);
      if (!options.docsDir) {
        if (resolvedConfig.contentDir) docsDir = path.resolve(rootDir, resolvedConfig.contentDir);
        else if (await fs.pathExists(path.resolve(rootDir, "docs"))) docsDir = path.resolve(rootDir, "docs");
        else if (await fs.pathExists(path.resolve(rootDir, "content"))) docsDir = path.resolve(rootDir, "content");
        else docsDir = rootDir;
      } else docsDir = path.resolve(rootDir, options.docsDir);
      lifecycleSession ||= createFolioBuildSession({ plugins: resolvedConfig.plugins, config: resolvedConfig, rootDir, contentDir: docsDir, mode: viteConfig.command === "serve" ? "development" : "production" });
      await lifecycleSession.start();
    },
    transformIndexHtml(html) {
      const favicon = resolvedConfig.favicon || "/favicon.ico";
      return html.replace(/<link rel="icon" href="[^"]*"\s*\/>/i, `<link rel="icon" href="${escapeHtmlAttribute(favicon)}" />`).replaceAll("__NIKALA_DEFAULT_THEME__", resolveDefaultThemeMode(resolvedConfig));
    },
    resolveId(id, importer) {
      if (id === "shiki" || id.startsWith("shiki/")) {
        if (importer && (importer.includes("/mdx/") || importer.includes("\\mdx\\"))) return null;
        return isSsrBuild ? RESOLVED_SHIKI_ID : null;
      }
      const virtualIds: Record<string, string> = {
        [VIRTUAL_CONFIG_ID]: RESOLVED_CONFIG_ID, [VIRTUAL_TREE_ID]: RESOLVED_TREE_ID,
        [VIRTUAL_ROUTES_ID]: RESOLVED_ROUTES_ID, [VIRTUAL_SOURCES_ID]: RESOLVED_SOURCES_ID,
        [VIRTUAL_COMPONENTS_ID]: "\0" + VIRTUAL_COMPONENTS_ID, [VIRTUAL_ICONS_ID]: RESOLVED_ICONS_ID,
        [RESOLVED_ICONS_ID]: RESOLVED_ICONS_ID, [VIRTUAL_THEME_ID]: RESOLVED_THEME_ID,
      };
      return virtualIds[id] || null;
    },
    load: loadVirtualModule,
    async transform(code, id, transformOptions) {
      const cssId = id.split("?", 1)[0];
      const packagedCss = path.resolve(moduleDir, "../client/style.css");
      const baseCss = path.resolve(moduleDir, "../client/base.css");
      const configuredCss = resolvedConfig.css ? path.resolve(rootDir, resolvedConfig.css) : packagedCss;
      if (cssId === packagedCss || cssId === configuredCss) {
        const directives = getTailwindSourceDirectives(rootDir, docsDir, moduleDir);
        if (cssId === packagedCss && configuredCss !== packagedCss) return { code: `${directives}\n@import ${JSON.stringify(configuredCss.replace(/\\/g, "/"))};\n@import ${JSON.stringify(baseCss.replace(/\\/g, "/"))};`, map: null };
        return { code: `@import "tailwindcss";\n${directives}\n${code.replace('@import "tailwindcss";', "")}`, map: null };
      }
      if (/\.(md|mdx)$/.test(id)) {
        const result = await compileMdx(code, { filePath: id, development: !Boolean(transformOptions?.ssr) && process.env.NODE_ENV !== "production", shiki: resolvedConfig.shiki });
        return { code: result.code, map: null };
      }
      return null;
    },
    configureServer(server: ViteDevServer) {
      const configFiles = [...CONFIG_FILENAMES].map((filename) => path.join(rootDir, filename)).filter((file) => fs.existsSync(file));
      if (configFiles.length) server.watcher.add(configFiles);
      if (docsDir && fs.existsSync(docsDir)) server.watcher.add(docsDir);
      const componentsDir = getComponentSourceDir(rootDir, moduleDir);
      if (componentsDir && fs.existsSync(componentsDir)) server.watcher.add(componentsDir);
      const configuredCss = resolvedConfig.css ? path.resolve(rootDir, resolvedConfig.css) : undefined;
      if (configuredCss && fs.existsSync(configuredCss)) server.watcher.add(configuredCss);
      let reloadTimer: ReturnType<typeof setTimeout> | undefined;
      const invalidate = (includeConfig = false, includeComponents = false) => {
        for (const id of [RESOLVED_TREE_ID, RESOLVED_ROUTES_ID, ...(includeComponents ? ["\0" + VIRTUAL_COMPONENTS_ID] : []), ...(includeConfig ? [RESOLVED_CONFIG_ID, RESOLVED_THEME_ID] : [])]) {
          const module = server.moduleGraph.getModuleById(id); if (module) server.moduleGraph.invalidateModule(module);
        }
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => { reloadTimer = undefined; server.ws.send({ type: "full-reload" }); }, 75);
      };
      server.watcher.on("add", (file) => /.(md|mdx)$/.test(file) ? invalidate() : componentsDir && path.resolve(file).startsWith(`${path.resolve(componentsDir)}${path.sep}`) ? invalidate(false, true) : undefined);
      server.watcher.on("unlink", (file) => /.(md|mdx)$/.test(file) ? invalidate() : componentsDir && path.resolve(file).startsWith(`${path.resolve(componentsDir)}${path.sep}`) ? invalidate(false, true) : undefined);
      server.watcher.on("change", async (file) => {
        if (/\.(md|mdx)$/.test(file)) return invalidate();
        if (componentsDir && path.resolve(file).startsWith(`${path.resolve(componentsDir)}${path.sep}`)) return invalidate(false, true);
        if (CONFIG_FILENAMES.has(path.basename(file))) {
          if (!options.config) {
            resolvedConfig = await loadConfig(rootDir);
            if (resolvedConfig.contentDir) docsDir = path.resolve(rootDir, resolvedConfig.contentDir);
          }
          return invalidate(true);
        }
        if (configuredCss && path.resolve(file) === configuredCss) { const cssModule = server.moduleGraph.getModuleById(configuredCss); if (cssModule) server.moduleGraph.invalidateModule(cssModule); invalidate(); }
      });
    },
    handleHotUpdate({ file, server }) {
      const configuredCss = resolvedConfig.css ? path.resolve(rootDir, resolvedConfig.css) : undefined;
      if (configuredCss && path.resolve(file) === configuredCss) { for (const module of server.moduleGraph.getModulesByFile(configuredCss) || []) server.moduleGraph.invalidateModule(module); server.ws.send({ type: "full-reload" }); return []; }
      return undefined;
    },
  };
}
