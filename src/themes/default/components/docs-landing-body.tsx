import { Show, type Component, type JSX } from "solid-js";
import { Container } from "@/components/ui/container";
import { DocsBreadcrumbs } from "../content/breadcrumbs.jsx";
import { DocsPager } from "../content/pager.jsx";
import type { BreadcrumbItemData } from "../../types.js";

export interface DocsLandingBodyProps {
  breadcrumbs?: BreadcrumbItemData[];
  showBreadcrumbs: boolean;
  showPager: boolean;
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
  children?: JSX.Element;
}

export const DocsLandingBody: Component<DocsLandingBodyProps> = (props) => (
  <Container as="main" size="2xl" class="min-w-0 max-w-full flex-1 py-8 sm:py-12 lg:py-16">
    <Container as="article" size="xl" class="mx-auto min-w-0 px-0 sm:px-4">
      <Show when={props.showBreadcrumbs && props.breadcrumbs && props.breadcrumbs.length > 0}>
        <DocsBreadcrumbs items={props.breadcrumbs!} class="mb-6" />
      </Show>
      <Container as="div" size="full" class="prose prose-zinc dark:prose-invert max-w-none px-0" data-docs-page-content>
        {props.children}
      </Container>
      <Show when={props.showPager && (props.prev || props.next)}>
        <DocsPager prev={props.prev} next={props.next} />
      </Show>
    </Container>
  </Container>
);
