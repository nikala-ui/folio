import { Show, type Component } from "solid-js";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { SidebarHeader as UiSidebarHeader, SidebarMenuButton } from "@/components/ui/sidebar";
import type { DocsConfig } from "../../../types.js";

export interface SidebarHeaderProps {
  logo?: DocsConfig["logo"];
  brandText: string;
  subtitle?: string;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => (
  <UiSidebarHeader class="h-14 box-border p-3 group-data-[collapsible=icon]:p-2">
    <SidebarMenuButton
      href={props.logo?.href || "/"}
      class={cn("h-8 w-full justify-between group-data-[collapsible=icon]:h-10")}
    >
      <div class="flex items-center gap-2.5 overflow-hidden">
        <Show when={props.logo?.image} fallback={<Logo class="h-7 w-auto" />}>
          {(image) => <img src={image()} alt={props.brandText} class="size-7 shrink-0 rounded-md object-contain" />}
        </Show>
        <div class="flex min-w-0 flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
          <span class="truncate text-xs font-bold">{props.brandText}</span>
          <span class="truncate text-[10px] text-muted-foreground">{props.subtitle}</span>
        </div>
      </div>
    </SidebarMenuButton>
  </UiSidebarHeader>
);
