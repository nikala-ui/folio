import { scanContent } from "../../core/content-scanner.js";
import {
  createFolioPluginLifecycleManager,
  type FolioPluginLifecycleManager,
} from "../../core/plugin/index.js";
import type {
  FolioBuildResult,
  FolioPage,
  FolioPluginLogger,
} from "../../plugin.js";
import type { DocsConfig } from "../../types.js";

export interface FolioBuildSessionOptions {
  plugins: DocsConfig["plugins"];
  config: DocsConfig;
  rootDir: string;
  contentDir: string;
  outputDir?: string;
  mode: "development" | "production";
  logger?: FolioPluginLogger;
}

const consoleLogger: FolioPluginLogger = {
  debug: (message, ...args) => console.debug(message, ...args),
  info: (message, ...args) => console.info(message, ...args),
  warn: (message, ...args) => console.warn(message, ...args),
  error: (message, ...args) => console.error(message, ...args),
};

/** Coordinates one Folio build's plugin lifecycle and page catalog. */
export class FolioBuildSession {
  private lifecycle: FolioPluginLifecycleManager;
  private readonly options: FolioBuildSessionOptions;
  private readonly contentDir: string;
  private startPromise?: Promise<void>;
  private pagesPromise?: Promise<readonly FolioPage[]>;
  private failure?: unknown;
  private generation = 0;

  constructor(options: FolioBuildSessionOptions) {
    this.options = options;
    this.contentDir = options.contentDir;
    this.lifecycle = this.createLifecycle();
  }

  private createLifecycle(): FolioPluginLifecycleManager {
    return createFolioPluginLifecycleManager({
      plugins: this.options.plugins,
      config: this.options.config,
      rootDir: this.options.rootDir,
      contentDir: this.options.contentDir,
      outputDir: this.options.outputDir,
      mode: this.options.mode,
      logger: this.options.logger || consoleLogger,
    });
  }

  async start(): Promise<void> {
    if (!this.startPromise) {
      const generation = this.generation;
      const lifecycle = this.lifecycle;
      this.startPromise = (async () => {
        await lifecycle.configResolved();
        await lifecycle.buildStart();
        if (generation !== this.generation) return;
      })();
    }
    await this.startPromise;
  }

  async pages(): Promise<readonly FolioPage[]> {
    if (!this.pagesPromise) {
      const generation = this.generation;
      const lifecycle = this.lifecycle;
      this.pagesPromise = (async () => {
        await this.start();
        const scanned = await scanContent(this.contentDir);
        const generated = await lifecycle.pagesGenerated(scanned);
        for (const page of generated) {
          if (generation !== this.generation) return this.pages();
          await lifecycle.pageCollected(page);
          const transformed = await lifecycle.pageTransformed(page);
          await lifecycle.pageActions(transformed);
        }
        if (generation !== this.generation) return this.pages();
        return lifecycle.getPages();
      })().catch((error) => {
        this.failure = error;
        throw error;
      });
    }
    return this.pagesPromise;
  }

  /** Rebuilds the development catalog with a fresh lifecycle manager. */
  async reload(): Promise<readonly FolioPage[]> {
    const previousLifecycle = this.lifecycle;
    const previousStart = this.startPromise;
    const previousPages = this.pagesPromise;
    const previousFailure = this.failure;
    this.generation += 1;
    this.lifecycle = this.createLifecycle();
    this.startPromise = undefined;
    this.pagesPromise = undefined;
    this.failure = undefined;
    try {
      return await this.pages();
    } catch (error) {
      this.lifecycle = previousLifecycle;
      this.startPromise = previousStart;
      this.pagesPromise = previousPages;
      this.failure = previousFailure;
      throw error;
    }
  }

  getPages(): readonly FolioPage[] {
    return this.lifecycle.getPages();
  }

  getFailure(): unknown {
    return this.failure;
  }

  async generate(): Promise<void> {
    await this.pages();
    await this.lifecycle.generate();
  }

  async buildEnd(result: FolioBuildResult): Promise<void> {
    await this.lifecycle.buildEnd(result);
  }
}

export function createFolioBuildSession(options: FolioBuildSessionOptions): FolioBuildSession {
  return new FolioBuildSession(options);
}
