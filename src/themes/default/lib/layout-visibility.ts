import type { DocsConfig, PageData, TocItem } from "../../../types.js";

export function isLandingPage(page: PageData | undefined, config: DocsConfig): boolean {
  return page?.url === "/" && config.home?.layout === "landing";
}

export function shouldShowLandingSidebar(config: DocsConfig): boolean {
  return config.home?.showSidebar === true;
}

export function shouldShowNavbar(config: DocsConfig): boolean {
  return config.home?.showNavbar !== false;
}

export function shouldShowToc(
  toc: TocItem[] | undefined,
  page: PageData | undefined,
  config: DocsConfig,
  landingPage: boolean,
): boolean {
  return Boolean(
    toc &&
    toc.length > 0 &&
    page?.frontmatter?.toc !== false &&
    (!landingPage || config.home?.showToc === true),
  );
}

export function shouldUseSidebarLayout(config: DocsConfig): boolean {
  return config.navigation?.layout !== "top";
}

export function shouldShowSidebarHeader(config: DocsConfig): boolean {
  return config.navigation?.sidebar?.header !== false;
}

export function shouldShowSidebarFooter(config: DocsConfig): boolean {
  return config.navigation?.sidebar?.footer !== false;
}
