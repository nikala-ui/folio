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
    const secondPlugin: FolioPlugin = {
      name: "metadata-chain",
      pageTransformed: (page) => {
        calls.push(`second-transformed:${page.url}`);
        return page.url === "/guide" ? { ...page, title: "Chained Guide" } : page;
      },
    };

    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs.config.ts"), "export default {};");
    await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: Home\n---\n\n# Home\n");
    await writeFile(path.join(root, "docs", "guide.mdx"), "---\ntitle: Guide\n---\n\n# Guide\n");

    try {
      await buildDocs({ root, outDir: "out", config: { title: "Test Docs", plugins: [plugin, secondPlugin] } });
      const guideHtml = await readFile(path.join(output, "guide", "index.html"), "utf8");

      expect(guideHtml).toContain("Chained Guide");
      expect(calls[0]).toBe("configResolved");
      expect(calls[1]).toBe("buildStart");
      expect(calls.filter((call) => call.startsWith("collected:")).length).toBe(2);
      expect(calls.filter((call) => call.startsWith("transformed:")).length).toBe(2);
      expect(calls.indexOf("second-transformed:/guide")).toBeGreaterThan(calls.indexOf("transformed:/guide"));
      expect(calls.indexOf("generate")).toBeGreaterThan(calls.findIndex((call) => call.startsWith("transformed:")));
      expect(calls.at(-1)).toBe("buildEnd:true");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("rebuilds the development session and replaces pages on reload", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-dev-reload-"));
    const calls: string[] = [];
    const plugin: FolioPlugin = {
      name: "dev-reload-observer",
      configResolved: (context) => { calls.push(`config:${context.mode}`); },
      buildStart: (context) => { calls.push(`start:${context.mode}`); },
      pageTransformed: (page, context) => {
        calls.push(`page:${page.title}:${context.mode}`);
        return page;
      },
    };
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: First\n---\n\n# First\n");

    try {
      const session = createFolioBuildSession({
        plugins: [plugin],
        config: { title: "Dev Docs", plugins: [plugin] },
        rootDir: root,
        contentDir: path.join(root, "docs"),
        mode: "development",
      });
      expect((await session.pages()).map((page) => page.title)).toEqual(["First"]);
      await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: Second\n---\n\n# Second\n");
      expect((await session.reload()).map((page) => page.title)).toEqual(["Second"]);
      expect(calls).toEqual([
        "config:development", "start:development", "page:First:development",
        "config:development", "start:development", "page:Second:development",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("keeps the last successful development catalog after a failed reload", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-dev-reload-failure-"));
    const cause = new Error("invalid development metadata");
    const plugin: FolioPlugin = {
      name: "dev-reload-failure",
      pageTransformed: (page) => {
        if (page.title === "Broken") throw cause;
        return page;
      },
    };
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: Stable\n---\n\n# Stable\n");

    try {
      const session = createFolioBuildSession({
        plugins: [plugin],
        config: { title: "Dev Docs", plugins: [plugin] },
        rootDir: root,
        contentDir: path.join(root, "docs"),
        mode: "development",
      });
      expect((await session.pages()).map((page) => page.title)).toEqual(["Stable"]);
      await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: Broken\n---\n\n# Broken\n");
      await expect(session.reload()).rejects.toMatchObject({
        name: "FolioPluginHookError",
        pluginName: "dev-reload-failure",
        hook: "pageTransformed",
        cause,
      });
      expect((await session.pages()).map((page) => page.title)).toEqual(["Stable"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("does not let a stale concurrent reload replace the newest catalog", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-dev-concurrent-reload-"));
    let releaseFirst!: () => void;
    let firstReloadStarted!: () => void;
    let delayNext = false;
    const firstReloadReady = new Promise<void>((resolve) => { firstReloadStarted = resolve; });
    const firstReloadGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const plugin: FolioPlugin = {
      name: "concurrent-reload-plugin",
      pageTransformed: async (page) => {
        if (delayNext) {
          delayNext = false;
          firstReloadStarted();
          await firstReloadGate;
        }
        return page;
      },
    };
    await mkdir(path.join(root, "docs"));
    const pagePath = path.join(root, "docs", "index.mdx");
    await writeFile(pagePath, "---\ntitle: Initial\n---\n\n# Initial\n");

    try {
      const session = createFolioBuildSession({
        plugins: [plugin],
        config: { title: "Dev Docs", plugins: [plugin] },
        rootDir: root,
        contentDir: path.join(root, "docs"),
        mode: "development",
      });
      await session.pages();
      delayNext = true;
      await writeFile(pagePath, "---\ntitle: Older\n---\n\n# Older\n");
      const staleReload = session.reload();
      await firstReloadReady;
      await writeFile(pagePath, "---\ntitle: Newest\n---\n\n# Newest\n");
      const newestReload = session.reload();
      releaseFirst();
      expect((await newestReload).map((page) => page.title)).toEqual(["Newest"]);
      expect((await staleReload).map((page) => page.title)).toEqual(["Newest"]);
      expect((await session.pages()).map((page) => page.title)).toEqual(["Newest"]);
    } finally {
      releaseFirst?.();
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("keeps development lifecycle state bounded across repeated reloads", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-dev-repeated-reload-"));
    let starts = 0;
    let transformed = 0;
    const plugin: FolioPlugin = {
      name: "repeated-reload-plugin",
      buildStart: () => { starts += 1; },
      pageTransformed: (page) => { transformed += 1; return page; },
    };
    await mkdir(path.join(root, "docs"));
    const pagePath = path.join(root, "docs", "index.mdx");
    await writeFile(pagePath, "---\ntitle: 0\n---\n\n# 0\n");

    try {
      const session = createFolioBuildSession({
        plugins: [plugin],
        config: { title: "Dev Docs", plugins: [plugin] },
        rootDir: root,
        contentDir: path.join(root, "docs"),
        mode: "development",
      });
      await session.pages();
      for (let version = 1; version <= 8; version += 1) {
        await writeFile(pagePath, `---\ntitle: ${version}\n---\n\n# ${version}\n`);
        expect((await session.reload()).map((page) => String(page.title))).toEqual([String(version)]);
        expect(session.getPages()).toHaveLength(1);
      }
      expect(starts).toBe(9);
      expect(transformed).toBe(9);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  test("stops a production build on plugin failure and reports a failed result", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-plugin-failure-"));
    const calls: string[] = [];
    const cause = new Error("invalid page metadata");
    const plugin: FolioPlugin = {
      name: "failing-build-plugin",
      pageTransformed: () => { throw cause; },
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
      expect((failure as Error).message).toContain('route "/"');
      expect((failure as Error).message).toContain('source "index.mdx"');
      expect((failure as Error).message).toContain('mode "production"');
      expect((failure as { cause?: unknown }).cause).toBe(cause);
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
      import path from "node:path";
      import { writeFile } from "node:fs/promises";

      const immutableContext = { config: false, pages: false };
      export default {
        title: "Config Plugin Docs",
        plugins: [{
          name: "config-loaded-plugin",
          configResolved(context) {
            try {
              (context.config as { title?: string }).title = "mutated";
            } catch {
              immutableContext.config = true;
            }
          },
          pageTransformed(page, context) {
            try {
              (context.pages as Array<unknown>).push(page);
            } catch {
              immutableContext.pages = true;
            }
            return page.url === "/guide"
              ? { ...page, title: "Config Transformed Guide", frontmatter: { ...page.frontmatter, order: -1 } }
              : page;
          },
          async generate(context) {
            await writeFile(
              path.join(context.outputDir, "plugin-generate-result.json"),
              JSON.stringify({ outputDir: context.outputDir, urls: context.pages.map((page) => page.url) }),
            );
          },
          async buildEnd(result) {
            await writeFile(
              path.join(result.outputDir, "plugin-build-result.json"),
              JSON.stringify({ success: result.success, outputDir: result.outputDir, urls: result.pages.map((page) => page.url) }),
            );
            await writeFile(path.join(result.outputDir, "plugin-immutability-result.json"), JSON.stringify(immutableContext));
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
        outputDir: firstOutput,
        mode: "production",
      });
      await buildDocs({ root, outDir: "first", lifecycleSession: firstSession });
      await rm(path.join(root, "docs", "api.mdx"));
      const secondSession = createFolioBuildSession({
        plugins: config.plugins,
        config,
        rootDir: root,
        contentDir: path.join(root, "docs"),
        outputDir: secondOutput,
        mode: "production",
      });
      await buildDocs({ root, outDir: "second", lifecycleSession: secondSession });
      const firstGuide = await readFile(path.join(firstOutput, "guide", "index.html"), "utf8");
      const secondGuide = await readFile(path.join(secondOutput, "guide", "index.html"), "utf8");
      const firstBuildResult = JSON.parse(await readFile(path.join(firstOutput, "plugin-build-result.json"), "utf8")) as { success: boolean; outputDir: string; urls: string[] };
      const secondBuildResult = JSON.parse(await readFile(path.join(secondOutput, "plugin-build-result.json"), "utf8")) as { success: boolean; outputDir: string; urls: string[] };
      const firstImmutabilityResult = JSON.parse(await readFile(path.join(firstOutput, "plugin-immutability-result.json"), "utf8")) as { config: boolean; pages: boolean };
      const firstGenerateResult = JSON.parse(await readFile(path.join(firstOutput, "plugin-generate-result.json"), "utf8")) as { outputDir: string; urls: string[] };
      const firstAssets = await readdir(path.join(firstOutput, "assets"));
      const firstBundle = (await Promise.all(firstAssets.map((asset) => readFile(path.join(firstOutput, "assets", asset), "utf8")))).join("\n");
      const firstPages = [...await firstSession.pages()];

      expect(firstGuide).toContain("<title>Config Transformed Guide - Config Plugin Docs</title>");
      expect(secondGuide).toContain("Config Transformed Guide");
      expect(firstBuildResult).toEqual({ success: true, outputDir: firstOutput, urls: ["/", "/api", "/guide"] });
      expect(secondBuildResult).toEqual({ success: true, outputDir: secondOutput, urls: ["/", "/guide"] });
      expect(firstImmutabilityResult).toEqual({ config: true, pages: true });
      expect(firstGenerateResult).toEqual({ outputDir: firstOutput, urls: ["/", "/api", "/guide"] });
      expect(firstBundle.includes("Config Transformed Guide")).toBe(true);
      expect(firstBundle.includes("order:-1")).toBe(true);
      const generatedGuideTitle = firstBundle.lastIndexOf("Config Transformed Guide");
      const generatedApiTitle = firstBundle.lastIndexOf("API");
      expect(generatedGuideTitle).toBeGreaterThanOrEqual(0);
      expect(generatedApiTitle).toBeGreaterThan(generatedGuideTitle);
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
