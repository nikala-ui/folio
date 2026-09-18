import type { DocsConfig, PageData } from "../types.js";

export const LOCAL_SEARCH_PROVIDER = "local";

export interface SearchContext {
  query: string;
  pages: PageData[];
}

export interface SearchAdapterRuntime {
  /** Browser module that exports the adapter factory. */
  module: string;
  /** Named export containing a factory that receives the optional adapter options. */
  exportName: string;
  /** JSON-serializable options passed to the browser adapter factory. */
  options?: unknown;
}

export interface SearchAdapter {
  name: string;
  search: (context: SearchContext) => PageData[] | Promise<PageData[]>;
  runtime?: SearchAdapterRuntime;
}

export type ConfiguredSearchProvider = NonNullable<DocsConfig["search"]>["provider"];

export interface ResolvedSearchProvider {
  requested: string;
  active: string;
  fallback: boolean;
  implementation: SearchAdapter;
}

export const localSearchAdapter: SearchAdapter = {
  name: LOCAL_SEARCH_PROVIDER,
  search({ query, pages }) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return pages;

    return pages.filter((page) =>
      [page.title, page.url, page.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery))
    );
  },
};

/**
 * Resolve the configured search provider to an implementation available in
 * the default theme. External indexes can be added later without changing
 * the configuration contract or leaving the search dialog non-functional.
 */
export function resolveSearchProvider(search?: DocsConfig["search"]): ResolvedSearchProvider {
  const configuredProvider = search?.provider;

  if (configuredProvider && typeof configuredProvider !== "string" && typeof configuredProvider.search === "function") {
    return {
      requested: configuredProvider.name,
      active: configuredProvider.name,
      fallback: false,
      implementation: configuredProvider,
    };
  }

  const requested = typeof configuredProvider === "string"
    ? configuredProvider.trim() || LOCAL_SEARCH_PROVIDER
    : configuredProvider?.name || LOCAL_SEARCH_PROVIDER;

  return {
    requested,
    active: LOCAL_SEARCH_PROVIDER,
    fallback: requested !== LOCAL_SEARCH_PROVIDER,
    implementation: localSearchAdapter,
  };
}

export function searchPages(
  provider: ResolvedSearchProvider,
  query: string,
  pages: PageData[],
): PageData[] | Promise<PageData[]> {
  return provider.implementation.search({ query, pages });
}
