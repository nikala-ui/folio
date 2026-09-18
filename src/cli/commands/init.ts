import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import pc from "picocolors";
import { FOLIO_VERSION } from "../../version.js";

interface RegistryFile { path: string; content: string; }
interface RegistryItem {
  name?: string;
  type?: string;
  files?: RegistryFile[];
  dependencies?: string[];
  registryDependencies?: string[];
}

async function listSourceFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await listSourceFiles(fullPath));
    else if (entry.isFile()) result.push(fullPath);
  }
  return result;
}

function isAuthoredSourceFile(file: string): boolean {
  return /\.(?:ts|tsx)$/.test(file) && !file.endsWith(".d.ts");
}

async function resolveRegistryDir(): Promise<string> {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const bundledRegistry = path.resolve(commandDir, "../../registry");
  if (await fs.pathExists(bundledRegistry)) return bundledRegistry;
  throw new Error("Folio registry is unavailable. Rebuild @nikala-ui/folio before running init.");
}

function runNikalaInit(root: string): void {
  let cliEntry: string;
  try {
    cliEntry = fileURLToPath(import.meta.resolve("@nikala-ui/cli"));
  } catch {
    const workspaceEntry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../cli/dist/index.js");
    if (!fs.existsSync(workspaceEntry)) {
      throw new Error("@nikala-ui/cli is required to initialize a docs project. Install it before running docs init.");
    }
    cliEntry = workspaceEntry;
  }
  console.log(`  ${pc.dim("↳ Running Nikala UI init --defaults")}`);
  execFileSync(process.execPath, [cliEntry, "init", "--defaults", "--skip-dependencies"], {
    cwd: root,
    stdio: "inherit",
  });
}

function installProjectDependencies(root: string): void {
  const manager = fs.existsSync(path.join(root, "bun.lockb")) || fs.existsSync(path.join(root, "bun.lock"))
    ? "bun"
    : fs.existsSync(path.join(root, "pnpm-lock.yaml"))
      ? "pnpm"
      : fs.existsSync(path.join(root, "yarn.lock"))
        ? "yarn"
        : "bun";
  console.log(`  ${pc.dim(`↳ Installing docs dependencies with ${manager}`)}`);
  try {
    execFileSync(manager, ["install"], { cwd: root, stdio: "inherit" });
  } catch {
    throw new Error(`Docs project dependencies could not be installed. Run \`${manager} install\` in ${root}.`);
  }
}

