import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { SITE_TRANSLATION_KEYS } from "../src/plugins/i18n/site-locale.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(packageRoot, "dist/cli/index.js");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "folio-consumer-"));
const packageLink = `file:${packageRoot}`;

// Measured on a 2-core runner with the pinned Bun: `dev` listens in ~1 s idle
// and ~3 s under CPU pressure; `preview` builds its SSR bundle before it
// listens (~10 s idle, ~18 s on one core, ~25 s with both cores contended).
// 60 s keeps more than twice the worst measured start as headroom.
const SERVER_START_TIMEOUT_MS = 60_000;
// A first response takes well under a second once the server is listening.
const REQUEST_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 100;

try {
  await writeFile(path.join(tempRoot, "package.json"), JSON.stringify({
    name: "folio-smoke-project",
    private: true,
    type: "module",
    dependencies: { "@nikala-ui/folio": packageLink },
  }, null, 2) + "\n");

  execFileSync(process.execPath, [cliPath, "init", "."], {
    cwd: tempRoot,
    stdio: "inherit",
  });

  for (const relativePath of [
    "docs.config.ts",
    "nikala.config.json",
    "docs/index.mdx",
    "src/components/ui",
    "src/hooks",
    "src/plugins",
    "src/themes/default",
    "public/favicon.ico",
  ]) {
    await access(path.join(tempRoot, relativePath));
  }

  const authoredSourceFiles = await collectFiles(tempRoot, ["src/plugins", "src/themes/default"]);
  assert.ok(authoredSourceFiles.length > 0);
  assert.deepEqual(
    authoredSourceFiles.filter((file) => /\.(?:d\.ts|js|jsx|map)$/.test(file)),
    [],
  );
  const configSource = await readFile(path.join(tempRoot, "docs.config.ts"), "utf8");
  assert.match(configSource, /createI18nPlugin\(\{ defaultLocale: "en", locales: \["en"\] \}\)/);

  await assertCopiedSourcesMatchFolio(tempRoot);
  await writeGuideFixture(tempRoot, configSource);
  const locale = JSON.parse(await readFile(path.join(tempRoot, "locales/en.json"), "utf8")) as Record<string, string>;
  assert.deepEqual(Object.keys(locale).sort(), [...SITE_TRANSLATION_KEYS].sort());
  assert.equal(locale["navigation.search"], "Search docs...");
  assert.equal(locale["theme.toggle"], "Toggle theme");
  for (const sourceFile of authoredSourceFiles) {
    const source = await readFile(path.join(tempRoot, sourceFile), "utf8");
    assert.doesNotMatch(source, /(?:\.\.\/)+types\.js|import\((?:\.\.\/)+types\.js\)/);
  }

  const packageJson = JSON.parse(await readFile(path.join(tempRoot, "package.json"), "utf8"));
  assert.equal(packageJson.dependencies["@nikala-ui/folio"], packageLink);

  execFileSync(process.execPath, ["install", "--frozen-lockfile"], {
    cwd: tempRoot,
    stdio: "inherit",
  });
  execFileSync(process.execPath, ["run", "build"], {
    cwd: tempRoot,
    stdio: "inherit",
  });

  const outputRoot = path.join(tempRoot, "dist");
  await access(path.join(outputRoot, "index.html"));
  await access(path.join(outputRoot, "favicon.ico"));
  await access(path.join(outputRoot, "assets"));

  await assertServerStarts(
    [cliPath, "dev", "--host", "127.0.0.1", "--port", "4184"],
    tempRoot,
    "http://127.0.0.1:4184/",
  );
  await assertServerStarts(
    [cliPath, "preview", "--host", "127.0.0.1", "--port", "4185", "--outDir", "dist"],
    tempRoot,
    "http://127.0.0.1:4185/",
    true,
    () => assertGuidePage("http://127.0.0.1:4185/guide"),
  );

  const protectedFiles = {
    "docs.config.ts": "export default { title: \"User-owned config\" };\n",
    "docs/index.mdx": "# User-owned page\n",
    "src/plugins/i18n/index.ts": "// user-owned plugin source\n",
    "src/themes/default/index.ts": "// user-owned theme source\n",
    "src/themes/default/runtime/page-actions.ts": "// user-owned runtime source\n",
    "src/components/ui/theme-toggle.tsx": "// user-owned component source\n",
    "src/lib/cn.ts": "// user-owned utility source\n",
  };
  const userOwnedTsconfig = "{\"userOwned\":true}\n";
  await writeFile(path.join(tempRoot, "tsconfig.json"), userOwnedTsconfig);
  for (const [relativePath, content] of Object.entries(protectedFiles)) {
    await writeFile(path.join(tempRoot, relativePath), content);
  }
  execFileSync(process.execPath, [cliPath, "init", "."], {
    cwd: tempRoot,
    stdio: "ignore",
  });
  for (const [relativePath, content] of Object.entries(protectedFiles)) {
    assert.equal(await readFile(path.join(tempRoot, relativePath), "utf8"), content);
  }
  assert.equal(JSON.parse(await readFile(path.join(tempRoot, "tsconfig.json"), "utf8")).userOwned, true);

  console.log("Generated consumer smoke test passed: init, install, build, assets, dev, and preview.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function collectFiles(root: string, directories: string[]): Promise<string[]> {
  const files: string[] = [];
  const visit = async (relative: string) => {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(child);
      else files.push(child);
    }
  };
  for (const directory of directories) await visit(directory);
  return files;
}

