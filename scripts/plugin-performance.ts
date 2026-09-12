import { performance } from "node:perf_hooks";
import { createFolioPluginLifecycleManager } from "../src/core/plugin-lifecycle.js";
import type { FolioPage, FolioPlugin } from "../src/plugin.js";

const pageCount = 1_000;
const pluginCount = 8;
const pages: FolioPage[] = Array.from({ length: pageCount }, (_, index) => ({
  slug: `guide/page-${index}`,
  url: `/guide/page-${index}`,
  filePath: `/docs/guide/page-${index}.mdx`,
  frontmatter: { title: `Page ${index}`, metadata: { index, tags: ["guide", "performance"] } },
  toc: [{ id: `heading-${index}`, text: "Heading", level: 2, depth: 2 }],
  title: `Page ${index}`,
}));

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const options = {
  config: { title: "Performance", navigation: { sidebar: { nav: "auto" as const } } },
  rootDir: "/project",
  contentDir: "/project/docs",
  mode: "production" as const,
  logger,
};
const createManager = (plugins: readonly FolioPlugin[]) => createFolioPluginLifecycleManager({
  ...options,
  plugins,
  pages,
});
const elapsed = async (run: () => void | Promise<void>): Promise<number> => {
  const start = performance.now();
  await run();
  return performance.now() - start;
};

const snapshotManager = createManager([]);
const snapshotMs = await elapsed(() => {
  for (let iteration = 0; iteration < 5; iteration += 1) snapshotManager.getPages();
});

const plugins = Array.from({ length: pluginCount }, (_, index): FolioPlugin => ({
  name: `perf-${index}`,
  pageTransformed: (page) => page,
}));
const hookPages = pages.slice(0, 100);
const hookManager = createManager(plugins);
const hookMs = await elapsed(async () => {
  for (const page of hookPages) await hookManager.pageTransformed(page);
});

console.log(JSON.stringify({
  pageCount,
  pluginCount,
  hookPageCount: hookPages.length,
  snapshotIterations: 5,
  snapshotMs: Number(snapshotMs.toFixed(2)),
  sequentialPageHookMs: Number(hookMs.toFixed(2)),
  heapUsedBytes: process.memoryUsage().heapUsed,
}, null, 2));
