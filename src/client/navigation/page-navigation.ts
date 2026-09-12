import { createMemo, type Accessor } from "solid-js";
import { buildPagination } from "../../core/route-tree.js";
import type { BreadcrumbItemData } from "../../themes/types.js";
import type { PageData, SidebarItem, TocItem } from "../../types.js";

export function createPageNavigation(currentPage: Accessor<PageData | undefined>, pages: PageData[], sidebarTree: SidebarItem[]) {
  const breadcrumbs = createMemo<BreadcrumbItemData[]>(() => {
    const page = currentPage();
    if (!page) return [];
    const segments = page.url.split("/").filter(Boolean);
    const items: BreadcrumbItemData[] = [{ title: "Docs", href: "/" }];
    let accumulated = "";
    for (let index = 0; index < segments.length; index++) {
      accumulated += `/${segments[index]}`;
      const isLast = index === segments.length - 1;
      const matchingPage = pages.find((item) => item.url === accumulated);
      items.push({
        title: matchingPage?.title || segments[index].replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        href: isLast ? undefined : accumulated,
      });
    }
    return items;
  });

  const toc = createMemo<TocItem[]>(() => currentPage()?.toc || []);
  const pagination = createMemo(() => {
    const page = currentPage();
    return page ? buildPagination(pages, page.url, sidebarTree) : {};
  });
  const prevPage = createMemo(() => pagination().prev);
  const nextPage = createMemo(() => pagination().next);
  return { breadcrumbs, toc, prevPage, nextPage };
}
