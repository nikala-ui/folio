import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, afterAll, describe, expect, test } from "bun:test";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(packageRoot, "dist/cli/index.js");

type Anchor = Record<string, string> & { text: string };

/** Opening `<a>` tags of prerendered HTML with their attributes and following text. */
function anchors(html: string): Anchor[] {
  return [...html.matchAll(/<a\b((?:[^>"]|"[^"]*")*)>([^<]*(?:<(?!\/a>)(?:[^>"]|"[^"]*")*>[^<]*)*)<\/a>/g)].map(([, attributes, inner]) => {
    const parsed: Record<string, string> = {};
    for (const [, name, value] of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) parsed[name] = value;
    return { ...parsed, text: inner.split(/<[^>]*>/).join("").trim() } as Anchor;
  });
}

let root = "";
let html = "";

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "folio-external-links-"));
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "guide.mdx"), `---
title: Guide
next:
  title: Elsewhere
  href: https://other.example/next
---

# Guide

[Releases link](https://github.com/example/releases)
[Same site link](https://docs.example.com/guide/)
[Internal link](/other)
[Hash link](#usage)
[Mail link](mailto:team@example.com)
[Phone link](tel:+15551234)

<a href="https://raw.example/page">Raw anchor</a>
<a href="https://opt.example/page" target="_self">Raw self</a>
`);
  await writeFile(path.join(root, "docs", "other.mdx"), "---\ntitle: Other\n---\n\n# Other\n");
  // The server-rendered theme only exists in the built package, so build with its CLI,
  // in a project that reuses this repository's sources like the repository docs do.
  for (const name of ["src", "node_modules"]) await symlink(path.join(packageRoot, name), path.join(root, name), "dir");
  for (const name of ["package.json", "tsconfig.json", "nikala.config.json"]) await copyFile(path.join(packageRoot, name), path.join(root, name));
  if (!existsSync(cliPath)) throw new Error("dist/cli/index.js is missing; run `bun run build` before this test");
  await writeFile(path.join(root, "docs.config.ts"), `export default {
  title: "External links",
  siteUrl: "https://docs.example.com",
  contentDir: "docs",
  navigation: {
    navbar: [
      { title: "Guide nav", href: "/guide" },
      { title: "Releases nav", href: "https://github.com/example/releases" },
      { title: "Same site nav", href: "https://docs.example.com/other" },
      { title: "Forced nav", href: "/other", external: true },
      { title: "Opted out nav", href: "https://optout.example/", external: false },
      { title: "Mail nav", href: "mailto:team@example.com" },
    ],
  },
};
`);
  const build = spawnSync(process.execPath, [cliPath, "build", "--outDir", "dist"], { cwd: root, encoding: "utf8" });
  if (build.status !== 0) throw new Error(`folio build failed:\n${build.stdout}\n${build.stderr}`);
  html = await readFile(path.join(root, "dist", "guide", "index.html"), "utf8");
}, 120_000);

afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" };
const find = (text: string) => anchors(html).filter((anchor) => anchor.text.startsWith(text));

describe("external links in prerendered pages", () => {
  test("navbar and mobile menu open other origins in a new tab", () => {
    for (const anchor of find("Releases nav")) expect(anchor).toMatchObject({ href: "https://github.com/example/releases", ...NEW_TAB });
    expect(find("Releases nav").length).toBe(2);
    expect(find("Releases nav")[0].text).toBe("Releases nav (opens in a new tab)");
  });

  test("navbar keeps internal, same-site and mail links in the same tab", () => {
    for (const label of ["Guide nav", "Same site nav", "Mail nav"]) {
      expect(find(label).length).toBe(2);
      for (const anchor of find(label)) {
        expect(anchor.target).toBeUndefined();
        expect(anchor.rel).toBeUndefined();
        expect(anchor.text).toBe(label);
      }
    }
  });

  test("an explicit external flag wins over the automatic rule", () => {
    for (const anchor of find("Forced nav")) expect(anchor).toMatchObject({ href: "/other", ...NEW_TAB });
    for (const anchor of find("Opted out nav")) {
      expect(anchor.target).toBeUndefined();
      expect(anchor.rel).toBeUndefined();
    }
  });

  test("Markdown and raw MDX anchors follow the same rule", () => {
    expect(find("Releases link")[0]).toMatchObject({ href: "https://github.com/example/releases", ...NEW_TAB });
    expect(find("Raw anchor")[0]).toMatchObject({ href: "https://raw.example/page", ...NEW_TAB });
    for (const label of ["Same site link", "Internal link", "Hash link", "Mail link", "Phone link"]) {
      expect(find(label)[0].target).toBeUndefined();
      expect(find(label)[0].rel).toBeUndefined();
    }
  });

  test("explicit target in content wins", () => {
    const anchor = find("Raw self")[0];
    expect(anchor.target).toBe("_self");
    expect(anchor.text).toBe("Raw self");
  });

  test("pager links to other origins open in a new tab", () => {
    const pager = anchors(html).find((anchor) => anchor.href === "https://other.example/next");
    expect(pager).toMatchObject(NEW_TAB);
    expect(pager?.text).toContain("Elsewhere");
    expect(pager?.text).toContain("(opens in a new tab)");
  });
});
