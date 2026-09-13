import { describe, expect, test } from "bun:test";
import {
  isLandingPage,
  shouldShowNavbar,
  shouldShowToc,
  shouldUseSidebarLayout,
} from "../src/themes/default/lib/layout-visibility.js";
import type { DocsConfig, PageData } from "../src/types.js";

const page = {
  slug: "guide",
  url: "/guide",
  filePath: "guide.mdx",
  frontmatter: {},
  toc: [{ id: "intro", text: "Introduction", depth: 2 }],
  title: "Guide",
} satisfies PageData;

describe("default theme layout visibility", () => {
  test("recognizes only the configured landing page", () => {
    const config = { home: { layout: "landing" } } satisfies DocsConfig;
    expect(isLandingPage({ ...page, url: "/" }, config)).toBe(true);
    expect(isLandingPage(page, config)).toBe(false);
  });

  test("honors navbar and sidebar layout configuration", () => {
    expect(shouldShowNavbar({ home: { showNavbar: false } })).toBe(false);
    expect(shouldUseSidebarLayout({ navigation: { layout: "top" } })).toBe(false);
    expect(shouldUseSidebarLayout({ navigation: { layout: "sidebar" } })).toBe(true);
  });

  test("shows toc only when page and landing settings allow it", () => {
    const config = {} satisfies DocsConfig;
    expect(shouldShowToc(page.toc, page, config, false)).toBe(true);
    expect(shouldShowToc(page.toc, { ...page, frontmatter: { toc: false } }, config, false)).toBe(false);
    expect(shouldShowToc(page.toc, page, config, true)).toBe(false);
    expect(shouldShowToc(page.toc, page, { home: { showToc: true } }, true)).toBe(true);
  });
});
