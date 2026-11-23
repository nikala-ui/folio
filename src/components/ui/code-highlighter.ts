// Browser-side Shiki highlighting for CodeBlock usages without server-rendered children.
let highlighterPromise: Promise<any> | null = null;

async function getHighlighter() {
  if (typeof window === "undefined") return null;
  if (!highlighterPromise) {
    try {
      const [{ createBundledHighlighter }, { createJavaScriptRegexEngine }] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
      ]);
      const createHighlighter = createBundledHighlighter({
        langs: {
          typescript: () => import("@shikijs/langs/typescript"),
          javascript: () => import("@shikijs/langs/javascript"),
          tsx: () => import("@shikijs/langs/tsx"),
          jsx: () => import("@shikijs/langs/jsx"),
          bash: () => import("@shikijs/langs/shellscript"),
          json: () => import("@shikijs/langs/json"),
          css: () => import("@shikijs/langs/css"),
          html: () => import("@shikijs/langs/html"),
          rust: () => import("@shikijs/langs/rust"),
        },
        themes: {
          "github-dark": () => import("@shikijs/themes/github-dark"),
          "github-light": () => import("@shikijs/themes/github-light"),
        },
        engine: () => createJavaScriptRegexEngine(),
      });
      highlighterPromise = createHighlighter({
        themes: ["github-dark", "github-light"],
        langs: ["typescript", "javascript", "tsx", "jsx", "bash", "json", "css", "html", "rust"],
      });
    } catch (e) {
      console.warn("Failed to load Shiki highlighter", e);
      return null;
    }
  }
  return highlighterPromise;
}

/**
 * Resolve a language from the site's `shiki.customLangs`. The grammar module is
 * a separate lazy chunk, fetched only for languages the highlighter lacks.
 */
async function loadCustomLanguage(highlighter: any, lang: string): Promise<string | null> {
  try {
    const { default: languages } = await import("virtual:folio-highlight-languages");
    const match = languages.find((entry) =>
      [entry.name, ...(entry.aliases ?? [])].some((id) => id.toLowerCase() === lang),
    );
    if (!match) return null;
    await highlighter.loadLanguage(match);
    return match.name;
  } catch (err) {
    console.warn(`Failed to load custom Shiki language: ${lang}`, err);
    return null;
  }
}

/** Highlight code in the browser, or return null when the caller should fall back to plain text. */
export async function highlightOnClient(code: string, rawLang: string): Promise<string | null> {
  const highlighter = await getHighlighter();
  if (!highlighter) return null;

  const requested = rawLang === "js" ? "javascript" : rawLang === "ts" ? "typescript" : rawLang;
  const lang = highlighter.getLoadedLanguages().includes(requested)
    ? requested
    : (await loadCustomLanguage(highlighter, requested.toLowerCase())) ?? requested;
  try {
    return highlighter.codeToHtml(code, { lang, themes: { light: "github-light", dark: "github-dark" } });
  } catch (err) {
    console.warn(`Shiki failed for language: ${rawLang}`, err);
    return null;
  }
}
