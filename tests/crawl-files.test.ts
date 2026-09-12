import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config.js";
import { buildDocs } from "../src/server/index.js";
import { createFolioBuildSession } from "../src/server/plugin/lifecycle.js";
import { buildSidebarTree } from "../src/core/route-tree.js";
import { createPageNavigation } from "../src/client/navigation/page-navigation.js";
import type { FolioPlugin } from "../src/plugin.js";

async function createFixture(siteUrl?: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), "folio-crawl-files-"));
  await writeFile(path.join(root, "docs.config.ts"), "export default {};");
  await mkdir(path.join(root, "docs"));
  await writeFile(
    path.join(root, "docs", "index.mdx"),
    "---\ntitle: Home\ndescription: Welcome home.\n---\n\n# Home\n",
  );
  await writeFile(
    path.join(root, "docs", "guide.mdx"),
    "---\ntitle: Guide\ndescription: A guide.\nupdatedAt: 2026-09-11\n---\n\n# Guide\n",
  );
  await writeFile(
    path.join(root, "docs", "internal.mdx"),
    "---\ntitle: Internal\nnoindex: true\n---\n\n# Internal\n",
  );

  const output = path.join(root, "out");
  await buildDocs({
    root,
    outDir: "out",
    config: { title: "Test Docs", description: "Test documentation", siteUrl },
  });
  return { root, output };
}

