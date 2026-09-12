import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

export function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function getTailwindSourceDirectives(rootDir: string, docsDir: string, moduleDir: string): string {
  const sources: string[] = [];
  const bundledDocsSource = path.resolve(moduleDir, "../vendor/docs-src");
  if (fs.existsSync(bundledDocsSource)) sources.push(bundledDocsSource);
  sources.push(path.resolve(rootDir, "src"));
  const themesDir = path.resolve(moduleDir, "../themes");
  if (fs.existsSync(themesDir)) sources.push(themesDir);
  if (docsDir && fs.existsSync(docsDir)) sources.push(docsDir);
  return sources.map((src) => `@source "${src}";`).join("\n");
}

export function getServerModuleDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}
