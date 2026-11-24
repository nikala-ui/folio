import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { writePackageJson } from "./package-json.js";

export async function writeProjectFiles(root: string, registryDependencies: string[]): Promise<void> {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const docsConfigPath = path.join(root, "docs.config.ts");
  if (!(await fs.pathExists(docsConfigPath))) await fs.outputFile(docsConfigPath, `import { createI18nPlugin } from "./src/plugins/i18n/index.ts";

export default {
  plugins: [createI18nPlugin({ defaultLocale: "en", locales: ["en"] })],
  title: "My Project Docs",
  description: "Documentation built with Folio",
  favicon: "/favicon.ico",
  contentDir: "docs",
  css: "src/index.css",
  home: { layout: "landing", showSidebar: false, showNavbar: true, showBreadcrumbs: false, showToc: false, showPager: false },
  theme: { path: "./src/themes/default" },
  navigation: { layout: "sidebar", navbar: [{ title: "Home", href: "/" }], sidebar: { nav: "auto", header: true, footer: false, headerSubtitle: "Documentation", footerText: "Documentation" } },
  search: { enabled: true },
};
`, "utf-8");
  const localeTemplate = path.resolve(commandDir, "../../templates/locales/en.json");
  const localePath = path.join(root, "locales/en.json");
  if (!(await fs.pathExists(localePath)) && await fs.pathExists(localeTemplate)) {
    await fs.ensureDir(path.dirname(localePath));
    await fs.copyFile(localeTemplate, localePath);
  }
  const environmentTemplate = path.resolve(commandDir, "../../templates/env.d.ts");
  const environmentPath = path.join(root, "src/env.d.ts");
  if (!(await fs.pathExists(environmentPath)) && await fs.pathExists(environmentTemplate)) {
    await fs.copyFile(environmentTemplate, environmentPath);
  }
  const nikalaConfigPath = path.join(root, "nikala.config.json");
  if (!(await fs.pathExists(nikalaConfigPath))) {
    await fs.writeJson(nikalaConfigPath, {
      $schema: "https://nikala.dev/schema.json",
      style: "default",
      baseColor: "neutral",
      primaryColor: "amber",
      css: "src/index.css",
      alias: {
        components: "src/components/ui",
        utils: "src/lib",
      },
    }, { spaces: 2 });
  }
  await writePackageJson(root, registryDependencies);
  const tsconfigPath = path.join(root, "tsconfig.json");
  if (!(await fs.pathExists(tsconfigPath))) {
    await fs.outputFile(tsconfigPath, JSON.stringify({
      compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", jsxImportSource: "solid-js", allowImportingTsExtensions: true, strict: true, skipLibCheck: true, paths: { "@/*": ["./src/*"], "@/components/*": ["./src/components/*"], "@/components/ui/*": ["./src/components/ui/*"], "@/hooks/*": ["./src/hooks/*"], "@/plugins/*": ["./src/plugins/*"] } },
      include: ["src/**/*", "docs.config.ts"],
    }, null, 2) + "\n", "utf-8");
  }
}
