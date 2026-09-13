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

function routeFromLocaleDirectory(page: { url: string; sourcePath?: string }, locale: string, defaultLocale: string): string {
  const sourcePath = page.sourcePath?.split("/") ?? [];
  const sourceLocale = sourcePath[0];
  if (sourceLocale !== locale) return page.url;

  const segments = page.url.split("/").filter(Boolean);
  if (locale === defaultLocale) segments.shift();
  return segments.length ? `/${segments.join("/")}` : "/";
}

function slugFromUrl(url: string): string {
  return url === "/" ? "index" : url.slice(1).replace(/\//g, "-");
}

/**
 * Normalizes page locale metadata without changing route identity or adding routes.
 * Route generation and language switching require a separate future contract.
 */
export function createI18nPlugin(options: I18nPluginOptions): FolioPlugin {
  const resolved = normalizeOptions(options);

  return createFolioPlugin(() => ({
    name: "i18n",
    pagesGenerated: (pages) => pages.map((page) => {
      const sourceLocale = page.sourcePath?.split("/")[0];
      if (sourceLocale && resolved.locales.includes(sourceLocale)) {
        const url = routeFromLocaleDirectory(page, sourceLocale, resolved.defaultLocale);
        return {
          ...page,
          slug: slugFromUrl(url),
          url,
          frontmatter: {
            ...page.frontmatter,
            [resolved.frontmatterKey]: sourceLocale,
          },
        };
      }

      const declaredLocale = page.frontmatter[resolved.frontmatterKey];
      if (declaredLocale !== undefined && String(declaredLocale) !== resolved.defaultLocale) {
        throw new Error(
          `[folio:i18n] non-default locale "${String(declaredLocale)}" must be stored under a matching locale directory`,
        );
      }
      return page;
    }),
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
