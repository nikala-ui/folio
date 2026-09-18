import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 4191;
const baseUrl = `http://localhost:${port}`;
const server = spawn(
  process.execPath,
  [path.join(packageRoot, "dist/cli/index.js"), "preview", "--port", String(port), "--outDir", ".docs-dist"],
  { cwd: packageRoot, stdio: ["ignore", "pipe", "pipe"] },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
server.stderr.on("data", (chunk) => { serverOutput += String(chunk); });

try {
  await waitForServer();

  const response = await fetch(`${baseUrl}/ka/getting-started`);
  assert.equal(response.ok, true, `SSR request failed with ${response.status}`);
  const ssrHtml = await response.text();
  assert.match(ssrHtml, /დაწყება/, "SSR HTML must contain the Georgian page title");
  assert.match(ssrHtml, /\/ka\/getting-started/, "SSR HTML must contain the localized route");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.stack || error.message));
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(message.text());
    });

    await page.goto(`${baseUrl}/getting-started`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Choose language" }).click();
    await page.getByRole("menuitem", { name: "KA" }).click();
    await page.waitForURL(/\/ka\/getting-started\/?$/);
    await page.getByRole("heading", { name: "დაწყება" }).waitFor({ state: "visible" });

    await page.getByRole("link", { name: "Themes", exact: true }).click();
    await page.waitForURL(/\/themes\/?$/);
    await page.getByRole("heading", { name: "Themes", exact: true }).waitFor({ state: "visible" });

    const languageButton = page.getByRole("button", { name: "Choose language" });
    await languageButton.getByText("en", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await languageButton.getByText("ka", { exact: true }).count(), 0);
    await page.getByRole("listitem").filter({ hasText: "Getting Started" }).getByRole("link", { name: "Getting Started", exact: true }).click();
    await page.waitForURL(/\/ka\/getting-started\/?$/);
    await page.getByRole("heading", { name: "დაწყება", exact: true }).waitFor({ state: "visible" });

    await page.getByRole("button", { name: "ენის არჩევა" }).click();
    await page.getByRole("menuitem", { name: "EN" }).click();
    await page.waitForURL(/\/getting-started\/?$/);
    await page.getByRole("heading", { name: "Getting Started", exact: true }).waitFor({ state: "visible" });
    await page.locator('a[data-sidebar="menu-button"][aria-current="page"]')
      .filter({ hasText: "Getting Started" })
      .waitFor({ state: "visible" });
    await page.getByText("Documentation", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await page.title(), "Getting Started - Folio");

    assert.deepEqual(pageErrors, [], `Browser errors:\n${pageErrors.join("\n")}`);
    await page.close();
  } finally {
    await browser.close();
  }

  console.log("i18n browser/SSR acceptance passed: SSR localized content, browser fallback, and locale restoration.");
} finally {
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
