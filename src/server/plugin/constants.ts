export const VIRTUAL_CONFIG_ID = "virtual:folio-config";
export const RESOLVED_CONFIG_ID = "\0" + VIRTUAL_CONFIG_ID;
export const VIRTUAL_TREE_ID = "virtual:folio-tree";
export const RESOLVED_TREE_ID = "\0" + VIRTUAL_TREE_ID;
export const VIRTUAL_ROUTES_ID = "virtual:folio-routes";
export const RESOLVED_ROUTES_ID = "\0" + VIRTUAL_ROUTES_ID;
export const VIRTUAL_SOURCES_ID = "virtual:folio-sources";
export const RESOLVED_SOURCES_ID = "\0" + VIRTUAL_SOURCES_ID;
export const VIRTUAL_COMPONENTS_ID = "virtual:folio-components";
export const RESOLVED_COMPONENTS_ID = "\0" + VIRTUAL_COMPONENTS_ID;
export const VIRTUAL_ICONS_ID = "virtual:folio-icons";
export const RESOLVED_ICONS_ID = "\0" + VIRTUAL_ICONS_ID;
export const VIRTUAL_THEME_ID = "virtual:folio-theme";
export const RESOLVED_THEME_ID = "\0" + VIRTUAL_THEME_ID;
export const VIRTUAL_SHIKI_ID = "virtual:folio-shiki-stub";
export const RESOLVED_SHIKI_ID = "\0" + VIRTUAL_SHIKI_ID;

export const CONFIG_FILENAMES = new Set([
  "docs.config.ts", "docs.config.js", "docs.config.mjs",
  "nikala.docs.config.ts", "nikala.docs.config.js", "nikala.docs.config.mjs",
  "nikala.config.ts", "nikala.config.js",
]);
