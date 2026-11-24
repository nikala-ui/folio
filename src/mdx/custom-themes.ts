import type { ThemeRegistration } from "shiki";
import { bundledThemesInfo } from "shiki/themes";
import type { ShikiThemeInput } from "../types.js";

/** Theme objects supplied through `shiki.themes`, keyed by colour scheme. */
export type CustomThemes = Partial<Record<ThemeMode, ThemeRegistration>>;

type ThemeMode = "light" | "dark";

const MODES: readonly ThemeMode[] = ["light", "dark"];
const BUNDLED_THEME_NAMES: ReadonlySet<string> = new Set(bundledThemesInfo.map((theme) => theme.id));

function fail(mode: ThemeMode, message: string): never {
  throw new Error(`[folio] shiki.themes.${mode} ${message}`);
}

function validateThemeObject(mode: ThemeMode, theme: Partial<ThemeRegistration>): ThemeRegistration {
  if (typeof theme.name !== "string" || !theme.name.trim()) fail(mode, "theme object needs a non-empty name");
  if (BUNDLED_THEME_NAMES.has(theme.name)) {
    fail(mode, `("${theme.name}") uses "${theme.name}", which is a bundled Shiki theme name; choose a different name`);
  }
  if (theme.type !== undefined && theme.type !== "light" && theme.type !== "dark") {
    fail(mode, `("${theme.name}") type must be "light" or "dark"`);
  }
  for (const field of ["tokenColors", "settings"] as const) {
    if (theme[field] !== undefined && !Array.isArray(theme[field])) fail(mode, `("${theme.name}") ${field} must be an array`);
  }
  if (theme.colors !== undefined && (typeof theme.colors !== "object" || theme.colors === null || Array.isArray(theme.colors))) {
    fail(mode, `("${theme.name}") colors must be an object`);
  }
  return theme as ThemeRegistration;
}

/**
 * Validate `shiki.themes` and return the Shiki theme objects it contains.
 * Bundled theme names are accepted unchanged. Throws a `[folio]` error
 * describing the first invalid value.
 */
export function createCustomThemes(themes: unknown): CustomThemes {
  const custom: CustomThemes = {};
  if (themes === undefined) return custom;
  if (!themes || typeof themes !== "object" || Array.isArray(themes)) {
    throw new Error("[folio] shiki.themes must be an object with optional light and dark themes");
  }

  for (const mode of MODES) {
    const value = (themes as Record<string, unknown>)[mode];
    if (value === undefined || typeof value === "string") continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(mode, "must be a bundled theme name or a Shiki theme object");
    }
    custom[mode] = validateThemeObject(mode, value as Partial<ThemeRegistration>);
  }

  if (custom.light && custom.dark && custom.light.name === custom.dark.name) {
    throw new Error(`[folio] shiki.themes.light and shiki.themes.dark both use the theme name "${custom.light.name}"; give each a unique name`);
  }
  return custom;
}

/** Throws a `[folio]` configuration error when `shiki.themes` is invalid. */
export function validateCustomThemes(themes: unknown): void {
  createCustomThemes(themes);
}

/** The loadable name of a configured theme: a bundled name or a theme object's `name`. */
export function getThemeName(theme: ShikiThemeInput): string {
  return typeof theme === "string" ? theme : theme.name!;
}
