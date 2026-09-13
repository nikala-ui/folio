import type { PageData, SidebarItem } from "../../types.js";

export function getPageLocale(page: PageData): string | undefined {
  const locale = page.frontmatter.locale;
  return typeof locale === "string" ? locale : undefined;
}

export function getPageTranslationKey(page: PageData): string {
  const locale = getPageLocale(page);
  const sourcePath = page.sourcePath || page.url;
  const prefix = locale ? `${locale}/` : "";
  return locale && sourcePath.startsWith(prefix) ? sourcePath.slice(prefix.length) : sourcePath;
}

export function findLocalizedPage(
  pages: readonly PageData[],
  page: PageData | undefined,
  locale: string,
): PageData | undefined {
  if (!page) return undefined;
  const key = getPageTranslationKey(page);
  return pages.find((candidate) => getPageLocale(candidate) === locale && getPageTranslationKey(candidate) === key);
}

export function localizeSidebarTree(
  tree: readonly SidebarItem[],
  pages: readonly PageData[],
  locale: string,
): SidebarItem[] {
  const localizedPages = new Map(
    pages
      .filter((page) => getPageLocale(page) === locale)
      .map((page) => [getPageTranslationKey(page), page]),
  );
  const pageByHref = new Map(pages.map((page) => [page.url, page]));

  const localize = (item: SidebarItem): SidebarItem => {
    const sourcePage = item.href ? pageByHref.get(item.href) : undefined;
    const localizedPage = sourcePage ? localizedPages.get(getPageTranslationKey(sourcePage)) : undefined;
    return {
      ...item,
      title: localizedPage?.title || item.title,
      href: localizedPage?.url || item.href,
      items: item.items?.map(localize),
    };
  };

  return tree.map(localize);
}
