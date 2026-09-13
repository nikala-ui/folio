// packages/docs/src/themes/default/layout.tsx
import { createSignal, For, Show, splitProps, type ParentComponent } from "solid-js";
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
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClipboard } from "@/hooks/create-clipboard";
import { Copy, FileText, ChevronDown, ExternalLink, Sparkles } from "lucide-solid";
import { pageToMarkdown, pageToText, resolvePageActionUrl, sourceToMarkdown } from "../../client/page-actions.js";
import { getRepositorySourceUrl } from "../../navigation/repository-links.js";
import { resolveSearchProvider } from "../../search/provider.js";
import type { DocsLayoutProps } from "../types.js";

export const DocsLayout: ParentComponent<DocsLayoutProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "config",
    "tree",
    "pages",
    "currentPage",
    "breadcrumbs",
    "toc",
    "prev",
    "next",
    "sourceContent",
    "children",
    "class",
  ]);

  const [searchOpen, setSearchOpen] = createSignal(false);
  const pageClipboard = createClipboard();
  const searchEnabled = () => local.config.search?.enabled !== false;
  const searchProvider = () => resolveSearchProvider(local.config.search);

  const currentUrl = () => local.currentPage?.url;
  const landingPage = () =>
    local.currentPage?.url === "/" && local.config.home?.layout === "landing";
  const showLandingSidebar = () => local.config.home?.showSidebar === true;
  const showNavbar = () => local.config.home?.showNavbar !== false;
  const showToc = () =>
    Boolean(
      local.toc &&
      local.toc.length > 0 &&
      local.currentPage?.frontmatter?.toc !== false &&
      (!landingPage() || local.config.home?.showToc === true)
    );
  const sidebarLayout = () => local.config.navigation?.layout !== "top";
  const sidebarHeader = () => local.config.navigation?.sidebar?.header !== false;
  const sidebarFooter = () => local.config.navigation?.sidebar?.footer !== false;
  const sidebarPromo = () => local.config.navigation?.sidebar?.promo;
  const sourceUrl = () => {
    const page = local.currentPage;
    const repository = local.config.repository;
    if (!page?.sourcePath || !repository) return undefined;
    return getRepositorySourceUrl(repository, page.sourcePath, local.config.contentDir || "docs");
  };

  const pageElement = () => typeof document !== "undefined"
    ? document.querySelector("main article [data-docs-page-content]") as HTMLElement | null
    : null;
  const markdown = () => local.sourceContent
    ? sourceToMarkdown(local.sourceContent)
    : pageElement() ? pageToMarkdown(pageElement()!) : "";
  const copyPage = async () => {
    const page = pageElement();
    if (page) await pageClipboard.copy(pageToText(page));
  };
  const copyMarkdown = async () => {
    const content = markdown();
    if (content) await pageClipboard.copy(content);
  };
  const aiProviders = () => local.config.pageActions?.ai || [];
  const copyPageEnabled = () => local.config.pageActions?.copyPage !== false;
  const copyMarkdownEnabled = () => local.config.pageActions?.copyMarkdown !== false;
  const hasPageActions = () => copyPageEnabled() || copyMarkdownEnabled() || aiProviders().length > 0;
  const pageActionUrl = (provider: { url: string; prompt?: string }) => resolvePageActionUrl(provider.url, {
    url: typeof window !== "undefined" ? window.location.href : "",
    content: markdown(),
    title: local.currentPage?.title,
    prompt: provider.prompt,
  });
  const pageActions = () => local.currentPage?.pageActions || [];

  const sidebar = (className?: string) => (
    <DocsSidebar
      tree={local.tree}
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
      <Container as="main" size="2xl" class="min-w-0 w-full max-w-[96rem] flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_16rem] items-start gap-4 sm:gap-8 py-6 sm:py-8">
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
                <div class="flex items-center gap-2">
                  <Show when={sourceUrl()}>
                    {(url) => (
                      <a
                        href={url()}
                        target="_blank"
                        rel="noreferrer"
                        class={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
                      >
                        View source
                      </a>
                    )}
                  </Show>
                  <For each={pageActions()}>
                    {(action) => (
                      <a
                        href={action.href}
                        target={action.external ? "_blank" : undefined}
                        rel={action.external ? "noreferrer" : undefined}
                        class={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
                      >
                        {action.label}
                      </a>
                    )}
                  </For>
                  <Show when={hasPageActions()}>
                    <DropdownMenu placement="bottom-end">
                      <DropdownMenuTrigger
                        as={Button}
                        variant="secondary"
                        size="sm"
                        class="shrink-0 gap-1"
                        aria-label="Copy documentation page"
                      >
                        <Copy class="size-3.5" />
                        <span class="hidden sm:inline">Copy page</span>
                        <ChevronDown class="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <Show when={copyPageEnabled()}>
                          <DropdownMenuItem onClick={copyPage}>
                            <FileText class="mr-2 size-4" />
                            Copy page
                          </DropdownMenuItem>
                        </Show>
                        <Show when={copyMarkdownEnabled()}>
                          <DropdownMenuItem onClick={copyMarkdown}>
                            <Copy class="mr-2 size-4" />
                            Copy as Markdown
                          </DropdownMenuItem>
                        </Show>
                        <Show when={aiProviders().length > 0}>
                          <For each={aiProviders()}>
                            {(provider) => (
                              <DropdownMenuItem as="a" href={pageActionUrl(provider)} target="_blank" rel="noreferrer">
                                <ExternalLink class="mr-2 size-4" />
                                Open in {provider.name}
                              </DropdownMenuItem>
                            )}
                          </For>
                        </Show>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Show>
                </div>
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
                {(promo) => (
                  <Card class="border-primary/30 bg-primary/5 shadow-none">
                    <CardContent class="p-4">
                      <CardTitle class="text-sm">{promo().title}</CardTitle>
                      <CardDescription class="mt-2 text-xs leading-relaxed">
                        {promo().description}
                      </CardDescription>
                      <a
                        href={promo().href}
                        target="_blank"
                        rel="noreferrer"
                        class={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 h-8 w-full gap-1.5 text-xs")}
                      >
                        {promo().cta || "Learn more"}
                        <ExternalLink class="size-3" aria-hidden="true" />
                      </a>
                    </CardContent>
                  </Card>
                )}
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
          <DocsNavbar config={local.config} showBrand={true} showSidebarTrigger={false} onOpenSearch={() => setSearchOpen(true)} />
          <div class="flex min-h-0 min-w-0 max-w-full flex-1 items-start">{content()}</div>
        </div>
      }>
        {sidebar()}
        <div class="flex min-h-screen min-w-0 flex-1 flex-col">
          <DocsNavbar config={local.config} showBrand={false} onOpenSearch={() => setSearchOpen(true)} />
          {content()}
        </div>
      </Show>}>
        <div class="flex min-h-screen min-w-0 flex-1 flex-col">
          <Show when={showNavbar()}>
            <DocsNavbar
              config={local.config}
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
