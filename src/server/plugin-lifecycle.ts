import { scanContent } from "../core/content-scanner.js";
import {
  createFolioPluginLifecycleManager,
  type FolioPluginLifecycleManager,
} from "../core/plugin-lifecycle.js";
import type {
  FolioBuildResult,
  FolioPage,
  FolioPluginLogger,
} from "../plugin.js";
import type { DocsConfig } from "../types.js";

export interface FolioBuildSessionOptions {
  plugins: DocsConfig["plugins"];
  config: DocsConfig;
  rootDir: string;
  contentDir: string;
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
  private readonly lifecycle: FolioPluginLifecycleManager;
  private readonly contentDir: string;
  private startPromise?: Promise<void>;
  private pagesPromise?: Promise<readonly FolioPage[]>;

  constructor(options: FolioBuildSessionOptions) {
    this.contentDir = options.contentDir;
    this.lifecycle = createFolioPluginLifecycleManager({
      plugins: options.plugins,
      config: options.config,
      rootDir: options.rootDir,
      contentDir: options.contentDir,
      mode: options.mode,
      logger: options.logger || consoleLogger,
    });
  }

  async start(): Promise<void> {
    if (!this.startPromise) {
      this.startPromise = (async () => {
        await this.lifecycle.configResolved();
        await this.lifecycle.buildStart();
      })();
    }
    await this.startPromise;
  }

  async pages(): Promise<readonly FolioPage[]> {
    if (!this.pagesPromise) {
      this.pagesPromise = (async () => {
        await this.start();
        const scanned = await scanContent(this.contentDir);
        for (const page of scanned) {
          await this.lifecycle.pageCollected(page);
          await this.lifecycle.pageTransformed(page);
        }
        return this.lifecycle.getPages();
      })();
    }
    return this.pagesPromise;
  }

  getPages(): readonly FolioPage[] {
    return this.lifecycle.getPages();
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
