import { For, type Component } from "solid-js";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useSiteLocale } from "../../../plugins/i18n/runtime.jsx";
import type { NavItem } from "../../../types.js";

export interface SidebarMobileNavProps {
  items?: NavItem[];
  onNavigate: () => void;
}

export const SidebarMobileNav: Component<SidebarMobileNavProps> = (props) => {
  const siteLocale = useSiteLocale();

  return (
    <nav aria-label={siteLocale.t("navigation.primary")} class="border-b border-border/60 px-2 py-2 md:hidden">
      <SidebarMenu>
        <For each={props.items}>
          {(item) => (
            <SidebarMenuItem>
              <SidebarMenuButton
                href={item.href}
                onClick={props.onNavigate}
                class="w-full justify-start text-sm font-normal"
              >
                {item.title}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </For>
      </SidebarMenu>
    </nav>
  );
};
