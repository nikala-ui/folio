import type { DocsConfig } from "../types.js";

function normalizeRepositoryPath(...parts: string[]): string | undefined {
  const segments = parts
    .flatMap((part) => part.replace(/\\/g, "/").split("/"))
    .filter((segment) => segment && segment !== ".");

  if (segments.some((segment) => segment === "..")) return undefined;
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

function repositoryBaseUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) return undefined;
    return parsed.toString().replace(/\/$/, "").replace(/\.git$/, "");
  } catch {
    return undefined;
  }
}

/**
 * Validates `repository.source` at startup. The rest of `repository` keeps its
 * lenient behaviour: an unusable value only hides the link.
 */
export function validateRepositoryConfig(repository: DocsConfig["repository"]): void {
  const source: unknown = repository?.source;
  if (source === undefined) return;
  const fail = (message: string): never => {
    throw new Error(`[folio] repository.source ${message}`);
  };
  if (typeof source !== "object" || source === null || Array.isArray(source)) fail("must be an object with a url");
  const { url, branch, rootDir } = source as Record<string, unknown>;
  if (typeof url !== "string" || !repositoryBaseUrl(url)) fail("needs a url that is a valid http(s) URL");
  if (branch !== undefined && (typeof branch !== "string" || !branch.trim())) fail("branch must be a non-empty string");
  if (rootDir !== undefined && (typeof rootDir !== "string" || normalizeRepositoryPath(rootDir) === undefined)) {
    fail('rootDir must be a path inside the repository (no ".." segments)');
  }
}

/** Builds the "View source" URL from `repository.source`, or from `repository` when no source is set. */
export function getRepositorySourceUrl(
  repository: NonNullable<DocsConfig["repository"]>,
  sourcePath: string,
  contentDir = "docs",
): string | undefined {
  const target = repository.source ?? repository;
  const baseUrl = repositoryBaseUrl(target.url);
  const filePath = normalizeRepositoryPath(target.rootDir || "", contentDir, sourcePath);
  if (!baseUrl || !filePath) return undefined;

  const branch = encodeURIComponent(target.branch || "main");
  const hostname = new URL(baseUrl).hostname.toLowerCase();

  if (hostname === "gitlab.com" || hostname.endsWith(".gitlab.com")) {
    return `${baseUrl}/-/blob/${branch}/${filePath}`;
  }

  if (hostname === "bitbucket.org" || hostname.endsWith(".bitbucket.org")) {
    return `${baseUrl}/src/${branch}/${filePath}`;
  }

  return `${baseUrl}/blob/${branch}/${filePath}`;
}
