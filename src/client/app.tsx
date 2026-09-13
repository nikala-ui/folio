import { createEffect, createSignal, type Component } from "solid-js";
import { defaultMdxComponents } from "../components/mdx-components.jsx";
import { DocsLayoutShell } from "./components/docs-layout-shell.jsx";
import { DocsPageContent } from "./components/docs-page-content.jsx";
import type { AppProps } from "./app-types.js";
import { createPageNavigation } from "./navigation/page-navigation.js";
import { createDocsRouter } from "./routing/use-docs-router.js";
import { SiteLocaleProvider } from "../plugins/i18n/runtime.jsx";

// @ts-ignore
import rawConfig from "virtual:folio-config";
// @ts-ignore
import { tree as sidebarTree, pages as allPages } from "virtual:folio-tree";
// @ts-ignore
import { routes as pageRoutes } from "virtual:folio-routes";
// @ts-ignore
import { sources as pageSources } from "virtual:folio-sources";

export type { AppProps } from "./app-types.js";

export const App: Component<AppProps> = (props) => {
  const config = rawConfig || { title: "Folio" };

  const router = createDocsRouter({
    initialPath: props.initialPath,
    initialPageModule: props.initialPageModule,
    pages: allPages,
    loaders: pageRoutes,
  });

  const [sourceContent, setSourceContent] = createSignal<string>();
  let sourceRequest = 0;
  createEffect(() => {
    const url = router.currentPage()?.url;
    const loader = url ? pageSources[url] : undefined;
    const request = ++sourceRequest;
    setSourceContent(undefined);
    if (typeof window === "undefined" || !loader) return;
    loader().then((module: { default: string }) => {
      if (request === sourceRequest) setSourceContent(module.default);
    });
  });

  if (typeof document !== "undefined") {
    createEffect(() => {
      const siteTitle = config.title || "Documentation";
      const pageTitle = router.currentPage()?.title;
      document.title = pageTitle && pageTitle !== siteTitle
        ? `${pageTitle} - ${siteTitle}`
        : siteTitle;
    });
  }
  const navigation = createPageNavigation(router.currentPage, allPages, sidebarTree);

  return (
    <SiteLocaleProvider
      config={config.uiLocale}
      pages={allPages}
      currentPath={router.currentPage()?.url}
      onNavigate={router.navigate}
    >
      <DocsLayoutShell
        config={config}
        tree={sidebarTree}
        pages={allPages}
        currentPage={router.currentPage()}
        onNavigate={router.navigate}
        breadcrumbs={navigation.breadcrumbs()}
        toc={router.activePageModule() ? navigation.toc() : []}
        prev={navigation.prevPage()}
        next={navigation.nextPage()}
        sourceContent={sourceContent()}
      >
        <DocsPageContent
          pageModule={router.activePageModule}
          mdxComponents={props.mdxComponents || defaultMdxComponents}
        />
      </DocsLayoutShell>
    </SiteLocaleProvider>
  );
};
