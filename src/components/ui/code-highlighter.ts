// Browser-side Shiki highlighting for CodeBlock usages without server-rendered children.
import type { HighlighterGeneric, LanguageRegistration } from "shiki/core";
import { normalizeLangAlias } from "@/lib/highlight-languages";

type BuiltinTheme = "github-light" | "github-dark";
type ClientHighlighter = HighlighterGeneric<string, BuiltinTheme>;

let highlighterPromise: Promise<ClientHighlighter | null> | null = null;

async function createClientHighlighter(): Promise<ClientHighlighter | null> {
  try {
    const [{ createBundledHighlighter }, { createJavaScriptRegexEngine }, { default: builtinLanguages }] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("virtual:folio-builtin-languages"),
    ]);
    // The site's `shiki.langs` decides which built-in grammars exist as chunks.
    const createHighlighter = createBundledHighlighter<string, BuiltinTheme>({
      langs: builtinLanguages as Record<string, () => Promise<{ default: LanguageRegistration[] }>>,
      themes: {
        "github-dark": () => import("@shikijs/themes/github-dark"),
        "github-light": () => import("@shikijs/themes/github-light"),
      },
      engine: () => createJavaScriptRegexEngine(),
    });
    // Languages load on demand and configured themes after that, so the page
    // starts with the default themes only.
    return await createHighlighter({ themes: ["github-dark", "github-light"], langs: [] });
  } catch (err) {
    console.warn("Failed to load Shiki highlighter", err);
    return null;
  }
}

/**
 * The page's one highlighter. The promise is stored before anything is awaited,
 * so highlights requested at the same time share it instead of each creating
 * their own instance.
 */
function getHighlighter(): Promise<ClientHighlighter | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  highlighterPromise ??= createClientHighlighter();
  return highlighterPromise;
}

async function ensureLoaded(highlighter: ClientHighlighter, name: string, source: LanguageRegistration | string): Promise<string | null> {
  if (highlighter.getLoadedLanguages().includes(name)) return name;
  try {
    await highlighter.loadLanguage(source as LanguageRegistration);
    return name;
  } catch (err) {
    console.warn(`Failed to load Shiki language: ${name}`, err);
    return null;
  }
}

/**
 * Resolve a fence language to one the highlighter has loaded: a language from
 * the site's `shiki.customLangs`, then a built-in one that the site's
 * `shiki.langs` enables. Grammars are separate lazy chunks, fetched only when
 * first used. Returns null for plain text and for languages the site does not
 * highlight, so the caller falls back to plain text.
 */
async function resolveLanguage(highlighter: ClientHighlighter, rawLang: string): Promise<string | null> {
  const lang = normalizeLangAlias(rawLang);
  const [{ default: custom }, { default: builtin }] = await Promise.all([
    import("virtual:folio-highlight-languages"),
    import("virtual:folio-builtin-languages"),
  ]);
  const registration = (custom as unknown as LanguageRegistration[]).find((entry) =>
    [entry.name, ...(entry.aliases ?? [])].some((id) => id.toLowerCase() === lang));
  if (registration) return ensureLoaded(highlighter, registration.name, registration);
  return Object.hasOwn(builtin, lang) ? ensureLoaded(highlighter, lang, lang) : null;
}

/**
 * Resolve the light and dark themes. Theme objects from the site's
 * `shiki.themes` are loaded into the highlighter from a separate lazy chunk;
 * any other mode keeps its bundled GitHub theme.
 */
async function loadConfiguredThemes(highlighter: ClientHighlighter): Promise<{ light: string; dark: string }> {
  const themes = { light: "github-light", dark: "github-dark" };
  try {
    const { default: custom } = await import("virtual:folio-highlight-themes");
    for (const mode of ["light", "dark"] as const) {
      const theme = custom[mode];
      if (!theme) continue;
      if (!highlighter.getLoadedThemes().includes(theme.name)) await highlighter.loadTheme(theme as never);
      themes[mode] = theme.name;
    }
  } catch (err) {
    console.warn("Failed to load custom Shiki themes", err);
  }
  return themes;
}

/** Highlight code in the browser, or return null when the caller should fall back to plain text. */
export async function highlightOnClient(code: string, rawLang: string): Promise<string | null> {
  const highlighter = await getHighlighter();
  if (!highlighter) return null;
  const lang = await resolveLanguage(highlighter, rawLang);
  if (!lang) return null;
  try {
    return highlighter.codeToHtml(code, { lang, themes: await loadConfiguredThemes(highlighter) });
  } catch (err) {
    console.warn(`Shiki failed for language: ${rawLang}`, err);
    return null;
  }
}
