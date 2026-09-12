import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config.js";
import { buildDocs } from "../src/server/index.js";
import type { FolioPlugin } from "../src/plugin.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("self-hosted production acceptance", () => {
  test("builds the repository docs through the real plugin pipeline", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "folio-self-hosted-"));
    const calls: string[] = [];
    const config = await loadConfig(packageRoot);
    const plugin: FolioPlugin = {
      name: "self-hosted-acceptance",
      configResolved: (context) => {
        calls.push(`configResolved:${context.mode}`);
      },
      buildStart: () => {
        calls.push("buildStart");
      },
      pageCollected: (page) => {
        if (page.sourcePath === "configuration/plugins.mdx") calls.push("pageCollected:plugins");
      },
      pageTransformed: (page) => page.sourcePath === "configuration/plugins.mdx"
        ? { ...page, title: `${page.title} (Acceptance)`, frontmatter: { ...page.frontmatter, order: -100 } }
        : page,
      generate: async (context) => {
        calls.push("generate");
        await Bun.write(
          path.join(context.outputDir!, "self-hosted-plugin-result.json"),
          JSON.stringify({ outputDir: context.outputDir, urls: context.pages.map((page) => page.url) }),
        );
      },
      buildEnd: (result) => {
        calls.push(`buildEnd:${result.success}`);
      },
    };

    try {
      await buildDocs({
        root: packageRoot,
        outDir: outputRoot,
        config: { ...config, plugins: [...(config.plugins || []), plugin] },
      });

      const pluginsHtml = await readFile(path.join(outputRoot, "configuration", "plugins", "index.html"), "utf8");
      const result = JSON.parse(await readFile(path.join(outputRoot, "self-hosted-plugin-result.json"), "utf8")) as {
        outputDir: string;
        urls: string[];
      };

      expect(pluginsHtml).toContain("<title>Plugins (Acceptance) - Folio</title>");
      expect(result.outputDir).toBe(outputRoot);
      expect(result.urls).toContain("/configuration/plugins");
      expect(calls).toEqual(["configResolved:production", "buildStart", "pageCollected:plugins", "generate", "buildEnd:true"]);
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
