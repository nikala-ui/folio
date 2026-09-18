import { For, Show, type Accessor, type Component } from "solid-js";
import { ChevronDown, Copy, ExternalLink, FileText } from "lucide-solid";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { resolvePageActionUrl } from "../../../client/page-actions.js";
import { useSiteLocale } from "../../../plugins/i18n/runtime.jsx";
import type { DocsAiProvider, DocsPageAction } from "../../../types.js";

export interface PageActionsProps {
  sourceUrl?: string;
  pageActions: readonly DocsPageAction[];
  aiProviders: readonly DocsAiProvider[];
  copyPageEnabled: boolean;
  copyMarkdownEnabled: boolean;
  pageUrl?: string;
  pageTitle?: string;
  markdown: Accessor<string>;
  onCopyPage: () => void;
  onCopyMarkdown: () => void;
}

export const PageActions: Component<PageActionsProps> = (props) => {
  const siteLocale = useSiteLocale();
  const hasCopyActions = () => props.copyPageEnabled || props.copyMarkdownEnabled || props.aiProviders.length > 0;
  const providerUrl = (provider: DocsAiProvider) => resolvePageActionUrl(provider.url, {
    url: typeof window !== "undefined" ? window.location.href : props.pageUrl || "",
    content: props.markdown(),
    title: props.pageTitle,
    prompt: provider.prompt,
  });

  return (
    <div class="flex items-center gap-2">
      <Show when={props.sourceUrl}>
        {(url) => (
          <a
            href={url()}
            target="_blank"
            rel="noreferrer"
            class={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
          >
            {siteLocale.t("actions.viewSource")}
          </a>
        )}
      </Show>
      <For each={props.pageActions}>
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
      <Show when={hasCopyActions()}>
        <DropdownMenu placement="bottom-end">
          <DropdownMenuTrigger
            as={Button}
            variant="secondary"
            size="sm"
            class="shrink-0 gap-1"
            aria-label={siteLocale.t("actions.copyDocumentationPage")}
          >
            <Copy class="size-3.5" />
            <span class="hidden sm:inline">{siteLocale.t("actions.copyPage")}</span>
            <ChevronDown class="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <Show when={props.copyPageEnabled}>
              <DropdownMenuItem onClick={props.onCopyPage}>
                <FileText class="mr-2 size-4" />
                {siteLocale.t("actions.copyPage")}
              </DropdownMenuItem>
            </Show>
            <Show when={props.copyMarkdownEnabled}>
              <DropdownMenuItem onClick={props.onCopyMarkdown}>
                <Copy class="mr-2 size-4" />
                {siteLocale.t("actions.copyAsMarkdown")}
              </DropdownMenuItem>
            </Show>
            <Show when={props.aiProviders.length > 0}>
              <For each={props.aiProviders}>
                {(provider) => (
                  <DropdownMenuItem as="a" href={providerUrl(provider)} target="_blank" rel="noreferrer">
                    <ExternalLink class="mr-2 size-4" />
                    {siteLocale.t("actions.openInProvider", { provider: provider.name })}
                  </DropdownMenuItem>
                )}
              </For>
            </Show>
          </DropdownMenuContent>
        </DropdownMenu>
      </Show>
    </div>
  );
};
