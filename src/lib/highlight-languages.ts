// Fence-language names shared by the server and browser highlighters. Keep this
// file free of server-only imports: `folio init` copies it into generated projects.

/** Fence-language shorthands that resolve to a built-in language id. */
export const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  shell: "bash",
  sh: "bash",
  zsh: "bash",
  js: "javascript",
  ts: "typescript",
  py: "python",
  rs: "rust",
  yml: "yaml",
  md: "markdown",
  rb: "ruby",
  cs: "csharp",
};

export function normalizeLangAlias(lang: string): string {
  const id = lang.toLowerCase().trim();
  return Object.hasOwn(LANGUAGE_ALIASES, id) ? LANGUAGE_ALIASES[id] : id;
}
