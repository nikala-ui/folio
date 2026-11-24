// Built-in Shiki language catalog shared by the highlighter, the generated
// browser loaders, and config validation.
import type { LanguageRegistration } from "shiki";
import { LANGUAGE_ALIASES, normalizeLangAlias } from "../lib/highlight-languages.js";

export { LANGUAGE_ALIASES, normalizeLangAlias };

/** Built-in language ids mapped to the `@shikijs/langs` module that provides each grammar. */
export const languageModules = {
  typescript: "typescript",
  javascript: "javascript",
  tsx: "tsx",
  jsx: "jsx",
  bash: "shellscript",
  json: "json",
  css: "css",
  html: "html",
  markdown: "markdown",
  mdx: "mdx",
  rust: "rust",
  python: "python",
  yaml: "yaml",
  toml: "toml",
  sql: "sql",
  diff: "diff",
  c: "c",
  cpp: "cpp",
  go: "go",
  mermaid: "mermaid",
  dockerfile: "docker",
  zig: "zig",
} as const;

export type BuiltinLanguageId = keyof typeof languageModules;

export const languageLoaders = Object.fromEntries(
  Object.entries(languageModules).map(([id, module]) => [id, () => import(`@shikijs/langs/${module}`)]),
) as Record<BuiltinLanguageId, () => Promise<{ default: LanguageRegistration[] }>>;

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

/** The built-in languages a site enables: its `shiki.langs` allowlist, or all of them when the list is unset. */
export function resolveBuiltinLanguages(langs: readonly string[] | undefined): BuiltinLanguageId[] {
  const ids = Object.keys(languageModules) as BuiltinLanguageId[];
  if (!langs) return ids;
  const allowed = new Set(langs.map(normalizeLangAlias));
  return ids.filter((id) => allowed.has(id));
}
