import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";
import pc from "picocolors";

export function runNikalaInit(root: string): void {
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

export function installProjectDependencies(root: string): void {
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
