import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { isAuthoredSourceFile, listSourceFiles } from "./source-files.js";

export async function copyCustomTheme(root: string): Promise<void> {
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
