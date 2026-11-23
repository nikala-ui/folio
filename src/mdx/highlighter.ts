// packages/docs/src/mdx/highlighter.ts
import {
  type BundledLanguage,
  type BundledTheme,
  type Highlighter,
} from "shiki";
import { createBundledHighlighter } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { ShikiConfig } from "../types.js";
import { languageLoaders, normalizeLangAlias } from "./builtin-languages.js";
import { createCustomLanguageIndex, type CustomLanguageIndex } from "./custom-languages.js";

let highlighterPromise: Promise<Highlighter> | null = null;
let activeShikiConfig: ShikiConfig | null = null;
let activeShikiConfigKey: string | null = null;
let activeAllowedLanguages: Set<string> | null = null;
let activeCustomLanguages: CustomLanguageIndex = new Map();

const DEFAULT_BASE_LANGS: BundledLanguage[] = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "bash",
  "json",
  "css",
  "html",
  "markdown",
  "mdx",
  "rust",
  "python",
  "yaml",
  "toml",
  "sql",
  "diff",
];

const DEFAULT_LIGHT_THEME: BundledTheme = "github-light";
const DEFAULT_DARK_THEME: BundledTheme = "github-dark";

const themeLoaders = {
  "github-light": () => import("@shikijs/themes/github-light"),
  "github-dark": () => import("@shikijs/themes/github-dark"),
} as const;

const createDocsHighlighter = createBundledHighlighter({
  langs: languageLoaders,
  themes: themeLoaders,
  engine: () => createJavaScriptRegexEngine(),
});

export function configureDocsHighlighter(config: ShikiConfig): void {
  activeCustomLanguages = createCustomLanguageIndex(config.customLangs);
  activeShikiConfig = config;
  activeShikiConfigKey = JSON.stringify(config);
  activeAllowedLanguages = config.langs
    ? new Set(config.langs.map(normalizeLangAlias).filter((lang) => lang in languageLoaders))
    : null;
  highlighterPromise = null; // Re-initialize with new configuration
}

export async function getDocsHighlighter(config?: ShikiConfig): Promise<Highlighter> {
  const configKey = JSON.stringify(config ?? null);
  if (configKey !== activeShikiConfigKey) {
    configureDocsHighlighter(config ?? {});
  }

  if (!highlighterPromise) {
    const configuredLanguages = activeShikiConfig?.langs
      ?.map(normalizeLangAlias)
      .filter((lang): lang is BundledLanguage => lang in languageLoaders) as BundledLanguage[] | undefined;

    highlighterPromise = createDocsHighlighter({
      // Keep the core highlighter small. Project-specific themes and
      // languages are loaded by ensureTheme/ensureLanguage on demand.
      themes: [DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME],
      langs: configuredLanguages ?? DEFAULT_BASE_LANGS,
    }) as Promise<Highlighter>;
  }

  return highlighterPromise;
}

/**
 * Ensures a language is loaded in Shiki on-demand.
 * Custom languages from `shiki.customLangs` are matched first by name or alias;
 * otherwise a bundled language is loaded dynamically.
 * Returns the resolved language identifier or "text" as fallback.
 */
export async function ensureLanguage(highlighter: Highlighter, rawLang: string): Promise<string> {
  const normalized = normalizeLangAlias(rawLang);

  const custom = activeCustomLanguages.get(normalized);
  if (custom) {
    if (highlighter.getLoadedLanguages().includes(custom.name)) return custom.name;
    try {
      await highlighter.loadLanguage(custom);
      return custom.name;
    } catch (err) {
      console.warn(`[folio] Failed to load custom Shiki language "${custom.name}":`, err);
      return "text";
    }
  }

  if (!normalized || normalized === "text" || normalized === "txt" || normalized === "plain") {
    return "text";
  }

  if (activeAllowedLanguages && !activeAllowedLanguages.has(normalized)) {
    return "text";
  }

  const loaded = highlighter.getLoadedLanguages();
  if (loaded.includes(normalized)) {
    return normalized;
  }

  if (normalized in languageLoaders) {
    try {
      await highlighter.loadLanguage(normalized as keyof typeof languageLoaders);
      return normalized;
    } catch (err) {
      console.warn(`[folio] Failed to dynamically load Shiki language "${normalized}":`, err);
    }
  }

  return "text";
}

/**
 * Ensures a theme is loaded in Shiki on-demand.
 */
export async function ensureTheme(highlighter: Highlighter, themeName: string): Promise<string> {
  const loaded = highlighter.getLoadedThemes();
  if (loaded.includes(themeName)) {
    return themeName;
  }

  if (themeName in themeLoaders) {
    try {
      await highlighter.loadTheme(themeName as keyof typeof themeLoaders);
      return themeName;
    } catch (err) {
      console.warn(`[folio] Failed to dynamically load Shiki theme "${themeName}":`, err);
    }
  }

  // Shiki publishes themes as individually addressable package exports. Use
  // a runtime subpath import so configured themes remain supported without
  // eagerly bundling the complete theme catalog.
  try {
    const module = await import(`@shikijs/themes/${themeName}`);
    await highlighter.loadTheme(module.default || module);
    return themeName;
  } catch (err) {
    console.warn(`[folio] Failed to dynamically load Shiki theme "${themeName}":`, err);
  }

  return DEFAULT_DARK_THEME;
}

export interface HighlightOptions {
  lang?: string;
  filename?: string;
  themeLight?: string;
  themeDark?: string;
}

export async function highlightCode(code: string, options: HighlightOptions = {}): Promise<string> {
  const highlighter = await getDocsHighlighter();
  const rawLang = options.lang || "text";
  const targetLang = await ensureLanguage(highlighter, rawLang);

  const themeLight = options.themeLight
    ? await ensureTheme(highlighter, options.themeLight)
    : (activeShikiConfig?.themes?.light as BundledTheme) || DEFAULT_LIGHT_THEME;

  const themeDark = options.themeDark
    ? await ensureTheme(highlighter, options.themeDark)
    : (activeShikiConfig?.themes?.dark as BundledTheme) || DEFAULT_DARK_THEME;

  return highlighter.codeToHtml(code.trimEnd(), {
    lang: targetLang,
    themes: {
      light: themeLight,
      dark: themeDark,
    },
    defaultColor: false,
  });
}
