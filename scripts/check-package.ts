import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

assert.equal(typeof packageJson.name, "string", "package name is required");
assert.match(packageJson.version, /^\d+\.\d+\.\d+/, "package version must be semver-like");
assert.deepEqual(packageJson.files, ["dist"], "published files must be limited to dist");

const publishedTargets = new Set<string>();
const addTarget = (target: unknown, field: string) => {
  assert.equal(typeof target, "string", `${field} must be a string`);
  if (typeof target !== "string") return;
  publishedTargets.add(target);
};

addTarget(packageJson.main, "main");
addTarget(packageJson.types, "types");
for (const [name, target] of Object.entries(packageJson.bin || {})) addTarget(target, `bin.${name}`);

const collectExportTargets = (value: unknown, field: string) => {
  if (typeof value === "string") {
    addTarget(value, field);
    return;
  }
  assert.equal(typeof value, "object", `${field} must be a string or condition map`);
  for (const [condition, target] of Object.entries(value as Record<string, unknown>)) {
    collectExportTargets(target, `${field}.${condition}`);
  }
};

for (const [name, target] of Object.entries(packageJson.exports || {})) {
  collectExportTargets(target, `exports.${name}`);
}

for (const target of publishedTargets) {
  assert.equal(target.startsWith("./dist/"), true, `publish target must stay under dist: ${target}`);
  if (target.includes("*")) continue;
  await access(path.join(root, target));
}

const publicApi = await import(pathToFileURL(path.join(root, "dist/index.js")).href);
for (const symbol of [
  "createFolioPlugin",
  "defineFolioPlugin",
  "validateFolioPlugin",
  "validateFolioPlugins",
  "FolioPluginHookError",
  "createFolioPluginLifecycleManager",
]) {
  assert.equal(typeof publicApi[symbol], "function", `public plugin export is missing: ${symbol}`);
}
const declaration = await readFile(path.join(root, "dist/index.d.ts"), "utf8");
for (const typeName of ["FolioPlugin", "FolioPluginContext", "FolioBuildResult", "FolioPluginFactory", "FolioPluginLogger"]) {
  assert.match(declaration, new RegExp(`\\b${typeName}\\b`), `public plugin type is missing: ${typeName}`);
}

const cliPath = path.join(root, "dist/cli/index.js");
assert.equal((await stat(cliPath)).isFile(), true, "CLI entrypoint must be a file");
assert.equal((await stat(cliPath)).mode & 0o111, 0o111, "CLI entrypoint must be executable");

execFileSync(process.execPath, ["pm", "pack", "--dry-run", "--ignore-scripts"], {
  cwd: root,
  stdio: "inherit",
});

console.log("Package validation passed: exports, CLI, publish scope, and pack dry-run.");