describe("generated crawl files", () => {
  test("generates sitemap and robots for a configured site URL", async () => {
    const fixture = await createFixture("https://docs.example.test");
    try {
      const sitemap = await readFile(path.join(fixture.output, "sitemap.xml"), "utf8");
      const robots = await readFile(path.join(fixture.output, "robots.txt"), "utf8");

      expect(sitemap).toContain("https://docs.example.test/");
      expect(sitemap).toContain("https://docs.example.test/guide");
      expect(sitemap).toContain("<lastmod>2026-09-11</lastmod>");
      expect(sitemap).not.toContain("https://docs.example.test/internal");
      expect(robots).toContain("User-agent: *");
      expect(robots).toContain("Allow: /");
      expect(robots).toContain("Sitemap: https://docs.example.test/sitemap.xml");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 30_000);

  test("does not generate absolute crawl files without a site URL", async () => {
    const fixture = await createFixture();
    try {
      await assert.rejects(readFile(path.join(fixture.output, "sitemap.xml"), "utf8"));
      await assert.rejects(readFile(path.join(fixture.output, "robots.txt"), "utf8"));
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 30_000);

  test("keeps plugin-less builds unchanged", async () => {
    const fixture = await createFixture();
    try {
      const guideHtml = await readFile(path.join(fixture.output, "guide", "index.html"), "utf8");
      expect(guideHtml).toContain("<h1>Guide</h1>");
      expect(guideHtml).not.toContain("Config Transformed Guide");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }, 30_000);

  test("runs the plugin lifecycle before generating transformed pages", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-plugin-build-"));
    const output = path.join(root, "out");
    const calls: string[] = [];
    const plugin: FolioPlugin = {
      name: "build-observer",
      configResolved: () => { calls.push("configResolved"); },
      buildStart: () => { calls.push("buildStart"); },
      pageCollected: (page) => { calls.push(`collected:${page.url}`); },
      pageTransformed: (page) => {
        calls.push(`transformed:${page.url}`);
        return page.url === "/guide"
          ? { ...page, title: "Transformed Guide", frontmatter: { ...page.frontmatter, order: 1 } }
          : page;
      },
      generate: () => { calls.push("generate"); },
      buildEnd: (result) => { calls.push(`buildEnd:${result.success}`); },
    };

    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs.config.ts"), "export default {};");
    await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: Home\n---\n\n# Home\n");
    await writeFile(path.join(root, "docs", "guide.mdx"), "---\ntitle: Guide\n---\n\n# Guide\n");

    try {
      await buildDocs({ root, outDir: "out", config: { title: "Test Docs", plugins: [plugin] } });
      const guideHtml = await readFile(path.join(output, "guide", "index.html"), "utf8");

      expect(guideHtml).toContain("Transformed Guide");
      expect(calls[0]).toBe("configResolved");
      expect(calls[1]).toBe("buildStart");
      expect(calls.filter((call) => call.startsWith("collected:")).length).toBe(2);
      expect(calls.filter((call) => call.startsWith("transformed:")).length).toBe(2);
      expect(calls.indexOf("generate")).toBeGreaterThan(calls.findIndex((call) => call.startsWith("transformed:")));
      expect(calls.at(-1)).toBe("buildEnd:true");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("stops a production build on plugin failure and reports a failed result", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-plugin-failure-"));
    const calls: string[] = [];
    const plugin: FolioPlugin = {
      name: "failing-build-plugin",
      pageTransformed: () => { throw new Error("invalid page metadata"); },
      buildEnd: (result) => { calls.push(`buildEnd:${result.success}`); },
    };

    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs.config.ts"), "export default {};");
    await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: Home\n---\n\n# Home\n");

    try {
      let failure: unknown;
      try {
        await buildDocs({
          root,
          outDir: "out",
          config: { title: "Test Docs", plugins: [plugin] },
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain('Plugin "failing-build-plugin" hook "pageTransformed" failed');
      expect(calls).toEqual(["buildEnd:false"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("loads registered plugins from docs.config.ts and isolates build state", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-config-plugin-"));
    const firstOutput = path.join(root, "first");
    const secondOutput = path.join(root, "second");
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs.config.ts"), `
      export default {
        title: "Config Plugin Docs",
        plugins: [{
          name: "config-loaded-plugin",
          pageTransformed(page) {
            return page.url === "/guide"
              ? { ...page, title: "Config Transformed Guide", frontmatter: { ...page.frontmatter, order: -1 } }
              : page;
          }
        }]
      };
    `);
    await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: Home\ndescription: Home page\n---\n\n# Home\n");
    await writeFile(path.join(root, "docs", "guide.mdx"), "---\ntitle: Guide\ndescription: Guide page\n---\n\n# Guide\n");
    await writeFile(path.join(root, "docs", "api.mdx"), "---\ntitle: API\ndescription: API page\n---\n\n# API\n");

    try {
      const config = await loadConfig(root);
      const firstSession = createFolioBuildSession({
        plugins: config.plugins,
        config,
        rootDir: root,
        contentDir: path.join(root, "docs"),
        mode: "production",
      });
      await buildDocs({ root, outDir: "first", lifecycleSession: firstSession });
      await rm(path.join(root, "docs", "api.mdx"));
      const secondSession = createFolioBuildSession({
        plugins: config.plugins,
        config,
        rootDir: root,
        contentDir: path.join(root, "docs"),
        mode: "production",
      });
      await buildDocs({ root, outDir: "second", lifecycleSession: secondSession });
      const firstGuide = await readFile(path.join(firstOutput, "guide", "index.html"), "utf8");
      const secondGuide = await readFile(path.join(secondOutput, "guide", "index.html"), "utf8");
      const firstAssets = await readdir(path.join(firstOutput, "assets"));
      const firstBundle = (await Promise.all(firstAssets.map((asset) => readFile(path.join(firstOutput, "assets", asset), "utf8")))).join("\n");
      const firstPages = [...await firstSession.pages()];

      expect(firstGuide).toContain("<title>Config Transformed Guide - Config Plugin Docs</title>");
      expect(secondGuide).toContain("Config Transformed Guide");
      expect(firstBundle.includes("Config Transformed Guide")).toBe(true);
      expect(firstBundle.includes("order:-1")).toBe(true);
      await assert.rejects(access(path.join(secondOutput, "api", "index.html")));
      const guide = firstPages.find((page) => page.url === "/guide");
      const sidebarTree = buildSidebarTree(firstPages);
      const sidebarOutput = JSON.stringify(sidebarTree);
      expect(sidebarOutput).toContain("Config Transformed Guide");
      expect(sidebarOutput.indexOf("Config Transformed Guide")).toBeLessThan(sidebarOutput.indexOf("API"));
      const navigation = createPageNavigation(() => guide, firstPages, sidebarTree);
      expect(navigation.nextPage()).toEqual({ title: "API", href: "/api" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
