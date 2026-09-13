import { defineFolioPlugin, type FolioPlugin } from "../src/plugin.js";

export interface DocsQualityOptions {
  /** Turn quality warnings into build failures. */
  strict?: boolean;
  /** Require every page to expose a non-empty description. */
  requireDescription?: boolean;
  /** Frontmatter keys that every page must provide. */
  requiredFrontmatter?: readonly string[];
}

export function createDocsQualityPlugin(options: DocsQualityOptions = {}): FolioPlugin {
  const strict = options.strict ?? false;
  const requireDescription = options.requireDescription ?? true;
  const requiredFrontmatter = options.requiredFrontmatter ?? [];

  return defineFolioPlugin({
    name: "docs-quality",
    pageTransformed(page, context) {
      const issues: string[] = [];
      if (!page.title.trim()) issues.push("title must not be empty");
      if (requireDescription && !page.description?.trim()) issues.push("description is required");

      for (const key of requiredFrontmatter) {
        const value = page.frontmatter[key];
        if (value === undefined || value === null || String(value).trim() === "") {
          issues.push(`frontmatter.${key} is required`);
        }
      }

      if (issues.length) {
        const message = `[folio:docs-quality] ${page.sourcePath || page.url}: ${issues.join("; ")}`;
        if (strict) throw new Error(message);
        context.logger.warn(message);
      }
      return page;
    },
  });
}
