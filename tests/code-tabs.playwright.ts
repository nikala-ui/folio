import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.resolve(process.env.NIKALA_DOCS_FIXTURE || packageRoot);
const outputDir = process.env.NIKALA_DOCS_OUTPUT || ".docs-dist";
const port = Number(process.env.NIKALA_DOCS_CODE_TABS_TEST_PORT || 4185);
const baseUrl = `http://localhost:${port}`;
const PAGE = `${baseUrl}/configuration/code-highlighting`;
const STORAGE_KEY = "folio:code-tabs:language";

const browser = await chromium.launch({ headless: true });
const server = spawn(
  process.execPath,
  [path.join(packageRoot, "dist/cli/index.js"), "preview", "--port", String(port), "--outDir", outputDir],
  { cwd: fixtureRoot, stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
server.stderr.on("data", (chunk) => { serverOutput += String(chunk); });

const groups = (page: Page) => page.locator('[data-orientation="horizontal"]:has([role="tablist"])');
const selectedLabels = (page: Page) => page.locator('[role="tab"][aria-selected="true"]').allTextContents();
const copyButton = (group: Locator) => group.getByRole("button", { name: /copy/i });
const readClipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

async function open(context: BrowserContext): Promise<{ page: Page; errors: string[] }> {
  const errors: string[] = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.goto(PAGE, { waitUntil: "networkidle" });
  return { page, errors };
}

try {
  await waitForServer();

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const { page, errors } = await open(context);
  const tabGroups = groups(page);
  assert.ok((await tabGroups.count()) >= 2, "the docs page must render at least two synced groups");
  assert.deepEqual(await selectedLabels(page), ["TypeScript", "TypeScript"], "first tab is the default");

  // Rendering: each tab keeps its own language and highlighting, and shows only its own code.
  const first = tabGroups.nth(0);
  assert.ok(await first.locator('code[class*="language-typescript"] span[style*="--shiki"]').count() > 0, "active tab must be highlighted as its language");
  assert.ok((await first.innerText()).includes("const answer: number = 42;"));
  assert.ok(!(await first.innerText()).includes("const answer = 42;"), "inactive tab content must not show");
  assert.ok(!(await first.innerText()).includes("$ "), "code must not be rewritten with a prompt");

  // Switching, sync across groups, and the copy button copying the active tab.
  await first.getByRole("tab", { name: "JavaScript" }).click();
  assert.deepEqual(await selectedLabels(page), ["JavaScript", "JavaScript"], "groups with one syncKey switch together");
  assert.ok((await tabGroups.nth(1).innerText()).includes('export const greeting = "Hello";'), "synced group shows the matching tab");
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), "JavaScript", "choice is stored");
  await copyButton(first).click();
  assert.equal(await readClipboard(page), "const answer = 42;", "copy copies the active tab's exact code");
  await first.getByRole("tab", { name: "TypeScript" }).click();
  await copyButton(first).click();
  assert.equal(await readClipboard(page), "const answer: number = 42;");
  await first.getByRole("tab", { name: "JavaScript" }).click();

  // Keyboard: roving tabindex and arrow keys move the selection.
  const tabs = first.getByRole("tab");
  assert.equal(await first.getByRole("tab", { name: "TypeScript" }).getAttribute("tabindex"), "-1", "unselected tab leaves the tab order");
  assert.equal(await first.getByRole("tab", { name: "JavaScript" }).getAttribute("tabindex"), "0");
  await first.getByRole("tab", { name: "JavaScript" }).focus();
  await page.keyboard.press("ArrowLeft");
  assert.deepEqual(await selectedLabels(page), ["TypeScript", "TypeScript"], "arrow keys switch tabs");
  assert.equal(await tabs.nth(0).evaluate((element) => element === document.activeElement), true, "focus follows the arrow key");
  await page.keyboard.press("End");
  assert.deepEqual(await selectedLabels(page), ["JavaScript", "JavaScript"], "End selects the last tab");

  // Persistence: a reload and a client-side visit to another page keep the choice.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"][aria-selected="true"]')[0]?.textContent === "JavaScript");
  assert.deepEqual(await selectedLabels(page), ["JavaScript", "JavaScript"], "remembered after reload");
  await page.getByRole("link", { name: "Site metadata" }).first().click();
  await page.waitForURL(/configuration\/site/);
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"][aria-selected="true"]').length >= 2);
  assert.deepEqual(await selectedLabels(page), ["JavaScript", "JavaScript"], "remembered across pages");

  // A stored label that a group does not have falls back to its first tab and is kept.
  await page.evaluate((key) => localStorage.setItem(key, "Ruby"), STORAGE_KEY);
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(await selectedLabels(page), ["TypeScript", "TypeScript"]);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), "Ruby");
  assert.deepEqual(errors, [], `unexpected console errors:\n${errors.join("\n")}`);
  await context.close();

  // Blocked storage: the page renders, switching still works and nothing throws.
  const blocked = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new DOMException("blocked", "SecurityError"); } });
  });
  const blockedPage = await open(blocked);
  const blockedGroup = groups(blockedPage.page).nth(0);
  assert.deepEqual(await selectedLabels(blockedPage.page), ["TypeScript", "TypeScript"], "default is the first tab without storage");
  await blockedGroup.getByRole("tab", { name: "JavaScript" }).click();
  assert.deepEqual(await selectedLabels(blockedPage.page), ["JavaScript", "JavaScript"], "switching works without storage");
  assert.deepEqual(blockedPage.errors.filter((message) => !/blocked|SecurityError/.test(message)), [], "blocked storage must not break the page");
  await blocked.close();

  console.log("Code tabs test passed: default tab, highlighting, switching, sync, copy, keyboard, persistence and blocked storage.");
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  await browser.close();
  server.kill();
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${baseUrl}/`)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start:\n${serverOutput}`);
}
