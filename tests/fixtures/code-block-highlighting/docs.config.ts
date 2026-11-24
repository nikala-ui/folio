import type { DocsConfig } from "../../../src/types.js";
import { createI18nPlugin } from "../../../src/plugins/i18n/index.js";

// A site that enables a built-in language outside the browser highlighter's
// former fixed list (toml) and adds a custom language (demolang).
const config: DocsConfig = {
  title: "Code block highlighting",
  contentDir: "docs",
  search: { enabled: false },
  plugins: [createI18nPlugin({ defaultLocale: "en", locales: ["en"] })],
  shiki: {
    langs: ["typescript", "toml"],
    customLangs: [
      {
        name: "demolang",
        scopeName: "source.demolang",
        aliases: ["dl"],
        patterns: [{ name: "keyword.control.demolang", match: "\\b(?:fn|let)\\b" }],
      },
    ],
  },
};

export default config;
