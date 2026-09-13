import { describe, expect, test } from "bun:test";
import { createFolioPluginLifecycleManager } from "../src/core/plugin/index.js";
import { createI18nPlugin } from "../src/plugins/i18n/index.js";
import type { FolioPage } from "../src/plugin.js";

const page: FolioPage = {
  slug: "guide/start",
  url: "/guide/start",
  filePath: "/docs/guide/start.mdx",
  sourcePath: "guide/start.mdx",
  frontmatter: { title: "Start" },
  toc: [],
  title: "Start",
};

function manager(frontmatter = page.frontmatter) {
  return createFolioPluginLifecycleManager({
    plugins: [createI18nPlugin({ defaultLocale: "en", locales: ["en", "ka"] })],
    config: { title: "Docs" },
    rootDir: "/project",
    contentDir: "/project/docs",
    mode: "production",
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    pages: [{ ...page, frontmatter }],
  });
}

describe("i18n plugin", () => {
  test("adds the default locale without changing route identity", async () => {
    const current = { ...page, frontmatter: { ...page.frontmatter } };
    const transformed = await manager().pageTransformed(current);

    expect(transformed.frontmatter.locale).toBe("en");
    expect(transformed.slug).toBe(page.slug);
    expect(transformed.url).toBe(page.url);
  });

  test("preserves a supported locale from frontmatter", async () => {
    const transformed = await manager({ ...page.frontmatter, locale: "ka" }).pageTransformed({
      ...page,
      frontmatter: { ...page.frontmatter, locale: "ka" },
    });

    expect(transformed.frontmatter.locale).toBe("ka");
  });

  test("rejects unsupported locales", async () => {
    const lifecycle = manager({ ...page.frontmatter, locale: "fr" });

    await expect(lifecycle.pageTransformed({
      ...page,
      frontmatter: { ...page.frontmatter, locale: "fr" },
    })).rejects.toMatchObject({
      pluginName: "i18n",
      hook: "pageTransformed",
    });
  });

  test("validates the default locale configuration", () => {
    expect(() => createI18nPlugin({ defaultLocale: "en", locales: ["ka"] })).toThrow(
      'defaultLocale "en" must be included in locales',
    );
  });
});
