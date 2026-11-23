// Built-in Shiki language catalog shared by the highlighter and config validation.

export const languageLoaders = {
  typescript: () => import("@shikijs/langs/typescript"),
  javascript: () => import("@shikijs/langs/javascript"),
  tsx: () => import("@shikijs/langs/tsx"),
  jsx: () => import("@shikijs/langs/jsx"),
  bash: () => import("@shikijs/langs/shellscript"),
  json: () => import("@shikijs/langs/json"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  markdown: () => import("@shikijs/langs/markdown"),
  mdx: () => import("@shikijs/langs/mdx"),
  rust: () => import("@shikijs/langs/rust"),
  python: () => import("@shikijs/langs/python"),
  yaml: () => import("@shikijs/langs/yaml"),
  toml: () => import("@shikijs/langs/toml"),
  sql: () => import("@shikijs/langs/sql"),
  diff: () => import("@shikijs/langs/diff"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  go: () => import("@shikijs/langs/go"),
  mermaid: () => import("@shikijs/langs/mermaid"),
  dockerfile: () => import("@shikijs/langs/docker"),
  zig: () => import("@shikijs/langs/zig"),
} as const;

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

/** Identifiers that always render without highlighting. */
export const PLAIN_TEXT_IDS = ["text", "txt", "plain"] as const;

/**
 * Every identifier Folio already owns: loadable languages, shorthand aliases
 * and plain-text names. Custom languages must not reuse any of them.
 */
export const RESERVED_LANGUAGE_IDS: ReadonlySet<string> = new Set([
  ...Object.keys(languageLoaders),
  ...Object.keys(LANGUAGE_ALIASES),
  ...PLAIN_TEXT_IDS,
]);

export function normalizeLangAlias(lang: string): string {
  const id = lang.toLowerCase().trim();
  return Object.hasOwn(LANGUAGE_ALIASES, id) ? LANGUAGE_ALIASES[id] : id;
}