async function copyRegistrySource(root: string): Promise<{ componentFiles: string[]; hookFiles: string[]; dependencies: string[] }> {
  const registryDir = await resolveRegistryDir();
  const componentsDir = path.join(root, "src/components/ui");
  const hooksDir = path.join(root, "src/hooks");
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const docsComponentSources = [
    path.resolve(commandDir, "../../../src/components/mdx-components.tsx"),
    path.resolve(commandDir, "../../components/mdx-components.jsx"),
  ].filter((file) => fs.existsSync(file));
  const projectFiles = [
    ...(await listSourceFiles(path.join(root, "docs"))),
    ...(await listSourceFiles(path.join(root, "src/themes/default"))).filter(isAuthoredSourceFile),
    ...docsComponentSources,
  ];
  const projectSource = (await Promise.all(projectFiles.map((file) => fs.readFile(file, "utf-8")))).join("\n");
  const manifests = new Map<string, RegistryItem>();
  const exports = new Map<string, string>();

  for (const filename of (await fs.readdir(registryDir)).filter((name) => name.endsWith(".json") && name !== "index.json")) {
    const item = await fs.readJson(path.join(registryDir, filename)) as RegistryItem;
    const name = item.name || filename.replace(/\.json$/, "");
    manifests.set(name, item);
    for (const file of item.files || []) {
      for (const match of file.content.matchAll(/export\s+(?:const|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/g)) {
        exports.set(match[1], name);
      }
    }
  }

  const selected = new Set<string>();
  const queue: string[] = [];
  const addByExport = (name: string) => {
    const itemName = exports.get(name) || (manifests.has(name) ? name : undefined);
    if (itemName && !selected.has(itemName)) queue.push(itemName);
  };

  for (const match of projectSource.matchAll(/@\/components\/ui\/([a-z0-9-]+)/g)) addByExport(match[1]);
  for (const match of projectSource.matchAll(/@\/hooks\/([a-z0-9-]+)/g)) addByExport(match[1]);
  for (const match of projectSource.matchAll(/import\s*{([^{}]*?)}\s*from\s*["']@\/components\/ui["']/g)) {
    for (const name of match[1].split(",")) addByExport(name.trim().split(/\s+as\s+/)[0]);
  }
  for (const match of projectSource.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)) addByExport(match[1]);
  for (const match of projectSource.matchAll(/\bCore\.([A-Z][A-Za-z0-9_]*)/g)) addByExport(match[1]);

  const requiredItems: RegistryItem[] = [];
  while (queue.length) {
    const name = queue.shift()!;
    if (selected.has(name)) continue;
    const item = manifests.get(name);
    if (!item) continue;
    selected.add(name);
    requiredItems.push(item);
    for (const dependency of item.registryDependencies || []) addByExport(dependency);
    const source = (item.files || []).map((file) => file.content).join("\n");
    for (const match of source.matchAll(/@\/components\/ui\/([a-z0-9-]+)/g)) addByExport(match[1]);
    for (const match of source.matchAll(/@\/hooks\/([a-z0-9-]+)/g)) addByExport(match[1]);
    for (const match of source.matchAll(/import\s*{([^{}]*?)}\s*from\s*["']@\/components\/ui["']/g)) {
      for (const imported of match[1].split(",")) addByExport(imported.trim().split(/\s+as\s+/)[0]);
    }
  }

  const componentFiles: string[] = [];
  const hookFiles: string[] = [];
  const dependencies = new Set<string>();
  for (const item of requiredItems) {
    for (const dependency of item.dependencies || []) dependencies.add(dependency);
    const targetDir = item.type === "registry:hook" ? hooksDir : item.type === "registry:ui" ? root : undefined;
    if (!targetDir || !item.files) continue;
    for (const file of item.files) {
      const relative = file.path.replace(/^(ui|hooks|providers)[\\/]/, "");
      const destination = file.path.startsWith("providers/")
        ? path.join(root, "src/providers", relative)
        : file.path.startsWith("ui/")
          ? path.join(componentsDir, relative)
          : path.join(hooksDir, relative);
      if (!(await fs.pathExists(destination))) await fs.outputFile(destination, file.content, "utf-8");
      if (file.path.startsWith("hooks/")) hookFiles.push(relative.replace(/\.(tsx?|jsx?)$/, ""));
      else if (file.path.startsWith("ui/")) componentFiles.push(relative.replace(/\.(tsx?|jsx?)$/, ""));
    }
  }
  // These are Docs theme internals rather than public Nikala UI registry
  // entries, but the generated default theme imports them directly.
  const internalComponentCandidates = [
    path.resolve(commandDir, "../../vendor/docs-src/components/ui"),
    path.resolve(commandDir, "../../components/ui"),
  ];
  const internalComponentsSource = internalComponentCandidates.find((directory) => fs.existsSync(directory));
  if (internalComponentsSource) {
    for (const name of ["theme-toggle", "sidebar", "section-heading", "command"]) {
      const source = path.join(internalComponentsSource, `${name}.tsx`);
      if (await fs.pathExists(source)) {
        const destination = path.join(componentsDir, `${name}.tsx`);
        if (!(await fs.pathExists(destination))) await fs.copy(source, destination);
        componentFiles.push(name);
      }
    }
  }
  const cnCandidates = [
    path.resolve(commandDir, "../../lib/cn.ts"),
    path.resolve(commandDir, "../../vendor/docs-src/lib/cn.ts"),
  ];
  const cnSource = cnCandidates.find((candidate) => fs.existsSync(candidate));
  const cnDestination = path.join(root, "src/lib/cn.ts");
  if (cnSource && !(await fs.pathExists(cnDestination))) {
    await fs.outputFile(cnDestination, await fs.readFile(cnSource, "utf-8"), "utf-8");
  }
  return { componentFiles, hookFiles, dependencies: [...dependencies].sort() };
}

async function copyPluginSources(root: string): Promise<void> {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceCandidates = [
    path.resolve(commandDir, "../../../src/plugins"),
    path.resolve(commandDir, "../../vendor/docs-src/plugins"),
  ];
  const source = sourceCandidates.find((candidate) => fs.existsSync(candidate));
  if (!source) throw new Error("Folio plugin sources are missing from the package");

  for (const sourceFile of (await listSourceFiles(source)).filter(isAuthoredSourceFile)) {
    const relative = path.relative(source, sourceFile);
    const destination = path.join(root, "src/plugins", relative);
    const content = (await fs.readFile(sourceFile, "utf-8"))
      .replace(/from "(?:\.\.\/)+plugin\.js"/g, 'from "@nikala-ui/folio"')
      .replace(/from "(?:\.\.\/)+types\.js"/g, 'from "@nikala-ui/folio"')
      .replace(/(from "(?:\.\/|\.\.\/)[^"]+)\.jsx"/g, "$1.tsx\"")
      .replace(/(from "(?:\.\/|\.\.\/)[^"]+)\.js"/g, "$1.ts\"");
    if (!(await fs.pathExists(destination))) await fs.outputFile(destination, content, "utf-8");
  }
}

async function copyCustomTheme(root: string): Promise<void> {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceCandidates = [
    path.resolve(commandDir, "../../../src/themes/default"),
    path.resolve(commandDir, "../../vendor/docs-src/themes/default"),
  ];
  const source = sourceCandidates.find((candidate) => fs.existsSync(candidate));
  const target = path.join(root, "src/themes/default");
  if (!source) {
    const destination = path.join(target, "index.ts");
    if (!(await fs.pathExists(destination))) await fs.outputFile(destination, `export { defaultTheme as default } from "@nikala-ui/folio";
`, "utf-8");
    return;
  }
  for (const sourceFile of await listSourceFiles(source)) {
    const basename = path.basename(sourceFile);
    if (!isAuthoredSourceFile(sourceFile) || basename !== basename.toLowerCase()) continue;
    const relative = path.relative(source, sourceFile)
      .replace(/\.jsx?$/, ".tsx")
      .replace(/index\.tsx$/, "index.ts");
    const destination = path.join(target, relative);
    const runtimePrefix = relative.includes(path.sep) ? "../" : "./";
    let content = await fs.readFile(sourceFile, "utf-8");
    content = content
      .replace(/\s*\/\/[#@]\s*sourceMappingURL=.*$/gm, "")
      .replace(/from "@nikala-ui\/core\/ui\//g, 'from "@/components/ui/')
      .replace(/from "@nikala-ui\/core"/g, 'from "@/components/ui"')
      .replace(/from "@nikala-ui\/hooks"/g, 'from "@/hooks"')
      .replace(/from "(?:\.\.\/)+client\/page-actions\.js"/g, `from "${runtimePrefix}runtime/page-actions.js"`)
      .replace(/from "(?:\.\.\/)+navigation\/repository-links\.js"/g, `from "${runtimePrefix}runtime/repository-links.js"`)
      .replace(/from "(?:\.\.\/)+search\/provider\.js"/g, `from "${runtimePrefix}runtime/search-provider.js"`)
      .replace(/from "\.\.\/\.\.\/\.\.\/navigation\/sidebar-state\.js"/g, 'from "./sidebar-state.js"')
      .replace(/from "(?:\.\.\/)+types\.js"/g, 'from "@nikala-ui/folio"')
      .replace(/import\("(?:\.\.\/)+types\.js"\)/g, 'import("@nikala-ui/folio")')
      .replace(/from "(\.\.\/|\.\/)[^"]+\.(?:jsx|tsx|js)"/g, (match) => match.replace(/\.(?:jsx|tsx|js)"$/, '"'))
      .replace(/export \* from "(\.\.\/|\.\/)[^"]+\.(?:jsx|tsx|js)"/g, (match) => match.replace(/\.(?:jsx|tsx|js)"$/, '"'));
    if (!(await fs.pathExists(destination))) await fs.outputFile(destination, content, "utf-8");
  }

  const runtimeSources = [
    [["../../../src/client/page-actions.ts", "../../vendor/docs-src/client/page-actions.ts"], "runtime/page-actions.ts"],
    [["../../../src/navigation/repository-links.ts", "../../vendor/docs-src/navigation/repository-links.ts"], "runtime/repository-links.ts"],
    [["../../../src/search/provider.ts", "../../vendor/docs-src/search/provider.ts"], "runtime/search-provider.ts"],
  ] as const;
  for (const [relativeSources, relativeDestination] of runtimeSources) {
    const sourceFile = relativeSources
      .map((relativeSource) => path.resolve(commandDir, relativeSource))
      .find((candidate) => fs.existsSync(candidate));
    if (!sourceFile) continue;
    const destination = path.join(target, relativeDestination);
    if (!(await fs.pathExists(destination))) {
      const content = (await fs.readFile(sourceFile, "utf-8"))
        .replace(/\s*\/\/[#@]\s*sourceMappingURL=.*$/gm, "")
        .replace(/from "\.\.\/types\.js"/g, 'from "@nikala-ui/folio"');
      await fs.outputFile(destination, content, "utf-8");
    }
  }

  const navigationCandidates = [
    path.resolve(commandDir, "../../../src/navigation/sidebar-state.ts"),
    path.resolve(commandDir, "../../vendor/docs-src/navigation/sidebar-state.ts"),
  ];
  const navigationSource = navigationCandidates.find((candidate) => fs.existsSync(candidate));
  if (navigationSource) {
    const navigationContent = (await fs.readFile(navigationSource, "utf-8"))
      .replace(/from "\.\.\/types\.js"/g, 'from "@nikala-ui/folio"');
    const navigationTarget = path.join(target, "navigation/sidebar-state.ts");
    if (!(await fs.pathExists(navigationTarget))) await fs.outputFile(navigationTarget, navigationContent, "utf-8");
  }

}

async function copyDefaultAssets(root: string): Promise<void> {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceCandidates = [
    path.resolve(commandDir, "../../client/public/favicon.ico"),
    path.resolve(commandDir, "../../../src/client/public/favicon.ico"),
  ];
  const source = sourceCandidates.find((candidate) => fs.existsSync(candidate));
  if (!source) return;

  const destination = path.join(root, "public/favicon.ico");
  if (!(await fs.pathExists(destination))) await fs.copy(source, destination);
}

async function writeProjectFiles(root: string, registryDependencies: string[]): Promise<void> {
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
  const packagePath = path.join(root, "package.json");
  const docsPackageRoot = path.resolve(commandDir, "../../..");
  const workspaceRoot = path.resolve(docsPackageRoot, "../..");
  const workspaceManifestPath = path.join(workspaceRoot, "package.json");
  const isWorkspacePackage = await fs.pathExists(workspaceManifestPath)
    && (await fs.readJson(workspaceManifestPath)).workspaces?.includes("packages/*")
    && docsPackageRoot === path.join(workspaceRoot, "packages/docs");
  const targetIsInWorkspace = root === workspaceRoot || root.startsWith(`${workspaceRoot}${path.sep}`);
  const defaultPackageJson = {
    name: "folio-example",
    private: true,
    type: "module",
  scripts: { dev: "bunx @nikala-ui/folio dev", build: "bunx @nikala-ui/folio build", preview: "bunx @nikala-ui/folio preview" },
    dependencies: { "fs-extra": "^11.3.6" },
    devDependencies: {
      "@types/fs-extra": "latest",
      "@types/node": "latest",
      typescript: "latest",
    },
  };
  const existingPackageJson = await fs.pathExists(packagePath) ? await fs.readJson(packagePath) : {};
  const packageJson = {
    ...defaultPackageJson,
    ...existingPackageJson,
    scripts: { ...defaultPackageJson.scripts, ...existingPackageJson.scripts },
  };
  const docsPackageManifest = await fs.readJson(path.join(docsPackageRoot, "package.json"));
  const publishedDocsVersion = `^${docsPackageManifest.version}`;
  const localDocsLink = path.join(root, "node_modules/@nikala-ui/folio");
  const hasLocalDocsLink = await fs.pathExists(localDocsLink) && (await fs.lstat(localDocsLink)).isSymbolicLink();
  const docsDependency = hasLocalDocsLink
    ? "link:@nikala-ui/folio"
    : isWorkspacePackage
      ? targetIsInWorkspace
        ? "workspace:*"
        : "link:@nikala-ui/folio"
      : packageJson.dependencies?.["@nikala-ui/folio"] || publishedDocsVersion;
  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@nikala-ui/folio": docsDependency,
    ...(packageJson.dependencies?.["solid-js"] ? {} : { "solid-js": "latest" }),
    ...(packageJson.dependencies?.tailwindcss ? {} : { tailwindcss: "latest" }),
    ...Object.fromEntries(registryDependencies
      .filter((dependency) => !packageJson.dependencies?.[dependency])
      .map((dependency) => [dependency, "latest"])),
  };
  packageJson.devDependencies = {
    ...defaultPackageJson.devDependencies,
    ...existingPackageJson.devDependencies,
  };
  await fs.writeJson(packagePath, packageJson, { spaces: 2 });
  const tsconfigPath = path.join(root, "tsconfig.json");
  if (!(await fs.pathExists(tsconfigPath))) {
    await fs.outputFile(tsconfigPath, JSON.stringify({
      compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", jsxImportSource: "solid-js", allowImportingTsExtensions: true, strict: true, skipLibCheck: true, paths: { "@/*": ["./src/*"], "@/components/*": ["./src/components/*"], "@/components/ui/*": ["./src/components/ui/*"], "@/hooks/*": ["./src/hooks/*"], "@/plugins/*": ["./src/plugins/*"] } },
      include: ["src/**/*", "docs.config.ts"],
    }, null, 2) + "\n", "utf-8");
  }
}

export async function runInitCommand(targetDir = "."): Promise<void> {
  const root = path.resolve(process.cwd(), targetDir);
  console.log();
  console.log(pc.bold(pc.cyan("  Folio ")) + pc.dim(`v${FOLIO_VERSION}`));
  console.log(pc.dim(`  Initializing copy-paste documentation project in ${pc.bold(root)}...`));
  console.log();
  await fs.ensureDir(root);
  if (!(await fs.pathExists(path.join(root, "src/lib/cn.ts")))) runNikalaInit(root);
  await writeProjectFiles(root, []);
  const indexPath = path.join(root, "docs/index.mdx");
  if (!(await fs.pathExists(indexPath))) await fs.outputFile(indexPath, `---
title: Introduction
description: Welcome to your copy-paste documentation site.
order: 1
---

# Introduction

Your Nikala UI components and reactive hooks are owned locally in **src/components/ui** and **src/hooks**.

<Callout type="tip">
  Add documentation pages under **docs**. Folders become collapsible sidebar categories automatically.
</Callout>
  `, "utf-8");
  await copyCustomTheme(root);
  await copyPluginSources(root);
  await copyDefaultAssets(root);
  const copied = await copyRegistrySource(root);
  await writeProjectFiles(root, copied.dependencies);
  installProjectDependencies(root);
  console.log(`  ${pc.green("✓")} Copied ${copied.componentFiles.length} UI sources and ${copied.hookFiles.length} hook sources`);
  console.log(`  ${pc.green("✓")} Registered ${copied.dependencies.length} component dependencies`);
  console.log(`  ${pc.green("✓")} Created ${pc.cyan("docs")}, ${pc.cyan("src/plugins")}, ${pc.cyan("src/themes/default")}, and local Tailwind tokens`);
  console.log();
  console.log(`  ${pc.bold(pc.green("Success!"))} Run ${pc.cyan("bunx @nikala-ui/folio dev")} to start your docs.`);
  console.log();
}
