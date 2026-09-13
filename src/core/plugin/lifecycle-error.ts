import type { FolioPage, FolioPluginContext } from "../../plugin.js";

export type LifecycleHook =
  | "configResolved"
  | "buildStart"
  | "pagesGenerated"
  | "pageCollected"
  | "pageTransformed"
  | "pageActions"
  | "generate"
  | "buildEnd";

export interface FolioPluginHookMetadata {
  pluginName: string;
  hook: LifecycleHook;
  mode: FolioPluginContext["mode"];
  pageRoute?: string;
  sourcePath?: string;
}

export class FolioPluginHookError extends Error {
  readonly pluginName: string;
  readonly hook: LifecycleHook;
  readonly mode: FolioPluginContext["mode"];
  readonly pageRoute?: string;
  readonly sourcePath?: string;
  readonly metadata: FolioPluginHookMetadata;
  override readonly cause: unknown;

  constructor(
    pluginName: string,
    hook: LifecycleHook,
    cause: unknown,
    mode: FolioPluginContext["mode"] = "production",
    page?: FolioPage,
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    const pageRoute = page?.url;
    const sourcePath = page?.sourcePath ?? page?.filePath;
    const location = [
      pageRoute && `route "${pageRoute}"`,
      sourcePath && `source "${sourcePath}"`,
      `mode "${mode}"`,
    ].join(", ");
    super(`[folio] Plugin "${pluginName}" hook "${hook}" failed (${location}): ${detail}`, { cause });
    this.name = "FolioPluginHookError";
    this.pluginName = pluginName;
    this.hook = hook;
    this.mode = mode;
    this.pageRoute = pageRoute;
    this.sourcePath = sourcePath;
    this.metadata = { pluginName, hook, mode, pageRoute, sourcePath };
    this.cause = cause;
  }
}
