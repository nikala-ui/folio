import { For, Show, type Component } from "solid-js";
import { Languages, ChevronDown } from "lucide-solid";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { useSiteLocale } from "../../../plugins/i18n/runtime.jsx";
import type { PageData } from "../../../types.js";
import { findLocalizedPage } from "../../../plugins/i18n/navigation.js";

interface SiteLanguageSwitcherProps {
  currentPage?: PageData;
  pages?: readonly PageData[];
  onNavigate?: (url: string) => void;
  class?: string;
}

export const DocsSiteLanguageSwitcher: Component<SiteLanguageSwitcherProps> = (props) => {
  const siteLocale = useSiteLocale();
  const targetPage = (locale: string) => {
    if (!props.currentPage || !props.pages) return undefined;
    return findLocalizedPage(props.pages, props.currentPage, locale);
  };
  const selectLocale = (locale: string) => {
    siteLocale.setLocale(locale);
    const page = targetPage(locale);
    if (page && typeof window !== "undefined" && window.location.pathname !== page.url) props.onNavigate?.(page.url);
  };

  return (
    <Show when={siteLocale.locales().length > 1}>
      <DropdownMenu placement="bottom-end">
        <DropdownMenuTrigger
          as={Button}
          variant="ghost"
          size="sm"
          class={cn("shrink-0 gap-1", props.class)}
          aria-label={siteLocale.t("navigation.chooseLanguage")}
        >
          <Languages class="size-3.5" />
          <span class="hidden sm:inline">{siteLocale.locale()}</span>
          <ChevronDown class="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <For each={siteLocale.locales()}>
            {(locale) => (
              <DropdownMenuItem onClick={() => selectLocale(locale)}>
                {locale.toUpperCase()}
              </DropdownMenuItem>
            )}
          </For>
        </DropdownMenuContent>
      </DropdownMenu>
    </Show>
  );
};
