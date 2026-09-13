import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import {
  createFolioPluginLifecycleManager,
  FolioPluginHookError,
} from "../src/core/plugin/index.js";
import type { FolioPage, FolioPlugin } from "../src/plugin.js";
import { createClickMePlugin } from "../src/plugins/click-me/index.js";
import { nikalaDocsPlugin } from "../src/server/plugin/index.js";
import { RESOLVED_TREE_ID } from "../src/server/plugin/constants.js";

const page: FolioPage = {
  slug: "guide/start",
  url: "/guide/start",
  filePath: "/docs/guide/start.mdx",
  frontmatter: { title: "Start", metadata: { source: "docs" } },
  toc: [],
  title: "Start",
};

function manager(
  plugins: readonly FolioPlugin[] = [],
  pages: readonly FolioPage[] = [],
  mode: "development" | "production" = "production",
) {
  return createFolioPluginLifecycleManager({
    plugins,
    config: { title: "Docs", navigation: { sidebar: { nav: "auto" } } },
    rootDir: "/project",
    contentDir: "/project/docs",
    mode,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    pages,
  });
}

describe("plugin lifecycle manager", () => {
  test("runs every lifecycle hook sequentially in registration order", async () => {
    const calls: string[] = [];
    const plugin = (name: string): FolioPlugin => ({
      name,
      async configResolved() {
        calls.push(`${name}:configResolved:start`);
        await Promise.resolve();
        calls.push(`${name}:configResolved:end`);
      },
      buildStart: () => { calls.push(`${name}:buildStart`); },
      pageCollected: () => { calls.push(`${name}:pageCollected`); },
      pageTransformed: (current) => {
        calls.push(`${name}:pageTransformed`);
        return current;
      },
      generate: () => { calls.push(`${name}:generate`); },
      buildEnd: () => { calls.push(`${name}:buildEnd`); },
    });
    const lifecycle = manager([plugin("first"), plugin("second")]);

    await lifecycle.configResolved();
    await lifecycle.buildStart();
    await lifecycle.pageCollected(page);
    await lifecycle.pageTransformed(page);
    await lifecycle.generate();
    await lifecycle.buildEnd({ success: true, outputDir: "/out", pages: [page] });

    expect(calls).toEqual([
      "first:configResolved:start", "first:configResolved:end", "second:configResolved:start", "second:configResolved:end",
      "first:buildStart", "second:buildStart",
      "first:pageCollected", "second:pageCollected",
      "first:pageTransformed", "second:pageTransformed",
      "first:generate", "second:generate",
      "first:buildEnd", "second:buildEnd",
    ]);
  });

  test("stops the current hook operation after the first plugin failure", async () => {
    const calls: string[] = [];
    const lifecycle = manager([
      {
        name: "failing",
        buildStart: () => {
          calls.push("failing");
          throw new Error("stop here");
        },
      },
      {
        name: "later",
        buildStart: () => { calls.push("later"); },
      },
    ]);

    await expect(lifecycle.buildStart()).rejects.toMatchObject({
      name: "FolioPluginHookError",
      pluginName: "failing",
      hook: "buildStart",
    });
    expect(calls).toEqual(["failing"]);
  });

  test("passes the configured mode to every context hook", async () => {
    const modes: string[] = [];
    const plugin: FolioPlugin = {
      name: "mode-observer",
      configResolved: (context) => { modes.push(context.mode); },
      buildStart: (context) => { modes.push(context.mode); },
      generate: (context) => { modes.push(context.mode); },
    };

    const development = manager([plugin], [], "development");
    await development.configResolved();
    await development.buildStart();
    await development.generate();

    expect(modes).toEqual(["development", "development", "development"]);
  });

  test("chains transformed pages and preserves the route identity", async () => {
    const lifecycle = manager([
      { name: "title", pageTransformed: (current) => ({ ...current, title: `${current.title}!` }) },
      { name: "description", pageTransformed: (current) => ({ ...current, description: current.title }) },
    ]);

    const transformed = await lifecycle.pageTransformed(page);
    expect(transformed.title).toBe("Start!");
    expect(transformed.description).toBe("Start!");

    const invalid = manager([{ name: "bad-route", pageTransformed: (current) => ({ ...current, url: "/other" }) }]);
    await expect(invalid.pageTransformed(page)).rejects.toMatchObject({
      name: "FolioPluginHookError",
      pluginName: "bad-route",
      hook: "pageTransformed",
    });
  });

  test("transforms page metadata without adding a page or changing its route", async () => {
    const lifecycle = manager([{
      name: "metadata",
      pageTransformed: (current) => ({
        ...current,
        title: "Updated",
        description: "Updated description",
        frontmatter: {
          ...current.frontmatter,
          order: 2,
          badge: "New",
          icon: "sparkles",
          toc: false,
        },
      }),
    }], [page]);

    const transformed = await lifecycle.pageTransformed(page);
    const pages = lifecycle.getPages();

    expect(transformed).toMatchObject({
      slug: page.slug,
      url: page.url,
      title: "Updated",
      description: "Updated description",
      frontmatter: {
        order: 2,
        badge: "New",
        icon: "sparkles",
        toc: false,
      },
    });
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe("Updated");
  });

  test("collects serializable page actions after page transformation", async () => {
    const lifecycle = manager([
      { name: "first-actions", pageActions: () => [{ label: "Click me", href: "/guide/next" }] },
      { name: "second-actions", pageActions: () => [{ label: "External", href: "https://example.com", external: true }] },
    ], [page]);

    const result = await lifecycle.pageActions(page);

    expect(result.pageActions).toEqual([
      { label: "Click me", href: "/guide/next" },
      { label: "External", href: "https://example.com", external: true },
    ]);
    expect(lifecycle.getPages()[0].pageActions).toEqual(result.pageActions);
  });

  test("keeps the click-me example action development-only", async () => {
    const development = manager([createClickMePlugin({ href: "/configuration/plugins" })], [page], "development");
    const production = manager([createClickMePlugin({ href: "/configuration/plugins" })], [page], "production");

    expect((await development.pageActions(page)).pageActions).toEqual([
      { label: "Click me", href: "/configuration/plugins", external: undefined },
    ]);
    expect((await production.pageActions(page)).pageActions).toEqual([]);
  });

  test("rejects malformed page actions with plugin metadata", async () => {
    const lifecycle = manager([{ name: "bad-actions", pageActions: () => [{ label: "", href: "/" }] }]);

    await expect(lifecycle.pageActions(page)).rejects.toMatchObject({
      name: "FolioPluginHookError",
      pluginName: "bad-actions",
      hook: "pageActions",
    });
  });

  test("adds plugin and hook metadata to failures while retaining the cause", async () => {
    const cause = new Error("cannot generate");
    const lifecycle = manager([{ name: "search-index", generate: () => Promise.reject(cause) }]);

    try {
      await lifecycle.generate();
      throw new Error("expected generate to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(FolioPluginHookError);
      expect(error).toMatchObject({ pluginName: "search-index", hook: "generate", cause });
      expect((error as Error).message).toContain('Plugin "search-index" hook "generate"');
    }
  });

  test("gives hooks immutable snapshots of context and pages", async () => {
    let context!: Parameters<NonNullable<FolioPlugin["buildStart"]>>[0];
    const lifecycle = manager([{
      name: "observer",
      buildStart: (received) => { context = received; },
    }], [page]);

    await lifecycle.buildStart();
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.config)).toBe(true);
    expect(Object.isFrozen(context.pages)).toBe(true);
    expect(() => (context.pages as FolioPage[]).push(page)).toThrow();
    expect(() => (context.config.navigation!.sidebar!.nav as string) = "changed").toThrow();

    const exposed = lifecycle.getPages();
    expect(() => (exposed as FolioPage[])[0].title = "changed").toThrow();
    expect(lifecycle.getPages()[0].title).toBe("Start");
  });

  test("gives buildEnd an immutable result snapshot", async () => {
    let received!: { success: boolean; outputDir: string; pages: readonly FolioPage[] };
    const lifecycle = manager([{
      name: "result-observer",
      buildEnd: (result) => { received = result; },
    }]);
    const result = { success: true, outputDir: "/out", pages: [page] };

    await lifecycle.buildEnd(result);

    expect(Object.isFrozen(received)).toBe(true);
    expect(Object.isFrozen(received.pages)).toBe(true);
    expect(() => (received.outputDir as string) = "/other").toThrow();
    expect(() => (received.pages as FolioPage[]).push(page)).toThrow();
    expect(result.outputDir).toBe("/out");
  });

  test("deeply snapshots maps, sets, arrays, plain objects, and providers", async () => {
    class Provider {
      name = "custom";
      self = this;
      search() { return []; }
      currentName() { return this.name; }
      mutate() { this.name = "changed"; }
    }
    const provider = new Provider();
    const sourcePage = {
      ...page,
      frontmatter: {
        title: "Start",
        metadata: {
          tags: new Set(["docs"]),
          aliases: new Map([["start", ["guide/start"]]]),
        },
      },
    } as FolioPage;
    const config = {
      title: "Docs",
      search: { provider },
      navigation: { sidebar: { nav: "auto" as const } },
    };
    let context!: Parameters<NonNullable<FolioPlugin["buildStart"]>>[0];
    const lifecycle = createFolioPluginLifecycleManager({
      plugins: [{ name: "observer", buildStart: (received) => { context = received; } }],
      config,
      rootDir: "/project",
      contentDir: "/project/docs",
      mode: "production",
      logger: { debug() {}, info() {}, warn() {}, error() {} },
      pages: [sourcePage],
    });

    await lifecycle.buildStart();
    const exposedProvider = context.config.search?.provider as Provider;
    expect(exposedProvider).toBeInstanceOf(Provider);
    expect(Object.getPrototypeOf(exposedProvider)).toBe(Provider.prototype);
    expect(exposedProvider.self).toBe(exposedProvider);
    expect(context.config.search?.provider).toBe(exposedProvider);
    expect(exposedProvider.search()).toEqual([]);
    expect(exposedProvider.currentName()).toBe("custom");
    expect(() => exposedProvider.mutate()).toThrow();
    expect(() => exposedProvider.name = "changed").toThrow();
    expect(provider.name).toBe("custom");
    const metadata = context.pages[0].frontmatter.metadata as {
      tags: Set<string>;
      aliases: Map<string, string[]>;
    };
    expect(() => metadata.tags.add("plugin")).toThrow();
    expect(() => metadata.aliases.set("other", ["other"])).toThrow();
    expect(() => metadata.aliases.get("start")?.push("changed")).toThrow();
    expect(() => (metadata as unknown as { extra: string }).extra = "changed").toThrow();
    expect(sourcePage.frontmatter.metadata).toEqual({
      tags: new Set(["docs"]),
      aliases: new Map([["start", ["guide/start"]]]),
    });
  });

  test("preserves cyclic references without exposing mutable source objects", async () => {
    const metadata: { name: string; self?: unknown } = { name: "cycle" };
    metadata.self = metadata;
    const sourcePage = {
      ...page,
      frontmatter: { title: "Start", metadata },
    } as FolioPage;
    let received!: FolioPage;
    const lifecycle = manager([{
      name: "cycle-observer",
      pageCollected: (current) => { received = current; },
    }]);

    await lifecycle.pageCollected(sourcePage);

    const exposed = received.frontmatter.metadata as { name: string; self: unknown };
    expect(exposed.self).toBe(exposed);
    expect(() => (exposed.name as string) = "changed").toThrow();
    expect(metadata.name).toBe("cycle");
    expect(metadata.self).toBe(metadata);
  });

  test("adds page route, source path, and mode to page-hook failures", async () => {
    const lifecycle = manager([{
      name: "page-check",
      pageTransformed: () => { throw new Error("invalid page"); },
    }]);

    try {
      await lifecycle.pageTransformed({ ...page, sourcePath: "/content/guide/start.mdx" });
      throw new Error("expected page hook to fail");
    } catch (error) {
      expect(error).toMatchObject({
        name: "FolioPluginHookError",
        pageRoute: "/guide/start",
        sourcePath: "/content/guide/start.mdx",
        mode: "production",
        metadata: {
          pageRoute: "/guide/start",
          sourcePath: "/content/guide/start.mdx",
          mode: "production",
        },
      });
      expect((error as Error).message).toContain('route "/guide/start"');
      expect((error as Error).message).toContain('source "/content/guide/start.mdx"');
      expect((error as Error).message).toContain('mode "production"');
    }
  });

  test("adds page metadata to pageCollected failures", async () => {
    const cause = new Error("invalid collected page");
    const lifecycle = manager([{
      name: "page-collector",
      pageCollected: () => { throw cause; },
    }]);

    await expect(lifecycle.pageCollected({
      ...page,
      sourcePath: "/content/guide/start.mdx",
    })).rejects.toMatchObject({
      name: "FolioPluginHookError",
      pluginName: "page-collector",
      hook: "pageCollected",
      cause,
      pageRoute: "/guide/start",
      sourcePath: "/content/guide/start.mdx",
    });
  });

  test("retains the original cause for context and build-end failures", async () => {
    const contextCause = new Error("context failure");
    const contextLifecycle = manager([{
      name: "context-failure",
      configResolved: () => { throw contextCause; },
    }]);
    await expect(contextLifecycle.configResolved()).rejects.toMatchObject({
      hook: "configResolved",
      cause: contextCause,
    });

    const buildEndCause = new Error("build ended unsuccessfully");
    const buildEndLifecycle = manager([{
      name: "build-end-failure",
      buildEnd: () => { throw buildEndCause; },
    }]);
    await expect(buildEndLifecycle.buildEnd({
      success: false,
      outputDir: "/out",
      pages: [],
    })).rejects.toMatchObject({
      hook: "buildEnd",
      cause: buildEndCause,
    });
  });

  test("passes failed build results to buildEnd without changing their status", async () => {
    let received!: { success: boolean; outputDir: string; pages: readonly FolioPage[] };
    const lifecycle = manager([{
      name: "failed-build-observer",
      buildEnd: (result) => { received = result; },
    }]);

    await lifecycle.buildEnd({ success: false, outputDir: "/out", pages: [] });

    expect(received.success).toBe(false);
    expect(received.outputDir).toBe("/out");
  });

  test("keeps Date and RegExp snapshot values immutable", async () => {
    const sourceDate = new Date("2025-01-02T03:04:05.000Z");
    const sourcePattern = /docs/gy;
    sourcePattern.lastIndex = 1;
    const sourcePage = {
      ...page,
      frontmatter: { title: "Start", metadata: { sourceDate, sourcePattern } },
    } as FolioPage;
    let received!: FolioPage;
    const lifecycle = manager([{ name: "observer", pageCollected: (current) => { received = current; } }]);

    await lifecycle.pageCollected(sourcePage);
    const metadata = received.frontmatter.metadata as {
      sourceDate: Date;
      sourcePattern: RegExp;
    };
    expect(metadata.sourceDate).toBeInstanceOf(Date);
    expect(metadata.sourceDate.getTime()).toBe(sourceDate.getTime());
    const dateMutators = [
      "setDate", "setFullYear", "setHours", "setMilliseconds", "setMinutes", "setMonth",
      "setSeconds", "setTime", "setUTCDate", "setUTCFullYear", "setUTCHours",
      "setUTCMilliseconds", "setUTCMinutes", "setUTCMonth", "setUTCSeconds", "setYear",
    ];
    for (const method of dateMutators) {
      expect(() => (metadata.sourceDate as unknown as Record<string, (value: number) => void>)[method](0)).toThrow();
    }
    expect(metadata.sourceDate.getTime()).toBe(sourceDate.getTime());
    expect(metadata.sourcePattern).toBeInstanceOf(RegExp);
    expect(metadata.sourcePattern.flags).toBe("gy");
    expect(() => metadata.sourcePattern.exec("docs")).not.toThrow();
    expect(metadata.sourcePattern.lastIndex).toBe(1);
    expect(() => metadata.sourcePattern.lastIndex = 0).toThrow();
    expect(sourceDate.getTime()).toBe(Date.parse("2025-01-02T03:04:05.000Z"));
    expect(sourcePattern.lastIndex).toBe(1);
  });

  test("replaces the lifecycle session when the development config reloads", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-config-reload-"));
    const configPath = path.join(root, "docs.config.ts");
    try {
      await mkdir(path.join(root, "docs"));
      await writeFile(path.join(root, "docs", "index.mdx"), "---\ntitle: Home\n---\n\n# Home\n");
      await writeFile(configPath, `export default { title: "First", plugins: [{ name: "first", pageTransformed: (page) => ({ ...page, title: "First title" }) }] };`);

      const plugin = nikalaDocsPlugin({ configRoot: root });
      const configResolved = plugin.configResolved as (config: unknown) => Promise<void>;
      await configResolved({ command: "serve", build: { ssr: false } });
      const load = plugin.load as (id: string) => Promise<string | null>;
      expect(await load(RESOLVED_TREE_ID)).toContain("First title");

      let configChange: ((file: string) => Promise<void>) | undefined;
      const configureServer = plugin.configureServer as (server: unknown) => void;
      configureServer({
        watcher: {
          add() {},
          on(event: string, handler: (file: string) => Promise<void>) {
            if (event === "change") configChange = handler;
          },
        },
        moduleGraph: { getModuleById() { return undefined; } },
        ws: { send() {} },
      });

      await writeFile(configPath, `export default { title: "Second", plugins: [{ name: "second", pageTransformed: (page) => ({ ...page, title: "Second title" }) }] };`);
      await configChange?.(configPath);
      expect(await load(RESOLVED_TREE_ID)).toContain("Second title");
      expect(await load(RESOLVED_TREE_ID)).not.toContain("First title");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("rescans content and sends a full reload after a development page change", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "folio-content-reload-"));
      const config = {
        title: "Reload Docs",
        plugins: [{
          name: "content-reload-plugin",
        pageTransformed: (current: FolioPage) => {
          if (current.title === "Broken") throw new Error("invalid development page");
          return { ...current, title: `${current.title} (plugin)` };
        },
      }],
    };
    try {
      await mkdir(path.join(root, "docs"));
      const pagePath = path.join(root, "docs", "index.mdx");
      await writeFile(pagePath, "---\ntitle: First\n---\n\n# First\n");
      const plugin = nikalaDocsPlugin({ configRoot: root, docsDir: "docs", config });
      const configResolved = plugin.configResolved as (resolved: unknown) => Promise<void>;
      await configResolved({ command: "serve", build: { ssr: false } });
      const load = plugin.load as (id: string) => Promise<string | null>;
      expect(await load(RESOLVED_TREE_ID)).toContain("First (plugin)");

      let contentChange: ((file: string) => Promise<void>) | undefined;
      const messages: Array<{ type: string; err?: { message?: string } }> = [];
      const configureServer = plugin.configureServer as (server: unknown) => void;
      configureServer({
        watcher: {
          add() {},
          on(event: string, handler: (file: string) => Promise<void>) {
            if (event === "change") contentChange = handler;
          },
        },
        moduleGraph: { getModuleById() { return undefined; } },
        ws: { send(message: { type: string }) { messages.push(message); } },
        config: { logger: { error() {} } },
      });

      await writeFile(pagePath, "---\ntitle: Second\n---\n\n# Second\n");
      await contentChange?.(pagePath);
      const tree = await load(RESOLVED_TREE_ID);
      expect(tree).toContain("Second (plugin)");
      expect(tree).not.toContain("First (plugin)");
      await new Promise((resolve) => setTimeout(resolve, 90));
      expect(messages).toContainEqual({ type: "full-reload" });

      await writeFile(pagePath, "---\ntitle: Broken\n---\n\n# Broken\n");
      await contentChange?.(pagePath);
      const errorMessage = messages.find((message) => message.type === "error")?.err?.message;
      expect(errorMessage).toContain('Plugin "content-reload-plugin" hook "pageTransformed"');
      expect(await load(RESOLVED_TREE_ID)).toContain("Second (plugin)");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
