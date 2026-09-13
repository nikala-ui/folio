import path from "node:path";
import fs from "fs-extra";

export const SITE_TRANSLATION_KEYS = [
  "navigation.search",
  "navigation.searchLabel",
  "navigation.toggleSidebar",
  "navigation.closeSidebar",
  "navigation.documentation",
  "navigation.primary",
  "navigation.github",
  "navigation.chooseLanguage",
  "navigation.toggleNavigation",
  "navigation.toggleSidebarRail",
  "navigation.sidebar",
  "navigation.collapse",
  "navigation.expand",
  "navigation.breadcrumb",
  "actions.viewSource",
  "actions.copyPage",
  "actions.copyAsMarkdown",
  "actions.learnMore",
  "actions.copyDocumentationPage",
  "actions.openInProvider",
  "actions.copied",
  "actions.prompt",
  "actions.copyContext",
  "actions.copyCliCommand",
  "actions.copyCode",
  "actions.exitFullscreen",
  "actions.expandFullscreen",
  "tableOfContents.title",
  "search.placeholder",
  "search.empty",
  "search.pages",
  "search.by",
  "search.commandPlaceholder",
  "search.noResults",
  "pagination.previous",
  "pagination.next",
  "theme.toggle",
  "theme.light",
  "theme.dark",
  "theme.system",
  "theme.mode",
  "theme.brandAccentColor",
  "theme.borderRadius",
  "viewer.preview",
  "viewer.code",
  "viewer.desktopViewport",
  "viewer.tabletViewport",
  "viewer.mobileViewport",
  "viewer.desktopSize",
  "viewer.tabletSize",
  "viewer.mobileSize",
  "viewer.toggleBackgroundGrid",
  "viewer.canvasGrid",
  "viewer.resetPreviewCanvas",
  "viewer.resetCanvas",
  "viewer.copyAiContext",
  "viewer.copyCodeForAi",
  "viewer.copyCliInstallation",
  "viewer.fullscreenPreview",
  "viewer.exitFullscreen",
  "code.copied",
  "code.copy",
  "command.navigate",
  "command.select",
  "command.close",
  "image.avatar",
  "status.loading",
  "status.loadingLabel",
  "accessibility.callout",
  "errors.pageNotFound",
  "errors.pageNotFoundDescription",
  "apiTable.property",
  "apiTable.type",
  "apiTable.default",
  "apiTable.description",
] as const;

export type SiteTranslationKey = (typeof SITE_TRANSLATION_KEYS)[number];
export type SiteTranslations = Record<SiteTranslationKey, string>;

export interface DocsUiLocaleConfig {
  defaultLocale?: string;
  directory?: string;
  locale?: string;
  translations?: Record<string, Partial<SiteTranslations>>;
}

const KEY_SET = new Set<string>(SITE_TRANSLATION_KEYS);

function validateLocale(locale: string, value: unknown): Partial<SiteTranslations> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`[folio] Translation file for locale "${locale}" must contain a JSON object`);
  }
  const entries = Object.entries(value);
  for (const [key, translation] of entries) {
    if (!KEY_SET.has(key)) throw new Error(`[folio] Unknown site translation key "${key}" in locale "${locale}"`);
    if (typeof translation !== "string") throw new Error(`[folio] Translation "${locale}.${key}" must be a string`);
  }
  return value as Partial<SiteTranslations>;
}

export async function loadSiteTranslations(
  rootDir: string,
  config: DocsUiLocaleConfig = {},
): Promise<DocsUiLocaleConfig> {
  const defaultLocale = config.defaultLocale || "en";
  const directory = config.directory || "locales";
  const localeDir = path.resolve(rootDir, directory);
  const translations: Record<string, Partial<SiteTranslations>> = {};

  if (await fs.pathExists(localeDir)) {
    const files = (await fs.readdir(localeDir))
      .filter((file) => file.endsWith(".json"))
      .sort();
    for (const file of files) {
      const locale = path.basename(file, ".json");
      translations[locale] = validateLocale(locale, await fs.readJson(path.join(localeDir, file)));
    }
  }

  if (!translations[defaultLocale]) translations[defaultLocale] = {};
  return { ...config, defaultLocale, directory, locale: config.locale || defaultLocale, translations };
}

export function getSiteTranslation(
  config: DocsUiLocaleConfig | undefined,
  key: SiteTranslationKey,
): string {
  const locale = config?.locale || config?.defaultLocale || "en";
  const defaultLocale = config?.defaultLocale || "en";
  return config?.translations?.[locale]?.[key]
    || config?.translations?.[defaultLocale]?.[key]
    || key;
}
