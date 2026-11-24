import { describe, expect, test } from "bun:test";
import { getRepositorySourceUrl, validateRepositoryConfig } from "../src/navigation/repository-links.js";

describe("repository-links", () => {
  test("builds a GitHub source URL with branch and content root", () => {
    expect(getRepositorySourceUrl(
      {
        url: "https://github.com/example/docs.git",
        branch: "develop",
        rootDir: "website",
      },
      "themes/colors.mdx",
      "docs",
    )).toBe("https://github.com/example/docs/blob/develop/website/docs/themes/colors.mdx");
  });

  test("uses the GitLab blob URL format", () => {
    expect(getRepositorySourceUrl(
      { url: "https://gitlab.com/example/docs", branch: "main" },
      "index.mdx",
    )).toBe("https://gitlab.com/example/docs/-/blob/main/docs/index.mdx");
  });

  test("rejects unsafe repository paths", () => {
    expect(getRepositorySourceUrl(
      { url: "https://github.com/example/docs", rootDir: "../private" },
      "index.mdx",
    )).toBeUndefined();
  });

  test("builds the source URL from repository.source and keeps url for the project", () => {
    const repository = {
      url: "https://github.com/example/compiler",
      branch: "develop",
      rootDir: "compiler",
      source: { url: "https://github.com/example/website.git", branch: "trunk", rootDir: "apps/docs" },
    };
    expect(getRepositorySourceUrl(repository, "docs/install.mdx", "docs"))
      .toBe("https://github.com/example/website/blob/trunk/apps/docs/docs/docs/install.mdx");
    expect(repository.url).toBe("https://github.com/example/compiler");
  });

  test("source defaults to the main branch and does not inherit repository.branch or rootDir", () => {
    expect(getRepositorySourceUrl(
      { url: "https://github.com/example/compiler", branch: "develop", rootDir: "compiler", source: { url: "https://github.com/example/website" } },
      "index.mdx",
    )).toBe("https://github.com/example/website/blob/main/docs/index.mdx");
  });

  test("source on GitLab uses the GitLab blob format", () => {
    expect(getRepositorySourceUrl(
      { url: "https://github.com/example/compiler", source: { url: "https://gitlab.com/example/site" } },
      "index.mdx",
    )).toBe("https://gitlab.com/example/site/-/blob/main/docs/index.mdx");
  });

  test("an unsafe source rootDir hides the link instead of falling back", () => {
    expect(getRepositorySourceUrl(
      { url: "https://github.com/example/compiler", source: { url: "https://github.com/example/site", rootDir: "../x" } },
      "index.mdx",
    )).toBeUndefined();
  });
});

describe("validateRepositoryConfig", () => {
  const base = { url: "https://github.com/example/compiler" };

  test("accepts a missing source and a complete source", () => {
    expect(() => validateRepositoryConfig(undefined)).not.toThrow();
    expect(() => validateRepositoryConfig(base)).not.toThrow();
    expect(() => validateRepositoryConfig({ ...base, source: { url: "https://github.com/example/site", branch: "main", rootDir: "" } })).not.toThrow();
  });

  test("rejects a source without a usable url", () => {
    expect(() => validateRepositoryConfig({ ...base, source: {} as never })).toThrow("[folio] repository.source needs a url");
    expect(() => validateRepositoryConfig({ ...base, source: { url: "git@github.com:example/site.git" } })).toThrow("valid http(s) URL");
    expect(() => validateRepositoryConfig({ ...base, source: "https://github.com/example/site" as never })).toThrow("must be an object");
  });

  test("rejects an empty branch and an unsafe rootDir", () => {
    expect(() => validateRepositoryConfig({ ...base, source: { url: "https://github.com/example/site", branch: " " } })).toThrow("branch must be a non-empty string");
    expect(() => validateRepositoryConfig({ ...base, source: { url: "https://github.com/example/site", rootDir: "../x" } })).toThrow("rootDir must be a path inside the repository");
  });
});
