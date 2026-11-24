import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { folioDependencyRange, type FolioManifest } from "./dependency-ranges.js";

export async function writePackageJson(root: string, registryDependencies: string[]): Promise<void> {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  const packagePath = path.join(root, "package.json");
  const docsPackageRoot = path.resolve(commandDir, "../../..");
  const workspaceRoot = path.resolve(docsPackageRoot, "../..");
  const workspaceManifestPath = path.join(workspaceRoot, "package.json");
  const isWorkspacePackage = await fs.pathExists(workspaceManifestPath)
    && (await fs.readJson(workspaceManifestPath)).workspaces?.includes("packages/*")
    && docsPackageRoot === path.join(workspaceRoot, "packages/docs");
  const targetIsInWorkspace = root === workspaceRoot || root.startsWith(`${workspaceRoot}${path.sep}`);
  const docsPackageManifest = await fs.readJson(path.join(docsPackageRoot, "package.json")) as FolioManifest;
  const folioRange = (name: string) => folioDependencyRange(docsPackageManifest, name);
  const defaultPackageJson = {
    name: "folio-example",
    private: true,
    type: "module",
  scripts: { dev: "bunx @nikala-ui/folio dev", build: "bunx @nikala-ui/folio build", preview: "bunx @nikala-ui/folio preview" },
    dependencies: { "fs-extra": folioRange("fs-extra") },
    devDependencies: {
      "@types/fs-extra": folioRange("@types/fs-extra"),
      "@types/node": folioRange("@types/node"),
      typescript: folioRange("typescript"),
    },
  };
  const existingPackageJson = await fs.pathExists(packagePath) ? await fs.readJson(packagePath) : {};
  const packageJson = {
    ...defaultPackageJson,
    ...existingPackageJson,
    scripts: { ...defaultPackageJson.scripts, ...existingPackageJson.scripts },
  };
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
    ...(packageJson.dependencies?.["solid-js"] ? {} : { "solid-js": folioRange("solid-js") }),
    ...(packageJson.dependencies?.tailwindcss ? {} : { tailwindcss: folioRange("tailwindcss") }),
    ...Object.fromEntries(registryDependencies
      .filter((dependency) => !packageJson.dependencies?.[dependency])
      .map((dependency) => [dependency, folioRange(dependency)])),
  };
  packageJson.devDependencies = {
    ...defaultPackageJson.devDependencies,
    ...existingPackageJson.devDependencies,
  };
  await fs.writeJson(packagePath, packageJson, { spaces: 2 });
}
