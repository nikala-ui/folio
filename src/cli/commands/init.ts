import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";
import { FOLIO_VERSION } from "../../version.js";
import { copyDefaultAssets } from "../init/default-assets.js";
import { installProjectDependencies, runNikalaInit } from "../init/external-commands.js";
import { copyPluginSources } from "../init/plugin-sources.js";
import { writeProjectFiles } from "../init/project-files.js";
import { copyRegistrySource } from "../init/registry-sources.js";
import { copyCustomTheme } from "../init/theme-sources.js";

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
