// Pure helpers that format and highlight CLI commands for CodeBlock's package manager runner.

export type CodeBlockPackageManager = "bunx" | "npx" | "pnpm" | "yarn";

export function highlightCliCommand(code: string): string {
  const trimmed = code.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0) return code;

  const isRunner = ["bunx", "npx", "pnpm", "yarn", "bun", "npm", "cargo", "deno"].includes(parts[0]);
  if (!isRunner) return `<span class="text-foreground">${escapeHtml(trimmed)}</span>`;

  return parts
    .map((part, index) => {
      if (index === 0) {
        return `<span class="text-amber-500 dark:text-amber-400 font-bold">${escapeHtml(part)}</span>`;
      }
      if (part.startsWith("-")) {
        return `<span class="text-purple-400 dark:text-purple-300">${escapeHtml(part)}</span>`;
      }
      if (part.startsWith("@")) {
        return `<span class="text-emerald-400 dark:text-emerald-300 font-medium">${escapeHtml(part)}</span>`;
      }
      if (index === 1 && ["add", "install", "init", "create", "run"].includes(part)) {
        return `<span class="text-sky-500 dark:text-sky-400 font-medium">${escapeHtml(part)}</span>`;
      }
      return `<span class="text-foreground/90">${escapeHtml(part)}</span>`;
    })
    .join(" ");
}

export function transformCommandForPm(cmd: string, pm: CodeBlockPackageManager): string {
  const trimmed = cmd.trim();
  const runners = ["bunx", "npx", "pnpm dlx", "pnpm", "yarn dlx", "yarn", "bun", "npm"];

  let base = trimmed;
  for (const r of runners) {
    if (trimmed.startsWith(r)) {
      base = trimmed.slice(r.length).trim();
      break;
    }
  }

  switch (pm) {
    case "bunx":
      return `bunx ${base}`;
    case "npx":
      return `npx ${base}`;
    case "pnpm":
      return `pnpm dlx ${base}`;
    case "yarn":
      return `yarn dlx ${base}`;
    default:
      return `${pm} ${base}`;
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