/**
 * Every component, hook and provider that init copies must be byte-identical to
 * the source of the Folio version that ran init, and the files Folio's own
 * code block and theme depend on must be there. `lib/cn.ts` is created by the
 * Nikala UI initializer first and differs from Folio's copy only in comments.
 */
async function assertCopiedSourcesMatchFolio(projectRoot: string) {
  const vendorRoot = path.join(packageRoot, "dist/vendor/docs-src");
  const copied = await collectFiles(projectRoot, ["src/components/ui", "src/hooks", "src/providers"]);
  copied.push("src/theme-accent.ts");
  for (const required of [
    "src/components/ui/section-heading.tsx",
    "src/components/ui/code-block.tsx",
    "src/components/ui/code-highlighter.ts",
    "src/components/ui/code-block-commands.ts",
    "src/components/ui/code-tabs.tsx",
  ]) assert.ok(copied.includes(required), `init must copy ${required}`);
  for (const file of copied) {
    const relative = path.relative("src", file);
    assert.equal(
      await readFile(path.join(projectRoot, file), "utf8"),
      await readFile(path.join(vendorRoot, relative), "utf8"),
      `${file} must match the source of the running Folio version`,
    );
  }
  assert.match(await readFile(path.join(projectRoot, "src/components/ui/section-heading.tsx"), "utf8"), /\bactions\b/, "section-heading must support the page actions slot");
}

/** A docs page with a custom-language fence, plus the repository link that enables "View source". */
async function writeGuideFixture(projectRoot: string, configSource: string) {
  const grammar = '{ name: "demolang", scopeName: "source.demolang", patterns: [{ name: "keyword.control.demolang", match: "\\\\b(?:fn|let)\\\\b" }] }';
  const extended = configSource.replace(
    "  search: { enabled: true },",
    `  search: { enabled: true },\n  repository: { url: "https://example.com/acme/docs", branch: "main" },\n  shiki: { customLangs: [${grammar}] },`,
  );
  assert.notEqual(extended, configSource, "the generated docs.config.ts changed shape; update this fixture");
  await writeFile(path.join(projectRoot, "docs.config.ts"), extended);
  await writeFile(
    path.join(projectRoot, "docs/guide.mdx"),
    "---\ntitle: Guide\ndescription: A page with page actions and a custom language.\n---\n\n```demolang\nfn main\n```\n",
  );
}

/** The generated project's docs page renders page actions and highlights a custom language without console noise. */
async function assertGuidePage(pageUrl: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const messages: string[] = [];
    page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") messages.push(`${message.type()}: ${message.text()}`);
    });
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    // The server renders the shell only; the page itself, including its header actions, renders in the browser.
    await page.getByRole("heading", { name: "Guide", level: 1 }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Copy documentation page" }).count(), 1, "the copy page action must render on a generated docs page");
    assert.match(
      (await page.getByRole("link", { name: "View source" }).getAttribute("href")) ?? "",
      /^https:\/\/example\.com\/acme\/docs\/.*guide\.mdx$/,
      "the view source action must render on a generated docs page",
    );
    assert.ok(await page.locator('code[class*="language-demolang"] span[style*="--shiki"]').count() > 0, "the custom language must be highlighted");
    assert.deepEqual(messages, [], "a generated docs page must not log warnings or errors in the browser");
  } finally {
    await browser.close();
  }
}

async function assertServerStarts(command: string[], cwd: string, url: string, expectRenderedText = false, inspect?: () => Promise<void>) {
  const server = spawn(process.execPath, command, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const startedAt = Date.now();
  let output = "";
  let exitCode: number | null | undefined;
  server.stdout.on("data", (chunk) => { output += String(chunk); });
  server.stderr.on("data", (chunk) => { output += String(chunk); });
  server.on("exit", (code) => { exitCode = code; });
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let lastAttempt = "no request was sent";
  let reachable = false;
  try {
    const deadline = startedAt + SERVER_START_TIMEOUT_MS;
    // The CLI prints the URL once it is listening. A request sent earlier can
    // be accepted by the socket and then stall until the client gives up
    // (observed with Bun 1.3.14 under CPU pressure), so wait for that line.
    while (!output.includes(url) && exitCode === undefined && Date.now() < deadline) await sleep(POLL_INTERVAL_MS);
    if (output.includes(url)) lastAttempt = "server printed its URL but no request completed";

    while (exitCode === undefined && Date.now() < deadline && output.includes(url)) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        const body = await response.text();
        if (response.ok) {
          assert.doesNotMatch(body, /(?:navigation|actions|search|theme)\.[a-zA-Z]+/);
          if (expectRenderedText) assert.match(body, /Search docs\.\.\./);
          reachable = true;
          break;
        }
        lastAttempt = `HTTP ${response.status}: ${body.slice(0, 500)}`;
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        lastAttempt = `request failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      await sleep(POLL_INTERVAL_MS);
    }

    if (reachable) {
      await inspect?.();
      return;
    }

    const state = exitCode !== undefined ? `exited with code ${exitCode}` : "still running";
    throw new Error(
      `Server did not start at ${url} within ${Date.now() - startedAt} ms (${state}).\n` +
      `Last attempt: ${lastAttempt}\nServer output:\n${output}`,
    );
  } finally {
    server.kill("SIGTERM");
  }
}
