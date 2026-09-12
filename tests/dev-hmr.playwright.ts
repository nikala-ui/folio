import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { chromium, type CDPSession } from "playwright";
import { createDocsServer } from "../src/server/index.js";
import type { FolioPlugin } from "../src/plugin.js";

const root = await mkdtemp(path.join(os.tmpdir(), "folio-browser-hmr-"));
const browser = await chromium.launch({ headless: true });
let server: Awaited<ReturnType<typeof createDocsServer>> | undefined;

try {
  await mkdir(path.join(root, "docs"));
  const pagePath = path.join(root, "docs", "index.mdx");
  await writeFile(pagePath, "---\ntitle: Initial\n---\n\n# Initial\n");
  const plugin: FolioPlugin = {
    name: "browser-hmr-observer",
    pageTransformed: (page) => ({ ...page, description: "HMR acceptance" }),
  };
  server = await createDocsServer({
    root,
    docsDir: "docs",
    config: { title: "HMR Docs", plugins: [plugin] },
    host: "localhost",
    port: 0,
  });
  await server.listen();
  const address = server.httpServer?.address();
  assert.equal(typeof address, "object");
  assert.ok(address);
  const url = `http://localhost:${address.port}/`;
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Initial", exact: true }).first().waitFor();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const beforeBrowser = await browserMetrics(cdp);
  const browserSamples = [beforeBrowser];

  await writeFile(pagePath, "---\ntitle: Updated\n---\n\n# Updated\n");
  await page.getByRole("heading", { name: "Updated", exact: true }).first().waitFor({ timeout: 10_000 });
  for (let revision = 2; revision <= 25; revision += 1) {
    await writeFile(pagePath, `---\ntitle: Updated ${revision}\n---\n\n# Updated ${revision}\n`);
    await page.getByRole("heading", { name: `Updated ${revision}`, exact: true }).first().waitFor({ timeout: 10_000 });
    if (revision % 5 === 0) browserSamples.push(await browserMetrics(cdp));
  }
  const afterBrowser = await browserMetrics(cdp);
  await page.waitForFunction(() => document.title.includes("Updated 25"));
  assert.equal(await page.title(), "Updated 25 - HMR Docs");
  browserSamples.push(afterBrowser);
  console.log(JSON.stringify({ browserMemory: { before: beforeBrowser, after: afterBrowser, samples: browserSamples } }));
  const maxNodes = Math.max(...browserSamples.map((sample) => sample.dom.nodes));
  const maxDocuments = Math.max(...browserSamples.map((sample) => sample.dom.documents));
  const maxListeners = Math.max(...browserSamples.map((sample) => sample.dom.jsEventListeners));
  assert.ok(maxNodes <= beforeBrowser.dom.nodes + 50, "HMR must not continuously grow DOM nodes");
  assert.ok(maxDocuments <= beforeBrowser.dom.documents + 2, "HMR must not retain documents");
  assert.ok(maxListeners <= beforeBrowser.dom.jsEventListeners + 50, "HMR must not continuously grow event listeners");
  await page.close();
  console.log("Browser HMR smoke test passed: MDX edit, plugin reload, navigation, and document title.");
} finally {
  await browser.close();
  await server?.close();
  await rm(root, { recursive: true, force: true });
}

async function browserMetrics(cdp: CDPSession): Promise<{
  jsHeapUsedSize: number;
  jsHeapTotalSize: number;
  dom: { nodes: number; documents: number; jsEventListeners: number };
}> {
  await cdp.send("HeapProfiler.collectGarbage");
  const performance = await cdp.send("Performance.getMetrics") as { metrics: Array<{ name: string; value: number }> };
  const values = new Map(performance.metrics.map((metric) => [metric.name, metric.value]));
  const dom = await cdp.send("Memory.getDOMCounters") as { nodes: number; documents: number; jsEventListeners: number };
  return {
    jsHeapUsedSize: values.get("JSHeapUsedSize") || 0,
    jsHeapTotalSize: values.get("JSHeapTotalSize") || 0,
    dom,
  };
}
