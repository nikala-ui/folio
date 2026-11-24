import { For, type Component } from "solid-js";
import { ExternalLinkHint, useExternalLink } from "@/components/ui/external-link";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useSiteLocale } from "../../../plugins/i18n/runtime.jsx";
import type { NavItem } from "../../../types.js";

export interface SidebarMobileNavProps {
  items?: NavItem[];
  onNavigate: () => void;
}

const MobileNavLink: Component<{ item: NavItem; onNavigate: () => void }> = (props) => {
  const link = useExternalLink(() => props.item.href, () => props.item.external);
  return (
    <SidebarMenuButton
      href={props.item.href}
      {...link.attributes()}
      onClick={props.onNavigate}
      class="w-full justify-start text-sm font-normal"
    >
      {props.item.title}
      <ExternalLinkHint external={link.external()} />
    </SidebarMenuButton>
  );
};

export const SidebarMobileNav: Component<SidebarMobileNavProps> = (props) => {
  const siteLocale = useSiteLocale();

  return (
    <nav aria-label={siteLocale.t("navigation.primary")} class="border-b border-border/60 px-2 py-2 md:hidden">
      <SidebarMenu>
        <For each={props.items}>
          {(item) => (
            <SidebarMenuItem>
              <MobileNavLink item={item} onNavigate={props.onNavigate} />
            </SidebarMenuItem>
          )}
        </For>
      </SidebarMenu>
    </nav>
  );
};
