import { SidebarFooter as UiSidebarFooter, SidebarMenuButton } from "@/components/ui/sidebar";
import type { Component } from "solid-js";

export interface SidebarFooterProps {
  brandText: string;
  footerText?: string;
}

export const SidebarFooter: Component<SidebarFooterProps> = (props) => (
  <UiSidebarFooter class="p-2">
    <SidebarMenuButton size="lg" class="w-full justify-start">
      <div class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
        N
      </div>
      <div class="flex min-w-0 flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
        <span class="truncate text-xs font-semibold">{props.brandText}</span>
        <span class="truncate text-[10px] text-muted-foreground">{props.footerText}</span>
      </div>
    </SidebarMenuButton>
  </UiSidebarFooter>
);
