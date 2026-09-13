import { describe, expect, test } from "bun:test";
import type { DocsConfig } from "../src/types.js";
import { createVirtualModuleLoader } from "../src/server/plugin/virtual-modules.js";
import { RESOLVED_CONFIG_ID } from "../src/server/plugin/constants.js";

describe("search adapter browser runtime", () => {
  test("generates a provider-neutral runtime import from the adapter descriptor", async () => {
    const config: DocsConfig = {
      search: {
        provider: {
          name: "remote",
          search: () => [],
          runtime: {
            module: "provider-package/browser",
            exportName: "createProviderBrowserAdapter",
            options: { indexName: "docs" },
          },
        },
      },
    };
    const load = createVirtualModuleLoader(
      () => ({ rootDir: "/project", docsDir: "/project/docs", resolvedConfig: config, isSsrBuild: false }),
      "/project/src/server/plugin",
    );

    const source = await load(RESOLVED_CONFIG_ID);

    expect(source).toContain(String.raw`import * as searchRuntime from "provider-package\u002Fbrowser";`);
    expect(source).toContain('searchRuntime["createProviderBrowserAdapter"]');
    expect(source).toContain('"options":{"indexName":"docs"}');
    expect(source).not.toContain("search: ()");
  });
});
