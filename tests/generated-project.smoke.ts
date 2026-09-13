import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  );

  console.log("Generated consumer smoke test passed: init, install, build, assets, dev, and preview.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function assertServerStarts(command: string[], cwd: string, url: string) {
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
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch {
        // The server is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Server did not start at ${url}:\n${output}`);
  } finally {
    server.kill("SIGTERM");
  }
}
