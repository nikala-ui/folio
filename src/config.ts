// packages/docs/src/config.ts
import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "fs-extra";
import { validateFolioPlugins } from "./plugin.js";
import type { DocsConfig } from "./types.js";

export const DEFAULT_DOCS_CONFIG: Required<Pick<DocsConfig, "title" | "description" | "contentDir">> & DocsConfig = {
  title: "Folio",
  description: "Documentation built with Nikala UI",
  favicon: "/favicon.ico",
  contentDir: "docs",
  navigation: {
    layout: "sidebar",
    navbar: [],
    sidebar: {
      nav: "auto",
      header: true,
      footer: false,
      headerSubtitle: "Documentation",
      footerText: "Documentation",
    },
  },
  theme: {
    defaultMode: "system",
  },
  shiki: {
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
    langs: [
      "typescript",
      "javascript",
      "tsx",
      "jsx",
      "bash",
      "json",
      "css",
      "html",
    ],
  },
  search: {
    enabled: true,
    provider: "local",
  },
};

export function defineDocsConfig(config: DocsConfig): DocsConfig {
  validateFolioPlugins(config.plugins);
  return config;
}

const CONFIG_FILENAMES = [
  "docs.config.ts",
  "docs.config.js",
  "docs.config.mjs",
  "nikala.docs.config.ts",
  "nikala.docs.config.js",
  "nikala.docs.config.mjs",
  // Backward compatibility for projects created before docs.config.ts.
  "nikala.config.ts",
  "nikala.config.js",
];

let configReloadRevision = 0;

export const loadConfig = resolveDocsConfig;

export async function resolveDocsConfig(cwd: string = process.cwd()): Promise<DocsConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.join(cwd, filename);
    if (await fs.pathExists(fullPath)) {
      try {
        // Config is reloaded by the dev watcher without restarting the
        // process. Bust Bun/Node's ESM module cache so changed values apply.
        const cacheKey = `${Date.now()}-${++configReloadRevision}`;
        let importPath = fullPath;
        let temporaryConfigPath: string | undefined;
        if (process.versions.bun) {
          temporaryConfigPath = path.join(
            path.dirname(fullPath),
            `.folio-config-${cacheKey}-${path.basename(fullPath)}`,
          );
          await fs.copyFile(fullPath, temporaryConfigPath);
          importPath = temporaryConfigPath;
        }
        try {
          const mod = await import(`${pathToFileURL(importPath).href}?t=${cacheKey}`);
          const resolvedUserConfig: DocsConfig = mod.default || mod.config || {};
          validateFolioPlugins(resolvedUserConfig.plugins);
          return {
            ...DEFAULT_DOCS_CONFIG,
            ...resolvedUserConfig,
            theme: {
            ...DEFAULT_DOCS_CONFIG.theme,
            ...resolvedUserConfig.theme,
          },
            navigation: {
              ...DEFAULT_DOCS_CONFIG.navigation,
              ...resolvedUserConfig.navigation,
              sidebar: {
                ...DEFAULT_DOCS_CONFIG.navigation?.sidebar,
                ...resolvedUserConfig.navigation?.sidebar,
              },
            },
            shiki: {
              ...DEFAULT_DOCS_CONFIG.shiki,
              ...resolvedUserConfig.shiki,
              themes: {
                ...DEFAULT_DOCS_CONFIG.shiki?.themes,
                ...resolvedUserConfig.shiki?.themes,
              },
            },
            seo: {
              ...resolvedUserConfig.seo,
            },
            search: {
              ...DEFAULT_DOCS_CONFIG.search,
              ...resolvedUserConfig.search,
            },
          };
        } finally {
          if (temporaryConfigPath) await fs.remove(temporaryConfigPath);
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("[folio]")) throw error;
        console.warn(`[folio] Failed to load config from ${filename}:`, error);
      }
    }
  }

  return DEFAULT_DOCS_CONFIG;
}
