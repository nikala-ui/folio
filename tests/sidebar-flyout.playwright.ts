import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.resolve(process.env.NIKALA_DOCS_FIXTURE || packageRoot);
const outputDir = process.env.NIKALA_DOCS_OUTPUT || ".docs-dist";
const port = Number(process.env.NIKALA_DOCS_SIDEBAR_TEST_PORT || 4184);
const baseUrl = `http://localhost:${port}`;
const RAIL_TRIGGER = 'button[data-sidebar="menu-button"][aria-haspopup]';

const browser = await chromium.launch({ headless: true });
const server = spawn(
  process.execPath,
  [path.join(packageRoot, "dist/cli/index.js"), "preview", "--port", String(port), "--outDir", outputDir],
  { cwd: fixtureRoot, stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
server.stderr.on("data", (chunk) => { serverOutput += String(chunk); });

async function collapseSidebar(page: Page) {
  await page.getByRole("button", { name: "Toggle documentation sidebar" }).click();
  await page.locator('[data-sidebar="sidebar"]').first().waitFor();
  await page.waitForFunction(() => document.querySelector('[data-state="collapsed"]') !== null);
}

try {
  await waitForServer();
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

  // Expanded sidebar: no flyout triggers, group links stay in the page.
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(RAIL_TRIGGER).count(), 0, "expanded sidebar must not render rail flyout triggers");

  await collapseSidebar(page);
  const trigger = page.locator(RAIL_TRIGGER).first();
  const groupName = await trigger.getAttribute("aria-label");
  assert.ok(groupName, "rail trigger must be labelled with the group title");
  const menu = page.getByRole("menu", { name: groupName });

  // Hover opens a menu with the group's pages; leaving closes it.
  await trigger.hover();
  await menu.waitFor({ state: "visible" });
  const items = menu.getByRole("menuitem");
  const itemCount = await items.count();
  assert.ok(itemCount >= 1, "flyout must list the group's pages");
  for (let index = 0; index < itemCount; index += 1) {
    const href = await items.nth(index).getAttribute("href");
    assert.ok(href, `flyout item ${index} must be a link`);
  }
  await page.mouse.move(700, 500, { steps: 4 });
  await menu.waitFor({ state: "hidden" });

  // Keyboard: focus opens it without taking focus, ArrowDown enters it, Escape closes and returns focus.
  await page.keyboard.press("Tab");
  await trigger.focus();
  await menu.waitFor({ state: "visible" });
  const triggerSelector = `${RAIL_TRIGGER}[aria-label="${groupName}"]`;
  await page.waitForFunction((selector) => document.activeElement === document.querySelector(selector), triggerSelector, { timeout: 2000 })
    .catch(() => assert.fail("opening on focus must keep focus on the rail icon"));
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem");
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  await page.waitForFunction((selector) => document.activeElement === document.querySelector(selector), triggerSelector, { timeout: 2000 })
    .catch(() => assert.fail("Escape must return focus to the rail icon"));

  // Choosing a page navigates client-side, closes the flyout and highlights the page when reopened.
  await trigger.hover();
  await menu.waitFor({ state: "visible" });
  const target = items.last();
  const targetText = (await target.textContent())?.trim();
  const targetHref = await target.getAttribute("href");
  await target.click();
  await page.waitForURL((url) => url.pathname.replace(/\/$/, "") === targetHref!.replace(/\/$/, ""));
  await menu.waitFor({ state: "hidden" });
  await page.mouse.move(700, 500);
  await trigger.hover();
  await menu.waitFor({ state: "visible" });
  assert.equal((await menu.locator('[aria-current="page"]').first().textContent())?.trim(), targetText, "active page must be highlighted in the flyout");
  assert.equal(errors.length, 0, `Console errors: ${errors.join("\n")}`);

  // Mobile sidebar keeps the expanded layout and has no flyout triggers.
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: "Toggle documentation sidebar" }).click();
  await mobile.getByRole("button", { name: "Close documentation sidebar" }).waitFor({ state: "visible" });
  assert.equal(await mobile.locator(RAIL_TRIGGER).count(), 0, "mobile sidebar must not render rail flyout triggers");

  console.log("Sidebar flyout test passed: hover, keyboard, Escape, navigation, active page, expanded and mobile sidebars.");
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  await browser.close();
  server.kill();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Preview server did not start.\n${serverOutput}`);
}
