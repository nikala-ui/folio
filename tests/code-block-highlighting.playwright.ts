import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(packageRoot, "tests/fixtures/code-block-highlighting");
const cliPath = path.join(packageRoot, "dist/cli/index.js");
const port = Number(process.env.NIKALA_DOCS_CODE_BLOCK_TEST_PORT || 4186);
const baseUrl = `http://localhost:${port}`;
// Chunks of the browser highlighter: Shiki's regex engine and its default themes.
const HIGHLIGHTER_CHUNK = /\/assets\/(?:engine-javascript|github-light|github-dark)-/;
const DIRECT_BLOCKS = 12;

const outputDir = await mkdtemp(path.join(os.tmpdir(), "folio-code-block-"));
execFileSync(process.execPath, [cliPath, "build", "-o", outputDir], { cwd: fixtureRoot, stdio: "ignore" });

const browser = await chromium.launch({ headless: true });
const server = spawn(process.execPath, [cliPath, "preview", "--port", String(port), "--outDir", outputDir], {
  cwd: fixtureRoot,
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
server.stderr.on("data", (chunk) => { serverOutput += String(chunk); });

/** Open a page and record everything the browser logs as a warning or an error, and every script it loads. */
async function open(route: string): Promise<{ page: Page; messages: string[]; chunks: string[] }> {
  const page = await browser.newPage();
  const messages: string[] = [];
  const chunks: string[] = [];
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") messages.push(`${message.type()}: ${message.text()}`);
  });
  page.on("request", (request) => { if (request.url().endsWith(".js")) chunks.push(new URL(request.url()).pathname); });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  return { page, messages, chunks };
}

const highlightedSpans = 'span[style*="--shiki"]';

try {
  await waitForServer();

  // Server-highlighted fences: built-in (toml, ts) and custom (demolang) languages.
  const served = await open("/server-highlighted");
  for (const lang of ["toml", "demolang", "typescript"]) {
    assert.ok(await served.page.locator(`code[class*="language-${lang}"] ${highlightedSpans}`).count() > 0, `${lang} must be highlighted by the server`);
  }
  assert.deepEqual(served.messages, [], "server-highlighted blocks must not log Shiki warnings or errors");
  assert.deepEqual(
    served.chunks.filter((chunk) => HIGHLIGHTER_CHUNK.test(chunk)),
    [],
    "the browser must not load a highlighter for blocks the server already highlighted",
  );
  await served.page.close();

  // Direct CodeBlock usage still highlights in the browser, with one highlighter.
  const direct = await open("/direct-usage");
  const blocks = direct.page.locator(".direct-block");
  assert.equal(await blocks.count(), DIRECT_BLOCKS);
  await direct.page.waitForFunction(
    ([selector, spans]) => [...document.querySelectorAll(selector)].every((block) => block.querySelector(spans)),
    [".direct-block", highlightedSpans] as const,
  );
  assert.ok((await blocks.first().innerHTML()).includes("--shiki-dark"), "a toml block used directly must be highlighted in the browser");
  assert.ok((await blocks.nth(1).innerHTML()).includes("--shiki-dark"), "a custom-language block used directly must be highlighted in the browser");
  assert.ok(direct.chunks.some((chunk) => HIGHLIGHTER_CHUNK.test(chunk)), "direct usage loads the browser highlighter");
  assert.deepEqual(direct.messages, [], "direct CodeBlock usage must not log Shiki warnings or errors");
  await direct.page.close();

  console.log("Code block highlighting test passed: server-highlighted blocks stay untouched and direct usage highlights once.");
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  await browser.close();
  server.kill("SIGTERM");
  await rm(outputDir, { recursive: true, force: true });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${baseUrl}/`)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start:\n${serverOutput}`);
}
