import { Show, type Component, type JSX } from "solid-js";
import { Container } from "@/components/ui/container";
import { DocsBreadcrumbs } from "../content/breadcrumbs.jsx";
import { DocsPager } from "../content/pager.jsx";
import { DocsTableOfContents } from "../content/table-of-contents.jsx";
import { DocsMobileTableOfContents } from "../navigation/mobile-table-of-contents.jsx";
import { SidebarPromo } from "./sidebar-promo.jsx";
import type { BreadcrumbItemData } from "../../types.js";
import type { PageData, TocItem } from "../../../types.js";

export interface DocsPageBodyProps {
  breadcrumbs?: BreadcrumbItemData[];
  currentPage?: PageData;
  toc?: TocItem[];
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
  showToc: boolean;
  pageActions: JSX.Element;
  sidebarPromo?: NonNullable<NonNullable<import("../../../types.js").DocsNavigationConfig["sidebar"]>["promo"]>;
  children?: JSX.Element;
}

export const DocsPageBody: Component<DocsPageBodyProps> = (props) => (
  <Container as="main" size="2xl" class="min-w-0 w-full max-w-[96rem] flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_16rem] items-start gap-4 sm:gap-8 py-6 sm:py-8">
    <Container as="article" size="full" class="min-w-0 max-w-none mx-0 px-0 sm:px-4 w-full">
      <Show when={props.breadcrumbs && props.breadcrumbs.length > 0}>
        <DocsBreadcrumbs items={props.breadcrumbs!} class="mb-6" />
      </Show>
      <Show when={props.currentPage?.title}>
        {props.pageActions}
      </Show>
      <Show when={props.showToc}>
        <DocsMobileTableOfContents items={props.toc!} class="mb-6" />
      </Show>
      <Container as="div" size="full" class="prose prose-zinc dark:prose-invert max-w-none px-0 sm:px-0 lg:px-0" data-docs-page-content>
        {props.children}
      </Container>
      <Show when={props.prev || props.next}>
        <DocsPager prev={props.prev} next={props.next} />
      </Show>
    </Container>
    <Show when={props.showToc && props.currentPage?.url} keyed>
      <Container as="aside" size="sm" class="hidden xl:block w-64 shrink-0 self-start px-0 sticky top-14 z-10 h-fit max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-background">
        <div class="flex flex-col gap-5">
          <DocsTableOfContents items={props.toc!} class="max-h-none" />
          <Show when={props.sidebarPromo}>
            {(promo) => <SidebarPromo promo={promo()} />}
          </Show>
        </div>
      </Container>
    </Show>
  </Container>
);
