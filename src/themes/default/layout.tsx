// packages/docs/src/themes/default/layout.tsx
import { createSignal, Show, splitProps, type ParentComponent } from "solid-js";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { DocsNavbar } from "./navbar.jsx";
import { DocsSidebar } from "./sidebar.jsx";
import { DocsSearchDialog } from "./overlays/search-dialog.jsx";
import { cn } from "@/lib/cn";
import { getRepositorySourceUrl } from "../../navigation/repository-links.js";
import { resolveSearchProvider } from "../../search/provider.js";
import type { DocsLayoutProps } from "../types.js";
import { DocsPageBody } from "./components/docs-page-body.jsx";
import { DocsLandingBody } from "./components/docs-landing-body.jsx";
import { PageHeader } from "./components/page-header.jsx";
import { createPageCopy } from "./hooks/use-page-copy.js";
import {
  isLandingPage,
  shouldShowLandingSidebar,
  shouldShowNavbar,
  shouldShowSidebarFooter,
  shouldShowSidebarHeader,
  shouldShowToc,
  shouldUseSidebarLayout,
} from "./lib/layout-visibility.js";

export const DocsLayout: ParentComponent<DocsLayoutProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "config",
    "tree",
    "pages",
    "currentPage",
    "onNavigate",
    "breadcrumbs",
    "toc",
    "prev",
    "next",
    "sourceContent",
    "children",
    "class",
  ]);

  const [searchOpen, setSearchOpen] = createSignal(false);
  const pageCopy = createPageCopy(() => local.sourceContent);
  const searchEnabled = () => local.config.search?.enabled !== false;
  const searchProvider = () => resolveSearchProvider(local.config.search);

  const currentUrl = () => local.currentPage?.url;
  const landingPage = () => isLandingPage(local.currentPage, local.config);
  const showLandingSidebar = () => shouldShowLandingSidebar(local.config);
  const showNavbar = () => shouldShowNavbar(local.config);
  const showToc = () => shouldShowToc(local.toc, local.currentPage, local.config, landingPage());
  const sidebarLayout = () => shouldUseSidebarLayout(local.config);
  const sidebarHeader = () => shouldShowSidebarHeader(local.config);
  const sidebarFooter = () => shouldShowSidebarFooter(local.config);
  const sidebarPromo = () => local.config.navigation?.sidebar?.promo;
  const sourceUrl = () => {
    const page = local.currentPage;
    const repository = local.config.repository;
    if (!page?.sourcePath || !repository) return undefined;
    return getRepositorySourceUrl(repository, page.sourcePath, local.config.contentDir || "docs");
  };

  const markdown = pageCopy.markdown;
  const aiProviders = () => local.config.pageActions?.ai || [];
  const copyPageEnabled = () => local.config.pageActions?.copyPage !== false;
  const copyMarkdownEnabled = () => local.config.pageActions?.copyMarkdown !== false;
  const pageActions = () => local.currentPage?.pageActions || [];

  const sidebar = (className?: string) => (
    <DocsSidebar
      tree={local.tree}
      pages={local.pages}
      nav={local.config.navigation?.navbar || local.config.nav}
      currentUrl={currentUrl()}
      title={local.config.title}
      logo={local.config.logo}
      headerSubtitle={local.config.navigation?.sidebar?.headerSubtitle}
      footerText={local.config.navigation?.sidebar?.footerText}
      showHeader={sidebarHeader()}
      showFooter={sidebarFooter()}
      class={className}
    />
  );

  const content = () => (
    <SidebarInset class={cn("min-w-0", local.class)} {...rest}>
      <DocsPageBody
        breadcrumbs={local.breadcrumbs}
        currentPage={local.currentPage}
        toc={local.toc}
        prev={local.prev}
        next={local.next}
        showToc={showToc()}
        sidebarPromo={sidebarPromo()}
        pageActions={
          <Show when={local.currentPage?.title}>
            <PageHeader
              title={local.currentPage!.title}
              description={local.currentPage?.description}
              sourceUrl={sourceUrl()}
              pageActions={pageActions()}
              aiProviders={aiProviders()}
              copyPageEnabled={copyPageEnabled()}
              copyMarkdownEnabled={copyMarkdownEnabled()}
              pageUrl={local.currentPage?.url}
              pageTitle={local.currentPage?.title}
              markdown={markdown}
              onCopyPage={pageCopy.copyPage}
              onCopyMarkdown={pageCopy.copyMarkdown}
            />
          </Show>
        }
      >
        {local.children}
      </DocsPageBody>
      <DocsSearchDialog open={searchOpen()} onOpenChange={setSearchOpen} pages={local.pages} provider={searchEnabled() ? searchProvider().implementation : undefined} />
    </SidebarInset>
  );

  const landingContent = () => (
    <SidebarInset class={cn("min-w-0", local.class)} {...rest}>
      <DocsLandingBody
        breadcrumbs={local.breadcrumbs}
        showBreadcrumbs={local.config.home?.showBreadcrumbs === true}
        showPager={local.config.home?.showPager === true}
        prev={local.prev}
        next={local.next}
      >
        {local.children}
      </DocsLandingBody>
      <DocsSearchDialog open={searchOpen()} onOpenChange={setSearchOpen} pages={local.pages} provider={searchEnabled() ? searchProvider().implementation : undefined} />
    </SidebarInset>
  );

  return (
    <SidebarProvider defaultOpen={true} class="min-h-screen w-full items-stretch">
      <Show when={landingPage()} fallback={<Show when={sidebarLayout()} fallback={
        <div class="flex min-h-screen min-w-0 flex-1 flex-col">
          <DocsNavbar config={local.config} currentPage={local.currentPage} pages={local.pages} onNavigate={local.onNavigate} showBrand={true} showSidebarTrigger={false} onOpenSearch={() => setSearchOpen(true)} />
          <div class="flex min-h-0 min-w-0 max-w-full flex-1 items-start">{content()}</div>
        </div>
      }>
        {sidebar()}
        <div class="flex min-h-screen min-w-0 flex-1 flex-col">
          <DocsNavbar config={local.config} currentPage={local.currentPage} pages={local.pages} onNavigate={local.onNavigate} showBrand={false} onOpenSearch={() => setSearchOpen(true)} />
          {content()}
        </div>
      </Show>}>
        <div class="flex min-h-screen min-w-0 flex-1 flex-col">
          <Show when={showNavbar()}>
            <DocsNavbar
              config={local.config}
              currentPage={local.currentPage}
              pages={local.pages}
              onNavigate={local.onNavigate}
              showBrand={true}
              showSidebarTrigger={showLandingSidebar()}
              mobileSidebarTrigger={landingPage()}
              onOpenSearch={() => setSearchOpen(true)}
            />
          </Show>
          <Show when={showLandingSidebar()} fallback={
            <>
              <Show when={landingPage()}>
                {sidebar("md:hidden")}
              </Show>
              {landingContent()}
            </>
          }>
            <div class="flex min-h-0 min-w-0 max-w-full flex-1 items-start">{sidebar()}{landingContent()}</div>
          </Show>
        </div>
      </Show>
    </SidebarProvider>
  );
};
