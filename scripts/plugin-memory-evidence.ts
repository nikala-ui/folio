import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeHeapSnapshot } from "node:v8";
import { createFolioBuildSession } from "../src/server/plugin/lifecycle.js";
import { buildDocs } from "../src/server/index.js";
import type { FolioPlugin } from "../src/plugin.js";

const pageCount = 100;
const reloadCount = 100;
const root = await mkdtemp(path.join(os.tmpdir(), "folio-plugin-memory-"));
const docsDir = path.join(root, "docs");
const evidenceDir = await mkdtemp(path.join(os.tmpdir(), "folio-plugin-evidence-"));
await mkdir(docsDir);

let configResolved = 0;
let buildStart = 0;
let transformed = 0;
const plugin: FolioPlugin = {
  name: "memory-evidence-plugin",
  configResolved: () => { configResolved += 1; },
  buildStart: () => { buildStart += 1; },
  pageTransformed: (page) => {
    transformed += 1;
    return page;
  },
};

for (let index = 0; index < pageCount; index += 1) {
  await writeFile(path.join(docsDir, `page-${index}.mdx`), `---\ntitle: Page ${index}\n---\n\n# Page ${index}\n`);
}

const session = createFolioBuildSession({
  plugins: [plugin],
  config: { title: "Memory Evidence", plugins: [plugin] },
  rootDir: root,
  contentDir: docsDir,
  mode: "development",
});

const collectGarbage = () => {
  if (typeof Bun !== "undefined" && typeof Bun.gc === "function") Bun.gc(true);
};

const memory = () => {
  const usage = process.memoryUsage();
  return { heapUsed: usage.heapUsed, heapTotal: usage.heapTotal, rss: usage.rss, external: usage.external };
};

const sample = (iteration: number) => {
  collectGarbage();
  return { iteration, pages: session.getPages().length, ...memory() };
};

await session.pages();
const before = sample(0);
const beforeSnapshot = writeHeapSnapshot(path.join(evidenceDir, "before.heapsnapshot"));
const samples = [before];

for (let iteration = 1; iteration <= reloadCount; iteration += 1) {
  await writeFile(path.join(docsDir, "page-0.mdx"), `---\ntitle: Page 0 revision ${iteration}\n---\n\n# Page 0 revision ${iteration}\n`);
  const pages = await session.reload();
  if (pages.length !== pageCount) throw new Error(`catalog grew or shrank at reload ${iteration}: ${pages.length}`);
  if (iteration % 10 === 0) samples.push(sample(iteration));
}

const after = sample(reloadCount);
const afterSnapshot = writeHeapSnapshot(path.join(evidenceDir, "after.heapsnapshot"));
const beforeNodes = await readSnapshotInventory(beforeSnapshot);
const afterNodes = await readSnapshotInventory(afterSnapshot);
const retainedNameDeltas = [...new Set([...beforeNodes.keys(), ...afterNodes.keys()])]
  .filter((name) => /folio|plugin|page|promise|session/i.test(name))
  .map((name) => ({ name, before: beforeNodes.get(name) || 0, after: afterNodes.get(name) || 0 }))
  .filter((entry) => entry.before !== entry.after)
  .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
  .slice(0, 40);

const devHookCounts = { configResolved, buildStart, transformed };
collectGarbage();
const productionBefore = memory();
await buildDocs({ root, outDir: "out", config: { title: "Memory Evidence", plugins: [plugin] } });
collectGarbage();
const productionAfter = memory();

const report = {
  root,
  pageCount,
  reloadCount,
  hookCounts: devHookCounts,
  expectedHookCounts: { configResolved: reloadCount + 1, buildStart: reloadCount + 1, transformed: pageCount * (reloadCount + 1) },
  before,
  after,
  heapDelta: { heapUsed: after.heapUsed - before.heapUsed, rss: after.rss - before.rss },
  productionBuildMemory: {
    before: productionBefore,
    after: productionAfter,
    heapDelta: productionAfter.heapUsed - productionBefore.heapUsed,
    rssDelta: productionAfter.rss - productionBefore.rss,
    hookDelta: {
      configResolved: configResolved - devHookCounts.configResolved,
      buildStart: buildStart - devHookCounts.buildStart,
      transformed: transformed - devHookCounts.transformed,
    },
  },
  snapshots: { before: beforeSnapshot, after: afterSnapshot },
  samples,
  retainedNameDeltas,
};
await writeFile(path.join(evidenceDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await rm(root, { recursive: true, force: true });

async function readSnapshotInventory(file: string): Promise<Map<string, number>> {
  const snapshot = JSON.parse(await readFile(file, "utf8")) as {
    snapshot: { meta: { node_fields: string[]; node_types: string[][] } };
    nodes: number[];
    strings: string[];
  };
  const fields = snapshot.snapshot.meta.node_fields;
  const stride = fields.length;
  const nameIndex = fields.indexOf("name");
  const counts = new Map<string, number>();
  for (let index = 0; index < snapshot.nodes.length; index += stride) {
    const name = snapshot.strings[snapshot.nodes[index + nameIndex]] || "";
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}
