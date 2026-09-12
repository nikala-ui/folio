import { describe, expect, test } from "bun:test";
import {
  createFolioPluginLifecycleManager,
  FolioPluginHookError,
} from "../src/core/plugin-lifecycle.js";
import type { FolioPage, FolioPlugin } from "../src/plugin.js";

const page: FolioPage = {
  slug: "guide/start",
  url: "/guide/start",
  filePath: "/docs/guide/start.mdx",
  frontmatter: { title: "Start", metadata: { source: "docs" } },
  toc: [],
  title: "Start",
};

function manager(plugins: readonly FolioPlugin[] = [], pages: readonly FolioPage[] = []) {
  return createFolioPluginLifecycleManager({
    plugins,
    config: { title: "Docs", navigation: { sidebar: { nav: "auto" } } },
    rootDir: "/project",
    contentDir: "/project/docs",
    mode: "production",
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
});
