import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_TRANSLATION_KEYS } from "../src/plugins/i18n/site-locale.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(packageRoot, "dist/cli/index.js");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "folio-consumer-"));
const packageLink = `file:${packageRoot}`;

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

async function assertServerStarts(command: string[], cwd: string, url: string, expectRenderedText = false) {
  const server = spawn(process.execPath, command, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => { output += String(chunk); });
  server.stderr.on("data", (chunk) => { output += String(chunk); });

  try {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        // The server is still starting.
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      if (!response.ok) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      const body = await response.text();
      assert.doesNotMatch(body, /(?:navigation|actions|search|theme)\.[a-zA-Z]+/);
      if (expectRenderedText) assert.match(body, /Search docs\.\.\./);
      return;
    }
    throw new Error(`Server did not start at ${url}:\n${output}`);
  } finally {
    server.kill("SIGTERM");
  }
}
