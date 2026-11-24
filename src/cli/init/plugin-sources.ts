import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import { isAuthoredSourceFile, listSourceFiles } from "./source-files.js";

export async function copyPluginSources(root: string): Promise<void> {
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
