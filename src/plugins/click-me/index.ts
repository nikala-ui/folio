import { createFolioPlugin, type FolioPlugin } from "../../plugin.js";

export interface ClickMePluginOptions {
  label?: string;
  href?: string;
  external?: boolean;
}

export function createClickMePlugin(options: ClickMePluginOptions = {}): FolioPlugin {
  const label = options.label || "Click me";
  const href = options.href || "/";

  return createFolioPlugin(() => ({
    name: "click-me",
    pageActions: (_page, context) =>
      context.mode === "development" ? [{ label, href, external: options.external }] : [],
  }));
}

export const clickMePlugin = createClickMePlugin();
