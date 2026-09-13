// packages/docs/src/themes/default/layout.tsx
import { createSignal, Show, splitProps, type ParentComponent } from "solid-js";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { DocsNavbar } from "./navbar.jsx";
import { DocsSidebar } from "./sidebar.jsx";
import { DocsBreadcrumbs } from "./content/breadcrumbs.jsx";
import { DocsPager } from "./content/pager.jsx";
import { DocsTableOfContents } from "./content/table-of-contents.jsx";
import { DocsMobileTableOfContents } from "./navigation/mobile-table-of-contents.jsx";
import { DocsSearchDialog } from "./overlays/search-dialog.jsx";
import { cn } from "@/lib/cn";
import { getRepositorySourceUrl } from "../../navigation/repository-links.js";
import { resolveSearchProvider } from "../../search/provider.js";
import type { DocsLayoutProps } from "../types.js";
import { PageActions } from "./components/page-actions.jsx";
import { SidebarPromo } from "./components/sidebar-promo.jsx";
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
      <Container as="main" size="2xl" class="min-w-0 w-full max-w-384 flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_16rem] items-start gap-4 sm:gap-8 py-6 sm:py-8">
        <Container as="article" size="full" class="min-w-0 max-w-none mx-0 px-0 sm:px-4 w-full">
          <Show when={local.breadcrumbs && local.breadcrumbs.length > 0}>
            <DocsBreadcrumbs items={local.breadcrumbs!} class="mb-6" />
          </Show>
          <Show when={local.currentPage?.title}>
            <SectionHeading
              variant="page"
              title={local.currentPage!.title}
              description={local.currentPage?.description}
              class="mb-8"
              actions={
                <PageActions
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
              }
            />
          </Show>
          <Show when={showToc()}>
            <DocsMobileTableOfContents items={local.toc!} class="mb-6" />
          </Show>
          <Container as="div" size="full" class="prose prose-zinc dark:prose-invert max-w-none px-0 sm:px-0 lg:px-0" data-docs-page-content>
            {local.children}
          </Container>
          <Show when={local.prev || local.next}>
            <DocsPager prev={local.prev} next={local.next} />
          </Show>
        </Container>
        <Show when={showToc() && local.currentPage?.url} keyed>
          <Container as="aside" size="sm" class="hidden xl:block w-64 shrink-0 self-start px-0 sticky top-14 z-10 h-fit max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-background">
            <div class="flex flex-col gap-5">
              <DocsTableOfContents items={local.toc!} class="max-h-none" />
              <Show when={sidebarPromo()}>
                {(promo) => <SidebarPromo promo={promo()} />}
              </Show>
            </div>
          </Container>
        </Show>
      </Container>
      <DocsSearchDialog open={searchOpen()} onOpenChange={setSearchOpen} pages={local.pages} provider={searchEnabled() ? searchProvider().implementation : undefined} />
    </SidebarInset>
  );

  const landingContent = () => (
    <SidebarInset class={cn("min-w-0", local.class)} {...rest}>
      <Container as="main" size="2xl" class="min-w-0 max-w-full flex-1 py-8 sm:py-12 lg:py-16">
        <Container as="article" size="xl" class="mx-auto min-w-0 px-0 sm:px-4">
          <Show when={local.config.home?.showBreadcrumbs === true}>
            <Show when={local.breadcrumbs && local.breadcrumbs.length > 0}>
              <DocsBreadcrumbs items={local.breadcrumbs!} class="mb-6" />
            </Show>
          </Show>
          <Container as="div" size="full" class="prose prose-zinc dark:prose-invert max-w-none px-0" data-docs-page-content>
            {local.children}
          </Container>
          <Show when={local.config.home?.showPager === true && (local.prev || local.next)}>
            <DocsPager prev={local.prev} next={local.next} />
          </Show>
        </Container>
      </Container>
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
