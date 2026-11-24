import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

export async function copyDefaultAssets(root: string): Promise<void> {
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
