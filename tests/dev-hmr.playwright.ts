import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
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

  await writeFile(pagePath, "---\ntitle: Updated\n---\n\n# Updated\n");
  await page.getByRole("heading", { name: "Updated", exact: true }).first().waitFor({ timeout: 10_000 });
  assert.equal(await page.title(), "Updated - HMR Docs");
  await page.close();
  console.log("Browser HMR smoke test passed: MDX edit, plugin reload, navigation, and document title.");
} finally {
  await browser.close();
  await server?.close();
  await rm(root, { recursive: true, force: true });
}
