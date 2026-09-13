// packages/docs/src/index.ts
export * from "./types.js";
export type {
  FolioBuildResult,
  FolioPage,
  FolioPlugin,
  FolioPluginConfig,
  FolioPluginContext,
  FolioPluginFactory,
  FolioPluginLogger,
} from "./plugin.js";
export {
  createFolioPlugin,
  defineFolioPlugin,
  validateFolioPlugin,
  validateFolioPlugins,
} from "./plugin.js";
export {
  createFolioPluginLifecycleManager,
  FolioPluginHookError,
  FolioPluginLifecycleManager,
} from "./core/plugin/index.js";
export type {
  FolioPluginHookMetadata,
  FolioPluginLifecycleOptions,
} from "./core/plugin/index.js";
export type { SearchAdapter, SearchAdapterRuntime, SearchContext } from "./search/provider.js";
export * from "./navigation/index.js";
export * from "./config.js";
export * from "./core/content-scanner.js";
export * from "./core/route-tree.js";
export * from "./mdx/compiler.js";
export * from "./mdx/highlighter.js";
export * from "./server/index.js";
export * from "./search/provider.js";

import { nikalaDocsPlugin } from "./server/plugin/index.js";
export const nikalaDocs = nikalaDocsPlugin;
