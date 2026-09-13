import { For, Show, type Component } from "solid-js";
import { Languages, ChevronDown } from "lucide-solid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import type { PageData } from "../../../types.js";

interface LocalePageLink {
  locale: string;
  href: string;
}

interface LanguageSwitcherProps {
  currentPage?: PageData;
  pages?: readonly PageData[];
  class?: string;
}

function getLocale(page: PageData): string | undefined {
  const value = page.frontmatter.locale;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getTranslationKey(page: PageData, locale: string): string {
  const sourcePath = page.sourcePath || page.url;
  const prefix = `${locale}/`;
  return sourcePath.startsWith(prefix) ? sourcePath.slice(prefix.length) : sourcePath;
}

function getLocaleLinks(currentPage: PageData | undefined, pages: readonly PageData[]): LocalePageLink[] {
  const currentLocale = currentPage && getLocale(currentPage);
  if (!currentPage || !currentLocale) return [];
  const key = getTranslationKey(currentPage, currentLocale);

  return pages
    .flatMap((page) => {
      const locale = getLocale(page);
      return locale && getTranslationKey(page, locale) === key
        ? [{ locale, href: page.url }]
        : [];
    })
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

export const DocsLanguageSwitcher: Component<LanguageSwitcherProps> = (props) => {
  const links = () => getLocaleLinks(props.currentPage, props.pages || []);
  const currentLocale = () => getLocale(props.currentPage!);

  return (
    <Show when={links().length > 1}>
      <DropdownMenu placement="bottom-end">
        <DropdownMenuTrigger
          as={Button}
          variant="secondary"
          size="sm"
          class={cn("shrink-0 gap-1", props.class)}
          aria-label="Choose language"
        >
          <Languages class="size-3.5" />
          <span class="hidden sm:inline">{currentLocale()}</span>
          <ChevronDown class="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <For each={links()}>
            {(link) => (
              <DropdownMenuItem as="a" href={link.href}>
                {link.locale.toUpperCase()}
              </DropdownMenuItem>
            )}
          </For>
        </DropdownMenuContent>
      </DropdownMenu>
    </Show>
  );
};
