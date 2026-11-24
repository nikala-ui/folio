import { describe, expect, test } from "bun:test";
import { compileMdx } from "../src/mdx/compiler.js";
import { EXTERNAL_LINK_REL, getExternalLinkAttributes, isExternalHref, siteOriginFrom } from "../src/lib/external-links.js";

const SITE = "https://docs.example.com";

describe("siteOriginFrom", () => {
  test("keeps only the origin of a valid siteUrl", () => {
    expect(siteOriginFrom("https://docs.example.com/base/path/")).toBe(SITE);
    expect(siteOriginFrom("http://localhost:4173")).toBe("http://localhost:4173");
    expect(siteOriginFrom("not a url")).toBeUndefined();
    expect(siteOriginFrom(undefined)).toBeUndefined();
    expect(siteOriginFrom("")).toBeUndefined();
  });
});

describe("isExternalHref", () => {
  test("treats absolute http(s) URLs on other origins as external", () => {
    expect(isExternalHref("https://github.com/org/repo", SITE)).toBe(true);
    expect(isExternalHref("http://example.org/", SITE)).toBe(true);
    expect(isExternalHref("  https://github.com/org  ", SITE)).toBe(true);
    expect(isExternalHref("//cdn.example.net/file.pdf", SITE)).toBe(true);
    expect(isExternalHref("https://sub.docs.example.com/", SITE)).toBe(true);
    expect(isExternalHref("http://docs.example.com/", SITE)).toBe(true);
    expect(isExternalHref("https://docs.example.com:8443/", SITE)).toBe(true);
    expect(isExternalHref("HTTPS://GITHUB.COM/org", SITE)).toBe(true);
  });

  test("keeps same-origin, relative, hash and non-web links internal", () => {
    expect(isExternalHref("https://docs.example.com/guide/", SITE)).toBe(false);
    expect(isExternalHref("//docs.example.com/guide/", SITE)).toBe(false);
    expect(isExternalHref("/docs/install", SITE)).toBe(false);
    expect(isExternalHref("install", SITE)).toBe(false);
    expect(isExternalHref("../install#step", SITE)).toBe(false);
    expect(isExternalHref("#usage", SITE)).toBe(false);
    expect(isExternalHref("?q=1", SITE)).toBe(false);
    expect(isExternalHref("mailto:team@example.com", SITE)).toBe(false);
    expect(isExternalHref("tel:+15551234", SITE)).toBe(false);
    expect(isExternalHref("javascript:void(0)", SITE)).toBe(false);
    expect(isExternalHref("", SITE)).toBe(false);
    expect(isExternalHref(undefined, SITE)).toBe(false);
    expect(isExternalHref("https://", SITE)).toBe(false);
  });

  test("without a known site origin only absolute http(s) URLs are external", () => {
    expect(isExternalHref("https://github.com/org")).toBe(true);
    expect(isExternalHref("/docs/install")).toBe(false);
    expect(isExternalHref("#usage")).toBe(false);
    expect(isExternalHref("mailto:team@example.com")).toBe(false);
    expect(isExternalHref("https://docs.example.com/guide")).toBe(true);
  });
});

describe("getExternalLinkAttributes", () => {
  test("adds a new-tab target and safe rel for external links only", () => {
    expect(getExternalLinkAttributes("https://github.com/org", { siteOrigin: SITE })).toEqual({ target: "_blank", rel: "noopener noreferrer" });
    expect(EXTERNAL_LINK_REL).toBe("noopener noreferrer");
    expect(getExternalLinkAttributes("/docs/install", { siteOrigin: SITE })).toEqual({});
    expect(getExternalLinkAttributes("https://docs.example.com/x", { siteOrigin: SITE })).toEqual({});
    expect(getExternalLinkAttributes(undefined)).toEqual({});
  });

  test("an explicit external flag wins over the automatic rule", () => {
    expect(getExternalLinkAttributes("/docs/install", { external: true })).toEqual({ target: "_blank", rel: "noopener noreferrer" });
    expect(getExternalLinkAttributes("https://github.com/org", { external: false, siteOrigin: SITE })).toEqual({});
    expect(getExternalLinkAttributes("https://github.com/org", { external: undefined, siteOrigin: SITE })).toEqual({ target: "_blank", rel: "noopener noreferrer" });
  });
});

describe("raw MDX anchors", () => {
  const source = (href: string, extra = "") => `<a href="${href}"${extra}>link</a>\n`;

  test("get a new-tab target and rel when they point to another origin", async () => {
    const { code } = await compileMdx(source("https://github.com/org"), { siteUrl: SITE });
    expect(code).toContain('target="_blank"');
    expect(code).toContain('rel="noopener noreferrer"');
  });

  test("stay unchanged for same-site, relative and explicit-target links", async () => {
    for (const markup of [source("https://docs.example.com/page"), source("/page"), source("#top"), source("https://github.com/org", ' target="_self"')]) {
      const { code } = await compileMdx(markup, { siteUrl: SITE });
      expect(code).not.toContain('target="_blank"');
      expect(code).not.toContain("noopener");
    }
  });
});
