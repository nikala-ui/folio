import type { LanguageRegistration } from "shiki";
import { RESERVED_LANGUAGE_IDS } from "./builtin-languages.js";

/** Lower-cased language name or alias mapped to its registration. */
export type CustomLanguageIndex = ReadonlyMap<string, LanguageRegistration>;

function fail(index: number, message: string): never {
  throw new Error(`[folio] shiki.customLangs[${index}] ${message}`);
}

function readIdentifier(value: unknown, index: number, label: string): string {
  if (typeof value !== "string" || !value.trim()) fail(index, `${label} must be a non-empty string`);
  const id = value.trim().toLowerCase();
  if (/\s/.test(id)) fail(index, `${label} "${value}" must not contain whitespace`);
  return id;
}

/**
 * Validate `shiki.customLangs` and return the index used for lookups.
 * Throws a `[folio]` error describing the first invalid registration.
 */
export function createCustomLanguageIndex(languages: unknown): CustomLanguageIndex {
  const index = new Map<string, LanguageRegistration>();
  if (languages === undefined) return index;
  if (!Array.isArray(languages)) throw new Error("[folio] shiki.customLangs must be an array of Shiki language registrations");

  const scopes = new Set<string>();
  languages.forEach((entry: unknown, position) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(position, "must be a language registration object");
    const language = entry as Partial<LanguageRegistration>;
    const name = readIdentifier(language.name, position, "name");
    if (typeof language.scopeName !== "string" || !language.scopeName.trim()) fail(position, "scopeName must be a non-empty string");
    if (!Array.isArray(language.patterns)) fail(position, `("${language.name}") must define a patterns array`);
    if (language.aliases !== undefined && !Array.isArray(language.aliases)) fail(position, `("${language.name}") aliases must be an array of strings`);
    if (scopes.has(language.scopeName)) fail(position, `("${language.name}") scopeName "${language.scopeName}" is registered more than once`);
    scopes.add(language.scopeName);

    const ids = new Set([name, ...(language.aliases ?? []).map((alias) => readIdentifier(alias, position, "alias"))]);
    for (const id of ids) {
      if (RESERVED_LANGUAGE_IDS.has(id)) fail(position, `("${language.name}") uses "${id}", which is a built-in language or alias`);
      if (index.has(id)) fail(position, `("${language.name}") uses "${id}", which is already registered by "${index.get(id)!.name}"`);
      index.set(id, language as LanguageRegistration);
    }
  });
  return index;
}

/** Throws a `[folio]` configuration error when `shiki.customLangs` is invalid. */
export function validateCustomLanguages(languages: unknown): void {
  createCustomLanguageIndex(languages);
}
