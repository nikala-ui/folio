// packages/docs/src/themes/default/overlays/search-dialog.tsx
import { createEffect, createSignal, For, Show, type Component } from "solid-js";
import { CommandDialog } from "@/components/ui/command";
import { CommandInput } from "@/components/ui/command";
import { CommandList } from "@/components/ui/command";
import { CommandEmpty } from "@/components/ui/command";
import { CommandGroup } from "@/components/ui/command";
import { CommandItem } from "@/components/ui/command";
import { FileText } from "lucide-solid";
import type { DocsSearchDialogProps } from "../../types.js";
import { resolveSearchProvider, searchPages } from "../../../search/provider.js";
import { useSiteLocale } from "../../../plugins/i18n/runtime.jsx";

export const DocsSearchDialog: Component<DocsSearchDialogProps> = (props) => {
  const siteLocale = useSiteLocale();
  const showAlgoliaAttribution = () =>
    typeof props.provider !== "string" && props.provider?.name === "algolia";

  const handleOpenChange = (open: boolean) => {
    props.onOpenChange(open);
  };

  const handleSelect = (url: string) => {
    handleOpenChange(false);
    if (props.onSelectPage) {
      props.onSelectPage(url);
    } else if (typeof window !== "undefined") {
      window.location.href = url;
    }
  };

  return (
    <CommandDialog
      open={props.open}
      onOpenChange={handleOpenChange}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>("#docs-search-input")?.focus();
        });
      }}
      enableHotkey={props.provider !== undefined}
    >
      {({ search }) => {
        const query = () => search().trim();
        const resolvedProvider = () => resolveSearchProvider({ provider: props.provider });
        const [filteredPages, setFilteredPages] = createSignal(props.pages || []);
        const [searching, setSearching] = createSignal(false);
        let requestId = 0;

        createEffect(() => {
          const currentRequest = ++requestId;
          setSearching(true);
          Promise.resolve(searchPages(resolvedProvider(), query(), props.pages || []))
            .then((results) => {
              if (currentRequest === requestId) setFilteredPages(results);
            })
            .finally(() => {
              if (currentRequest === requestId) setSearching(false);
            });
        });

        return (
          <>
            <CommandInput id="docs-search-input" placeholder={siteLocale.t("search.placeholder")} />
            <CommandList>
              <Show when={!searching() && query().length > 0 && filteredPages().length === 0}>
                <CommandEmpty>{siteLocale.t("search.empty")}</CommandEmpty>
              </Show>
              <Show when={!searching() && filteredPages().length > 0}>
                <CommandGroup heading={siteLocale.t("search.pages")}>
                  <For each={filteredPages()}>
                    {(page) => (
                      <CommandItem
                        title={page.title}
                        subtitle={page.url}
                        description={page.description}
                        icon={FileText}
                        shouldFilter={false}
                        onSelect={() => handleSelect(page.url)}
                      />
                    )}
                  </For>
                </CommandGroup>
              </Show>
            </CommandList>
            <Show when={showAlgoliaAttribution()}>
              <div class="flex items-center justify-end border-t border-border px-3 py-2">
                <a
                  href="https://www.algolia.com"
                  target="_blank"
                  rel="noreferrer"
                  class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`${siteLocale.t("search.by")} Algolia`}
                >
                  <span>{siteLocale.t("search.by")}</span>
                  <img src="/algolia-logo.svg" alt="Algolia" class="h-4 w-auto object-contain" />
                </a>
              </div>
            </Show>
          </>
        );
      }}
    </CommandDialog>
  );
};
