import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.resolve(process.env.NIKALA_DOCS_FIXTURE || packageRoot);
const outputDir = process.env.NIKALA_DOCS_OUTPUT || ".docs-dist";
const port = Number(process.env.NIKALA_DOCS_TEST_PORT || 4183);
const baseUrl = `http://localhost:${port}`;
const homeText = process.env.NIKALA_DOCS_HOME_TEXT || "Folio";
const pageRoute = process.env.NIKALA_DOCS_PAGE_ROUTE || "/getting-started";
const pageText = process.env.NIKALA_DOCS_PAGE_TEXT || "Getting Started";

const browser = await chromium.launch({ headless: true });
const server = spawn(
  process.execPath,
  [path.join(packageRoot, "dist/cli/index.js"), "preview", "--port", String(port), "--outDir", outputDir],
  { cwd: fixtureRoot, stdio: ["ignore", "pipe", "pipe"] },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
server.stderr.on("data", (chunk) => { serverOutput += String(chunk); });

try {
  await waitForServer();

  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.ok, true, `SSR request failed with ${response.status}`);
  const html = await response.text();
  assert.match(html, new RegExp(escapeRegExp(homeText)), "SSR HTML must contain the home page content");

  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await assertText(page, homeText);
  await assertTitle(page, homeText);

  await page.locator("a:visible").filter({ hasText: pageText }).first().click();
  await page.waitForURL(new RegExp(`${escapeRegExp(pageRoute)}/?$`));
  await assertText(page, pageText);
  await assertTitle(page, pageText);
  const clickMe = page.getByRole("link", { name: "Click me", exact: true });
  await clickMe.waitFor({ state: "visible" });
  await clickMe.click();
  await page.waitForURL(/\/configuration\/plugins\/?$/);
  await assertText(page, "Plugins");
  await page.reload({ waitUntil: "networkidle" });
  await assertText(page, "Plugins");

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobilePage.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
  mobilePage.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  await mobilePage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const viewportFits = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  assert.equal(viewportFits, true, "Mobile page must not overflow horizontally");
  await mobilePage.getByRole("button", { name: "Toggle documentation sidebar" }).click();
  await mobilePage.getByRole("button", { name: "Close documentation sidebar" }).waitFor({ state: "visible" });
  await mobilePage.locator("a:visible").filter({ hasText: pageText }).first().click();
  await mobilePage.waitForURL(new RegExp(`${escapeRegExp(pageRoute)}/?$`));
  await mobilePage.getByRole("button", { name: "Close documentation sidebar" }).waitFor({ state: "detached" });

  assert.equal(pageErrors.length, 0, `Browser errors:\n${pageErrors.join("\n")}`);
  await mobilePage.close();
  await page.close();
  console.log("Browser/SSR smoke test passed: SSR, hydration, navigation, title, mobile sidebar, and overflow.");
} finally {
  await browser.close();
  server.kill("SIGTERM");
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Preview did not start:\n${serverOutput}`);
}

async function assertText(page: Page, text: string) {
  await page.getByRole("heading", { name: text, exact: false }).first().waitFor({ state: "visible" });
}

async function assertTitle(page: Page, text: string) {
  await page.waitForFunction((expected) => document.title.includes(expected), text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
