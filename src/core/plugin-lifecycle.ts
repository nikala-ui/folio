import type {
  FolioBuildResult,
  FolioPage,
  FolioPlugin,
  FolioPluginContext,
  FolioPluginLogger,
} from "../plugin.js";
import { validateFolioPlugins } from "../plugin.js";
import type { DocsConfig } from "../types.js";
import {
  FolioPluginHookError,
  type FolioPluginHookMetadata,
  type LifecycleHook,
} from "./plugin-lifecycle-error.js";
import { snapshot } from "./plugin-lifecycle-snapshot.js";

type ContextHook = "configResolved" | "buildStart" | "generate";

export type { FolioPluginHookMetadata, LifecycleHook } from "./plugin-lifecycle-error.js";
export { FolioPluginHookError } from "./plugin-lifecycle-error.js";

export interface FolioPluginLifecycleOptions {
  plugins?: readonly FolioPlugin[];
  config: DocsConfig;
  rootDir: string;
  contentDir: string;
  outputDir?: string;
  mode: FolioPluginContext["mode"];
  logger: FolioPluginLogger;
  pages?: readonly FolioPage[];
}

function routeIdentity(page: FolioPage): string {
  return `${page.slug}\u0000${page.url}`;
}

export class FolioPluginLifecycleManager {
  private readonly plugins: readonly FolioPlugin[];
  private readonly options: FolioPluginLifecycleOptions;
  private pages: FolioPage[];

  constructor(options: FolioPluginLifecycleOptions) {
    validateFolioPlugins(options.plugins);
    this.plugins = options.plugins ? [...options.plugins] : [];
    this.options = options;
    this.pages = [...(options.pages ?? [])].map((page) => snapshot(page));
  }

  getPages(): readonly FolioPage[] {
    return snapshot(this.pages);
  }

  async configResolved(): Promise<void> { await this.runContextHook("configResolved"); }
  async buildStart(): Promise<void> { await this.runContextHook("buildStart"); }

  async pageCollected(page: FolioPage): Promise<void> {
    const collected = snapshot(page);
    this.pages = [...this.pages, collected];
    for (const plugin of this.plugins) {
      try {
        await plugin.pageCollected?.(collected, this.context());
      } catch (error) {
        throw this.wrap(plugin, "pageCollected", error, page);
      }
    }
  }

  async pageTransformed(page: FolioPage): Promise<FolioPage> {
    let transformed = snapshot(page);
    for (const plugin of this.plugins) {
      if (!plugin.pageTransformed) continue;
      const before = transformed;
      try {
        const result = await plugin.pageTransformed(before, this.context());
        if (!result || typeof result !== "object") throw new Error("must return a page object");
        if (routeIdentity(result) !== routeIdentity(before)) {
          throw new Error("must preserve the page route identity (slug and url)");
        }
        transformed = snapshot(result);
      } catch (error) {
        throw this.wrap(plugin, "pageTransformed", error, page);
      }
    }

    const index = this.pages.findIndex((candidate) => routeIdentity(candidate) === routeIdentity(page));
    if (index >= 0) this.pages[index] = transformed;
    return snapshot(transformed);
  }

  async generate(): Promise<void> { await this.runContextHook("generate"); }

  async buildEnd(result: FolioBuildResult): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.buildEnd?.(snapshot(result), this.context());
      } catch (error) {
        throw this.wrap(plugin, "buildEnd", error);
      }
    }
  }

  private context(): FolioPluginContext {
    return snapshot({
      config: this.options.config,
      rootDir: this.options.rootDir,
      contentDir: this.options.contentDir,
      outputDir: this.options.outputDir,
      pages: this.pages,
      mode: this.options.mode,
      logger: this.options.logger,
    }) as FolioPluginContext;
  }

  private async runContextHook(hook: ContextHook): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin[hook]?.(this.context());
      } catch (error) {
        throw this.wrap(plugin, hook, error);
      }
    }
  }

  private wrap(plugin: FolioPlugin, hook: LifecycleHook, error: unknown, page?: FolioPage): FolioPluginHookError {
    return error instanceof FolioPluginHookError
      ? error
      : new FolioPluginHookError(plugin.name, hook, error, this.options.mode, page);
  }
}

export function createFolioPluginLifecycleManager(
  options: FolioPluginLifecycleOptions,
): FolioPluginLifecycleManager {
  return new FolioPluginLifecycleManager(options);
}
