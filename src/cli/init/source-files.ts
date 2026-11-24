import path from "node:path";
import fs from "fs-extra";

export async function listSourceFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await listSourceFiles(fullPath));
    else if (entry.isFile()) result.push(fullPath);
  }
  return result;
}

export function isAuthoredSourceFile(file: string): boolean {
  return /\.(?:ts|tsx)$/.test(file) && !file.endsWith(".d.ts");
}
