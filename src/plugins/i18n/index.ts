import { createFolioPlugin, type FolioPlugin } from "../../plugin.js";

export interface I18nPluginOptions {
  defaultLocale: string;
  locales: readonly string[];
  frontmatterKey?: string;
}

function normalizeLocale(value: string, label: string): string {
  const locale = value.trim();
  if (!locale) throw new Error(`[folio:i18n] ${label} must not be empty`);
  return locale;
}

function normalizeOptions(options: I18nPluginOptions): Required<I18nPluginOptions> {
  const defaultLocale = normalizeLocale(options.defaultLocale, "defaultLocale");
  const locales = options.locales.map((locale, index) => normalizeLocale(locale, `locales[${index}]`));
  if (locales.length === 0) throw new Error("[folio:i18n] locales must contain at least one locale");
  if (!locales.includes(defaultLocale)) {
    throw new Error(`[folio:i18n] defaultLocale "${defaultLocale}" must be included in locales`);
  }
  if (new Set(locales).size !== locales.length) {
    throw new Error("[folio:i18n] locales must not contain duplicates");
  }

  return {
    defaultLocale,
    locales,
    frontmatterKey: options.frontmatterKey?.trim() || "locale",
  };
}

/**
 * Normalizes page locale metadata without changing route identity or adding routes.
 * Route generation and language switching require a separate future contract.
 */
export function createI18nPlugin(options: I18nPluginOptions): FolioPlugin {
  const resolved = normalizeOptions(options);

  return createFolioPlugin(() => ({
    name: "i18n",
    pageTransformed: (page) => {
      const rawLocale = page.frontmatter[resolved.frontmatterKey];
      const locale = rawLocale === undefined
        ? resolved.defaultLocale
        : normalizeLocale(String(rawLocale), `frontmatter.${resolved.frontmatterKey}`);

      if (!resolved.locales.includes(locale)) {
        throw new Error(
          `[folio:i18n] unsupported locale "${locale}"; expected one of ${resolved.locales.join(", ")}`,
        );
      }

      return {
        ...page,
        frontmatter: {
          ...page.frontmatter,
          [resolved.frontmatterKey]: locale,
        },
      };
    },
  }));
}
